import { type Link, link, propagate } from './system'
import { activeSub } from './effect'

const targetMap = new WeakMap()

export function track(target, key) {
  if (!activeSub) {
    return
  }

  /**找 depsMap ，找到当前的 target 对应的 map
   *
   * depsMap = {
   *    a: Dep,
   *    b: Dep
   * }
   * */
  let depsMap = targetMap.get(target)

  if (!depsMap) {
    // 没有 depsMap , 意味着之前没有收集过这个 target 对象里的任何 key，因此需要创建一个新的 map，来保存 target 和 depsMap 之间的关联关系
    depsMap = new Map()
    targetMap.set(target, depsMap)
  }

  // 找到 key 相关联的 dep
  let dep = depsMap.get(key)

  if (!dep) {
    // 第一次收集这个对象，则需要创建一个 dep 里面有 subs 和 subsTail，然后保存到 depsMap 中
    dep = new Dep()
    depsMap.set(key, dep)
  }

  // 绑定 dep 和 activeSub 的关系
  link(dep, activeSub)
}

export function trigger(target, key) {
  const depsMap = targetMap.get(target)

  /**找 depsMap ，找到当前的 target 对应的 map
   *
   * depsMap = {
   *    a: Dep,
   *    b: Dep
   * }
   * */
  if (!depsMap) {
    // depsMap 没有，表示这个对象没有任何属性在 sub 中访问，意味着不需要进行更新
    return
  }

  const targetIsArray = Array.isArray(target)

  if (targetIsArray && key === 'length') {
    /**更新数组的 length
     * 更新前 state.length = 4 ==> ['a', 'b', 'c', 'd']
     * 更新后 state.length = 2 ==> ['a', 'b']
     * 此时需要通知绑定了 c 和 d 的 effect 重新执行，也就是那些索引大于等于 length 的内容
     *
     * depsMap = {
     *  0: dep,
     *  1: dep,
     *  2: dep,
     *  3: dep,
     *  length: dep
     * }
     */
    const length = target.length
    depsMap.forEach((dep, depKey) => {
      if (depKey >= length || depKey === 'length') {
        // 通知访问了大于等于 length 的 subs 重新执行收集，从而清空依赖
        // 当访问的是 length 也需要将 length 相关的 sub 重新执行
        propagate(dep.subs)
      }
    })
  } else {
    // 不是数组，或者数组更新的不是 length，则直接执行以下内容

    // 找到 key 相关联的 dep
    const dep = depsMap.get(key)

    if (!dep) {
      // dep 没有，表示这个 key 没有在 sub 中访问。则直接 return ，不需要触发更新
      return
    }

    // 找到 dep.subs 通知他们重新执行
    propagate(dep.subs)
  }
}

class Dep {
  // 订阅者链表的头节点，理解为链表中的 head
  subs: Link

  // 订阅者链表的尾节点，理解为链表中的 tail
  subsTail: Link
}
