import { track, trigger } from './dep'
import { isRef } from './ref'
import { hasChanged, isObject } from 'packages/shared/src/utils'
import { reactive } from './reavtive'

export const mutableHandlers = {
  /**
   * 收集依赖， 绑定 target 中的某一个 key 和 sub 之间的关系
   *
   * @param target target = {a:0}
   * @param key  target 中对应的 key值 a
   * @param receiver
   * @returns
   */
  get(target, key, receiver) {
    track(target, key)

    const res = Reflect.get(target, key, receiver)

    if (isRef(res)) {
      // 如果 target 是一个 ref ，就直接把值给它，不要在继续 .value
      // target = { a: ref(0)}
      return res.value
    }

    if (isObject(res)) {
      // 如果 res 是一个对象则继续包装成 reactive
      return reactive(res)
    }

    // receiver 用来保证访问器里面的 this 执行代理对象 proxy
    return res
  },

  /**
   * 触发更新, set 的时候，通知已经收集完的相对应的依赖重新执行
   *
   * @param target 对象 target = { a: 0}
   * @param key 键名 a
   * @param newValue 修改的值
   * @param receiver
   */
  set(target, key, newValue, receiver) {
    // 拿到更新前的值
    const oldValue = target[key]

    //拿到更新的 length
    const targetIsArray = Array.isArray(target)
    const oldLength = targetIsArray ? target.length : 0

    // 如果更新 reactive 里面 a 的值之前是个 ref ，且新的 ref 不是一个 ref 。则需要同步修改 始 a 的 ref 的值为 newValue
    // 如果更新的 newValue 是一个 ref ，那就不需要同步更新
    if (isRef(oldValue) && !isRef(newValue)) {
      /**
       * const a = ref(0)
       * target = { a}
       *
       * target.a = 1 就可以看作 a.value = 1
       * a.value = 1
       */
      oldValue.value = newValue
      return true
    }

    // 先通知 set 在 触发更新
    const res = Reflect.set(target, key, newValue, receiver)

    // 判断更改前后的值是否相同，相同则不处理，不相同则触发更新
    if (hasChanged(newValue, oldValue)) {
      trigger(target, key)
    }

    // 拿到更新后的值
    const newLength = targetIsArray ? target.length : 0

    //  处理隐式更新数组的 length
    if (targetIsArray && newLength !== oldLength && key !== 'length') {
      /**
       * 隐式更新 length ，例如 push、 pop等
       * 更新前 state.length = 4 ==> ['a', 'b', 'c', 'd']
       * 更新后 state.length = 5 ==> ['a', 'b', 'c', 'd', 'e']
       * 更新动作，以 push 为例，追加了一个 e
       * 隐式更新的方法: push pop shift unshift
       * 通过对比一个更新前与一个更新后的 length 来判断是否有隐式更新
       * */
      trigger(target, 'length')
    }

    return res
  },
}
