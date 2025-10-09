import { getCurrentInstance } from '../component'
import { h } from '../h'

/**
 * 初始化过渡组件的 props
 * @param props
 * @returns
 */
function resolveTransitionProps(props) {
  const {
    name = 'v',
    enterFromClass = `${name}-enter-from`,
    enterActiveClass = `${name}-enter-active`,
    enterToClass = `${name}-enter-to`,
    leaveFromClass = `${name}-leave-from`,
    leaveActiveClass = `${name}-leave-active`,
    leaveToClass = `${name}-leave-to`,
    onEnter,
    onBeforeEnter,
    onLeave,
    ...rest
  } = props

  return {
    ...rest,
    beforeEnter(el) {
      el.classList.add(enterFromClass)
      el.classList.add(enterActiveClass)

      onBeforeEnter?.(el)
    },
    enter(el) {
      // 动画结束后需要调用 done 去删除动画样式
      const done = () => {
        el.classList.remove(enterActiveClass)
        el.classList.remove(enterToClass)
      }

      // 在下一帧删除类目，防止因为浏览器渲染机制不触发动画
      requestAnimationFrame(() => {
        el.classList.remove(enterFromClass)
        el.classList.add(enterToClass)
      })

      onEnter?.(el, done)

      // 当 onEnter 的长度(onEnter的参数个数) 小于 2 时，意味着没有调用 done ，需要我们自己调用
      if (!onEnter || onEnter.length < 2) {
        el.addEventListener('transitionend', done)
      }
    },
    leave(el, remove) {
      // 动画结束后需要调用 done 去删除动画样式
      const done = () => {
        el.classList.remove(leaveActiveClass)
        el.classList.remove(leaveToClass)

        // 移除动画执行完毕，删除当前的元素
        remove()
      }

      el.classList.add(leaveFromClass)
      el.classList.add(leaveActiveClass)

      // 在下一帧删除类目，防止因为浏览器渲染机制不触发动画
      requestAnimationFrame(() => {
        el.classList.remove(leaveFromClass)
        el.classList.add(leaveToClass)
      })

      onLeave?.(el, done)

      // 当 onEnter 的长度(onEnter的参数个数) 小于 2 时，意味着没有调用 done ，需要我们自己调用
      if (!onEnter || onEnter.length < 2) {
        el.addEventListener('transitionend', done)
      }
    },
  }
}

export function Transition(props, { slots }) {
  // 由于这里需要对 props 进行修改，因此需要增加一层
  return h(BaseTransition, resolveTransitionProps(props), slots)
}

const BaseTransition = {
  props: ['enter', 'leave', 'beforeEnter', 'appear'],

  setup(props, { slots }) {
    const vm = getCurrentInstance()

    return () => {
      const vnode = slots.default()
      // 将操作动画的方法放置到当前的节点上
      if (!vnode) return

      // 判断 appear 决定第一次是否执行动画
      if (props.appear || vm.isMounted) {
        vnode.transition = props
      } else {
        vnode.transition = {
          leave: props.leave,
        }
      }

      return vnode
    }
  },
}
