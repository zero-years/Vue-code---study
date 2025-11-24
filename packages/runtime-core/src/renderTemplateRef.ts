import { isRef } from '@vue/reactivity'
import { isString, ShapeFlags } from '@vue/shared'
import { getComponentPublicInstance } from './component'

/**
 * 将对应的元素绑定到 ref 上
 * @param ref
 * @param vnode
 */
export function setRef(ref, vnode) {
  const { r: rawRef, i: instance } = ref
  //   ref:{ r: 用户暴露的内容, i: 当前渲染的组件的实例}

  // 卸载 ref
  if (vnode == null) {
    if (isRef(rawRef)) {
      // 如果是 ref，就设置为 null
      rawRef.value = null
    } else if (isString(rawRef)) {
      // 如果是字符串就修改 refs[rawRef] 设置为 null
      instance.refs[rawRef] = null
    }

    return
  }

  const { shapeFlag } = vnode

  // 挂载 ref
  if (isRef(rawRef)) {
    // 如果 rawRef 是一个响应式的
    if (shapeFlag & ShapeFlags.COMPONENT) {
      // vnode 是组件， 则获取子组件暴露的内容
      rawRef.value = getComponentPublicInstance(vnode.component)
    } else {
      // vnode 是一个 DOM 元素，则获取其元素内容
      rawRef.value = vnode.el
    }
  } else if (isString(rawRef)) {
    // 把 vnode.el 绑定到 instance.$ref[ref] 上
    if (shapeFlag & ShapeFlags.COMPONENT) {
      // vnode 是一个组件
      instance.refs[rawRef] = getComponentPublicInstance(vnode.component)
    } else {
      // DOM 元素
      instance.refs[rawRef] = vnode.el
    }
  }
}
