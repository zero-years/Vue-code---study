import { isRef } from './ref'
import { ReactiveEffect } from './effect'
import { isFunction, isObject } from 'packages/shared/src/utils'
import { isReactive } from './reavtive'

/**
 *
 * @param source 要监听的相应内容
 * @param cb 触发的回调函数,具有 newValue 和 oldValue
 * @param options 相应的监听设置，例如: 仅触发一次、立即触发 等
 * @returns
 */
export function watch(source, cb, options) {
  let getter

  let { immediate, once, deep } = options || {}

  if (once) {
    // 如果 once 传了，那就把 cb 改为原来的 cb 加上 stop 停止监听
    const _cb = cb

    cb = (...args) => {
      _cb(...args)
      stop()
    }
  }

  if (isRef(source)) {
    // 如果值为 ref 则访问 source.value 从而收集依赖
    getter = () => source.value
  } else if (isReactive(source)) {
    // 如果值是 reactive ，则默认 deep 为 true，如果 deep 传入值，则以传入的为主
    getter = () => source
    if (!deep) {
      deep = true
    }
  } else if (isFunction(source)) {
    // 如果 source 是一个函数，那么 getter 就等于 source
    getter = source
  }

  if (deep) {
    const baseGetter = getter
    const depth = deep === true ? Infinity : deep

    getter = () => traverse(baseGetter(), depth)
  }

  let oldValue

  let cleanup = null

  function onClaenup(cb) {
    cleanup = cb
  }

  /**
   * 用来生成需要监听的 source 的函数，并且收集相应的依赖
   *  - 如果 source 为 ref 则 getter 返回一个 source.value
   *  - 如果 source 为 reactive 则 getter 直接返回当前的 source，并且需要判断是否存在 deep
   *  - 如果 source 为 function 则 getter 直接为当前的 source 函数，不需要返回
   */
  function job() {
    //  看一下是否需要清理上一次的副作用，如果有就执行，执行完成后置空
    if (cleanup) {
      cleanup()
      cleanup = null
    }

    // 执行 effect.run 拿到 getter 的返回值，不能直接执行 getter ，因为需要收集依赖
    const newValue = effect.run()

    // 执行用户回调，把 newValue 、 oldValue 和 onClaenup 函数 传入
    cb(newValue, oldValue, onClaenup)

    // 下一次的 oldValue 等于这一次的 newValue
    oldValue = newValue
  }

  const effect = new ReactiveEffect(getter)

  effect.scheduler = job

  if (immediate) {
    // 如果存在 immediate 则直接进行触发
    job()
  } else {
    // 这一步有两个目的: 1. 拿到 oldValue  2. 收集依赖
    oldValue = effect.run()
  }

  // 停止监听
  function stop() {
    effect.stop()
  }

  return stop
}

/**
 * 用来对响应式对象进行深度监听的函数
 * @param value 监听的值
 * @param depth 需要深度监听的层次，默认为无穷
 * @param seen 用于存储已经遍历过的值
 * @returns
 */
function traverse(value, depth = Infinity, seen = new Set()) {
  //如果不是一个对象或者监听层级到 0 则直接返回 value
  if (!isObject(value) || depth <= 0) {
    // 不是对象则递归
    return value
  }

  // 查看是否已经遍历过，防止栈溢出
  if (seen.has(value)) {
    return value
  }

  // 层级逐步减 1
  depth--

  // 添加到 seen 中，以便判断
  seen.add(value)

  // 是对象则递归处理
  for (const key in value) {
    traverse(value[key], depth, seen)

    return value
  }
}
