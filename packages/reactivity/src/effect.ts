import { Link, startTrack, endTrack, Sub } from './system'
// 用来保存当前执行的 effect
export let activeSub

export function setActiveSub(sub) {
  activeSub = sub
}

export class ReactiveEffect implements Sub {
  // 依赖链表的头节点
  deps: Link | undefined

  // 依赖链表的尾节点
  depsTail: Link | undefined

  // tracking 用于判断是否已经追踪
  tracking = false

  // 处理一个 effect 内对同个 ref 进行多次收集的逻辑
  // - Vue 源码采取遍历的方法，查看 dep 链条中是否存在 sub
  // - 本内容采取空间换时间的方法，通过一个 dirty 确定是否需要收集
  dirty = false

  constructor(public fn) {}

  /**
   * 用来执行响应式方法
   * @returns 执行当前的 响应式方法
   */
  run() {
    if (!this.active) {
      return this.fn()
    }
    // 先将当前的  effect 保存起来，从而处理嵌套的逻辑。存在 effect 则保存，不存在则为 undefined
    const prevSub = activeSub

    // 每次执行 fn 之前把 this 存储到 activeSub 中， 这样能够使同一个 effect 内的依赖收集函数中的 activeSub(sub) 为同一个，使得他们的 deps 和 depsTail 能够为同一个
    setActiveSub(this)
    // 每次重新执行 effect 时需要将 depsTail 设置为 undefined 从而使得 effect 会从头节点开始执行函数
    startTrack(this)

    try {
      return this.fn()
    } finally {
      // 执行完成后，需要判断当前 depsTail 是否具有 nextDep ，这些 nextDep 都是需要清理的内容，因为他已经不满足新的 effect 函数
      endTrack(this)

      // 执行完成后 把  activeSub 恢复为之前的 effects
      setActiveSub(prevSub)
    }
  }

  /**
   * 通知更新，如果依赖的数据发生了变化，会调用这个函数
   */
  notify() {
    this.scheduler()
  }

  /**
   * 默认调用 run ，如果用户传了 scheduler 则调用用户传入的 scheduler 方法， 类似原型方法与实例方法
   */
  scheduler() {
    this.run()
  }

  // effect 激活标记，默认为 true
  active = true

  stop() {
    if (this.active) {
      // 清理依赖
      startTrack(this)

      endTrack(this)

      // 将 effct 的激活标记关闭
      this.active = false
    }
  }
}

export function effect(fn, options) {
  const e = new ReactiveEffect(fn)

  // scheduler 触发更新的配置
  Object.assign(e, options)

  e.run()

  /**
   * 绑定函数的 this
   * P1: e.run.bind(e)
   * P2: () => e.run()
   */
  const runner = e.run.bind(e)

  // 把 effect 实例放到函数里，然后返回给外部
  runner.effect = e

  return runner
}
