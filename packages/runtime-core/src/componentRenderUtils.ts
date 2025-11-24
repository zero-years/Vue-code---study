import { ShapeFlags } from '@vue/shared'
import {
  setCurrentRenderingInstance,
  unsetCurrentRenderingInstance,
} from './component'

/**
 * 判断新老 props 是否一样，这里的 props 是一个对象
 * @param prevProps
 * @param nextProps
 */
function hasPropsChanged(prevProps, nextProps) {
  const prevKeys = Object.keys(prevProps)
  const nextKeys = Object.keys(nextProps)

  // 新老节点的长度不同，需要更新
  // old: {msg: '123', count: 0} ==> new: {msg:'123'}
  if (nextKeys.length !== prevKeys.length) {
    return true
  }

  // 新老节点的长度相同，但内容不同，需要更新
  // old: {msg: '123', count: 0} ==> new: {msg:'123', count: 1}
  for (const key of nextKeys) {
    if (nextKeys[key] !== prevProps[key]) {
      return true
    }
  }

  return false
}

/**
 * 检测新旧节点内的内容是否相同
 * @param n1
 * @param n2
 */
export function shouldUpdateComponent(n1, n2) {
  const { props: prevProps, children: prevChildren } = n1
  const { props: nextProps, children: nextChildren } = n2

  // 任意一个具有插槽就需要更新
  if (prevChildren || nextChildren) {
    return true
  }

  // 老的没有，新的有则需要更新
  if (!prevProps) {
    return !!nextProps
  }

  // 老的有，新的没有，也需要更新
  if (!nextProps) {
    return true
  }

  // 老的有，新的也有，判断 props 是否改变
  return hasPropsChanged(prevProps, nextProps)
}

export function renderComponentRoot(instance) {
  const { vnode } = instance
  // 有状态的组件
  if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
    // 将当前渲染的组件实例存储起来
    setCurrentRenderingInstance(instance)

    // 将子树的 this 指向 setupState 从而能够使用 setupState 返回的状态
    const subTree = instance.render.call(instance.proxy)

    // 清除存储的实例
    unsetCurrentRenderingInstance()

    return subTree
  } else {
    // 函数式组件
    return vnode.type(instance.props, {
      get attrs() {
        return instance.attrs
      },
      slots: instance.slots,
      emit: instance.emit,
    })
  }
}
