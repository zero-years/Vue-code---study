import { isObject } from 'packages/shared/src/utils'
import { mutableHandlers } from './baseHandlers'

export function reactive(target) {
  return createReactiveObject(target)
}

/** 保存 target 和 响应式对象之间的关联关系，从而防止同一个代理对象被多次创建
 *
 *  target => proxy
 * */
const reactiveMap = new WeakMap()

/**
 * 保存所有使用 reactive 创建出来的响应式对象
 */
const reactiveSet = new WeakSet()

export function createReactiveObject(target) {
  // reactive 必须要接受一个对象
  if (!isObject(target)) {
    // target 不是一个对象，则返回去
    return target
  }

  // 判断当前 target 是否已经是响应式对象
  if (reactiveSet.has(target)) {
    return target
  }

  // 查看之前这个 target 是否有代理对象
  const exisitingProxy = reactiveMap.get(target)

  // 如果这个 target 之前创建过 proxy ，则直接返回存在的响应式对象
  if (exisitingProxy) {
    return exisitingProxy
  }

  /**
   * 创建 target 的代理对象
   */
  const proxy = new Proxy(target, mutableHandlers)

  // 将一个 target 对象与她相关联的代理对象进行关联
  reactiveMap.set(target, proxy)

  // 保存已经创建过的响应式对象
  reactiveSet.add(proxy)

  return proxy
}

/**
 * 绑定 target 的 key 关联的所有的 dep
 * obj = { a:0, b:1 }
 *
 * targetMap = {
 *  [obj]: {
 *      a: Dep
 *      b: Dep
 *  }
 * }
 * */

/**
 * 判断 target 是不是响应式对象，只要在 reactiveSet 中就是响应式对象，原版的逻辑是与 isRef 类似，在 ref 中建立变量，然后在 reactive 中判断与设置
 * @param target
 * @returns
 */
export function isReactive(target) {
  return reactiveSet.has(target)
}
