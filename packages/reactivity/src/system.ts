// 依赖项
export interface Dependency {
  // 订阅者链表的头节点
  subs: Link | undefined
  // 订阅者链表的尾节点
  subsTail: Link | undefined
}

// Sub 订阅者
export interface Sub {
  // 订阅者链表的头节点
  deps: Link | undefined
  // 订阅者链表的尾节点
  depsTail: Link | undefined
  // tracking 用于判断是否已经追踪
  tracking: boolean
}

/**
 * 链表节点 用来储存 effect 函数
 */
export interface Link {
  // effect 函数
  sub: Sub
  // 下一个订阅者节点
  nextSub: Link | undefined
  // 上一个订阅者节点
  prevSub: Link | undefined

  // 依赖项
  dep: Dependency
  // 下一个依赖项
  nextDep: Link | undefined
}

// 保存一个已经创建过但被清除的节点
let linkPool: Link

/**
 * 链接链表关系， 收集依赖
 * @param dep
 * @param sub 订阅者，依赖变化时需要通知的 effect 函数，从而重新执行
 */
export function link(dep, sub) {
  // region 尝试复用链表节点
  const currentDep = sub.depsTail

  /**
   * 分两种情况
   * P1: 头节点存在，尾节点为 undefined ， 复用头节点
   * P2: 尾节点存在 nextDep ，复用尾节点的下一个节点 nextDep
   */
  const nextDep = currentDep === undefined ? sub.deps : currentDep.nextDep

  if (nextDep && nextDep.dep === dep) {
    sub.depsTail = nextDep
    return
  }
  // endregion

  // 如果存在 activeSub ，就保存起来，等 set(更新时)触发
  let newLink: Link | undefined

  /**
   * 查看是否具有 linkPool ，如果具有 linkPool ，则证明之前具有可以复用的节点，就复用之前的节点，没有就创建新的节点
   */
  if (linkPool) {
    newLink = linkPool
    linkPool = linkPool.nextDep
    newLink.nextDep = nextDep
    newLink.dep = dep
    newLink.sub = sub
  } else {
    newLink = {
      dep,
      nextDep,
      sub,
      nextSub: undefined,
      prevSub: undefined,
    }
  }

  // region 将链表节点和  dep 建立关联关系
  // 实现逻辑
  /**
   * 关联双向链表关系，分两种情况
   * 1. 存在尾节点，往尾节点后面加
   * 2. 不存在为节点，则表示第一次关联，则往头节点加，并且头尾节点相同
   */
  if (dep.subsTail) {
    dep.subsTail.nextSub = newLink
    newLink.prevSub = dep.subsTail
    dep.subsTail = newLink
  } else {
    dep.subs = newLink
    dep.subsTail = newLink
  }
  // endregion

  // region 将列表节点与 sub 建立关系，是单向链表
  // 实现逻辑
  /**
   * 关联双向链表关系，分两种情况
   * 1. 存在尾节点，往尾节点后面加
   * 2. 不存在为节点，则表示第一次关联，则往头节点加，并且头尾节点相同
   */
  if (sub.depsTail) {
    sub.depsTail.nextDep = newLink
    sub.depsTail = newLink
  } else {
    sub.deps = newLink
    sub.depsTail = newLink
  }

  // endregion
}

/**
 * 更新所有关联 effect 的函数(传播更新函数)
 * @param subs 传入一个头部节点，然后依次触发下去
 */
export function propagate(subs) {
  // 通知 effect 执行，从而获取最新的值
  let link = subs
  let queuedEffect = []
  while (link) {
    const sub = link.sub
    if (!sub.tracking && !sub.dirty) {
      //计算属性标记为脏
      sub.dirty = true
      if ('update' in sub) {
        processComputedUpdate(sub)
      } else {
        queuedEffect.push(link.sub)
      }
    }
    link = link.nextSub
  }
  queuedEffect.forEach(effect => effect.notify())
}

/**
 * 开始追踪依赖，将 depsTail 尾节点设置为 undefined
 * @param sub 当前 effect 函数的 this
 */
export function startTrack(sub) {
  sub.tracking = true
  sub.depsTail = undefined
}

/**
 * 结束追踪，找到需要清理的依赖，通过调用 clearTracking 进行依赖清理，断开关联关系
 * @param this 当前 effect 函数的 this
 */
export function endTrack(sub) {
  sub.tracking = false
  const depsTail = sub.depsTail

  // 追踪完了，不脏了
  sub.dirty = false
  /**
   * 需要清除的几种情况
   * - 1. depsTail 有，同时 depsTail 内有 nextDep ，需要将依赖清除
   * - 2. depsTail 没有，并且头节点有，则把所有依赖清除
   */
  if (depsTail) {
    if (depsTail.nextDep) {
      clearTracking(depsTail.nextDep)
      depsTail.nextDep = undefined
    }
  } else if (sub.deps) {
    clearTracking(sub.deps)
    sub.deps = undefined
  }
}

/**
 * 清理无关依赖的函数
 * @param link 需要清理的依赖项节点
 */
function clearTracking(link: Link) {
  while (link) {
    const { prevSub, nextSub, dep, nextDep } = link

    // 1. 如果上一个节点(prevSub) 有，那就把 prevSub 的 nextSub 设置为当前节点的 nextSub
    // 2. 如果上一个节点(prevSub) 没有, 证明是头节点，就把 dep 中的 subs 变为当前的 nextSub，然后把 nextSub 的 prevSub 设置为空
    // 3. 如果下一个节点(nextSub) 有，那就把  nextSub 的 prevSub  设置为当前节点的 prevSub
    // 4. 如果下一个节点(nextSub) 没有, 证明是尾节点，就把 dep 中的 subsTail 设置为当前节点的 prevSub, 然后把 prevSub 设置为空

    // 判断上一个节点
    if (prevSub) {
      prevSub.nextSub = nextSub
      link.nextSub = undefined
    } else {
      dep.subs = nextSub
    }

    // 判断下一个节点
    if (nextSub) {
      nextSub.prevSub = prevSub
      link.prevSub = undefined
    } else {
      dep.subsTail = prevSub
    }

    link.dep = link.sub = undefined

    // 把不要的节点给 linkPool ，让它能够复用
    link.nextDep = linkPool
    linkPool = link

    link = nextDep
  }
}

/**
 * 用来处理当触发更新时，当前函数为 computed 函数遇到的问题
 * @param sub 处理触发更新时为 computed 的触发函数
 */
function processComputedUpdate(sub) {
  /**
   * 更新计算属性
   *  - 1. 调用 update
   *  - 2. 通知 subs 链表上所有的 sub 重新执行
   */
  if (sub.subs && sub.update()) {
    // sub.update() 会返回一个值，但值为 true 则表示当前值发生变化
    propagate(sub.subs)
  }
}
