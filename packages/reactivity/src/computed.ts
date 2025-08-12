import { hasChanged, isFunction } from 'packages/shared/src/utils'
import { ReactiveFlags } from './ref'
import { Link, Dependency, Sub, link, startTrack, endTrack } from './system'
import { activeSub, setActiveSub } from './effect'

class ComputedRefImpl implements Dependency, Sub {
  // computed 也是一个 ref ，通过 isRef 也返回 true
  [ReactiveFlags.IS_REF] = true

  // 保存 fn 的返回值
  _value

  //region 作为 dep,要关联 subs 如果值发生改变则通知更新
  // 订阅者链表的头节点，理解为链表中的 head
  subs: Link | undefined

  // 订阅者链表的尾节点，理解为链表中的 tail
  subsTail: Link | undefined
  //endregion

  //region  作为 sub ，要保存被我收集的 dep
  // 依赖链表的头节点
  deps: Link | undefined

  // 依赖链表的尾节点
  depsTail: Link | undefined

  // tracking 用于判断是否已经追踪
  tracking = false

  //endregion

  // 计算属性脏不脏，如果 dirty 为 true 则证明该计算是脏的, 所以 get 和 set 的时候，需要执行 update
  dirty = true

  constructor(
    public fn,
    private setter,
  ) {}

  get value() {
    if (this.dirty) {
      //如果计算属性脏了则 update
      this.update()
    }
    /**
     * 作为 dep(ref) ，为了实现 dep 功能，要和 sub(effect) 关联关系
     */
    if (activeSub) {
      link(this, activeSub)
    }

    return this._value
  }

  set value(newValue) {
    if (this.setter) {
      this.setter(newValue)
    } else {
      console.warn('我是只读的，无法重新赋值')
    }
  }

  update() {
    /** 作为 sub(effect) 实现 sub 的功能，为了在执行 fn 期间，收集 fn 执行过程中访问到的响应式数据
     * 建立 dep 和 sub 之间的关联关系
     */
    // 先将当前的 effect 保存起来，从而处理嵌套的逻辑。存在 effect 则保存，不存在则为 undefined
    const prevSub = activeSub

    // 每次执行 fn 之前把 this 存储到 activeSub 中， 这样能够使同一个 effect 内的依赖收集函数中的 activeSub(sub) 为同一个，使得他们的 deps 和 depsTail 能够为同一个
    setActiveSub(this)

    // 每次重新执行 effect 时需要将 depsTail 设置为 undefined 从而使得 effect 会从头节点开始执行函数
    startTrack(this)

    try {
      // 拿到老值
      const oldValue = this._value

      // 拿到新的值
      this._value = this.fn()

      // 返回值有没有变 ，值发生变化则返回 true
      return hasChanged(this._value, oldValue)
    } finally {
      // 执行完成后，需要判断当前 depsTail 是否具有 nextDep ，这些 nextDep 都是需要清理的内容，因为他已经不满足新的 effect 函数
      endTrack(this)

      // 执行完成后 把  activeSub 恢复为之前的 effects
      setActiveSub(prevSub)
    }
  }
}

/**
 *  计算属性
 * @param getterOrOptions 有可能为函数，也有可能为对象，对象里面具有 get 和 set 属性
 */
export function computed(getterOrOptions) {
  let getter
  let setter

  if (isFunction(getterOrOptions)) {
    /**
     * const c = computed(()=>{})
     */
    getter = getterOrOptions
  } else {
    /**
     * const c = computed({
     *      get(){},
     *      set(){}
     * })
     */
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }

  return new ComputedRefImpl(getter, setter)
}
