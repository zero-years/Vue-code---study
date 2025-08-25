import {
  isArray,
  isFunction,
  isNumber,
  isObject,
  isString,
  ShapeFlags,
} from '@vue/shared'
import { getCurrentRenderingInstance } from './component'

/**
 * 文本节点标记
 */
export const Text = Symbol('v-txt')

export function isSameVNodeType(n1, n2) {
  return n1.type === n2.type && n1.key === n2.key
}

/**
 * 标准化节点，当节点为 string 或者 number 则将其转换为对象
 * @param vnode
 * @returns
 */
export function normalizeVnode(vnode) {
  if (isString(vnode) || isNumber(vnode)) {
    // 如果是字符串或者数字则需要转换为节点对象

    return createVNode(Text, null, String(vnode))
  }
  return vnode
}

/**
 * 根据 __v_isVNode 判断是否为虚拟节点
 */
export function isVnode(value) {
  return value?.__v_isVNode
}

/**
 * 将 children 标准化
 * @param children
 */
function normalizeChildren(vnode, children) {
  let { shapeFlag } = vnode

  if (isArray(children)) {
    // children = [h('p', 'hello'), h('p', 'world')]
    shapeFlag |= ShapeFlags.ARRAY_CHILDREN
  } else if (isObject(children)) {
    // children = h(Child, null, { header: () => h('div', '父组件传递的插槽 header')})
    if (shapeFlag & ShapeFlags.COMPONENT) {
      // 如果是个组件，那就是插槽
      shapeFlag |= ShapeFlags.SLOTS_CHILDREN
    }
  } else if (isFunction(children)) {
    // children = () => h('div', 'hello')
    if (shapeFlag & ShapeFlags.COMPONENT) {
      // 如果是个组件，那就是插槽
      shapeFlag |= ShapeFlags.SLOTS_CHILDREN
      children = { default: children }
    }
  } else if (isNumber(children) || isString(children)) {
    // 如果 children 是 number 则转换为 string
    children = String(children)
    shapeFlag |= ShapeFlags.TEXT_CHILDREN
  }

  // 将 shapeFlag 和 children 进行处理，并且重新赋值
  vnode.shapeFlag = shapeFlag
  vnode.children = children

  return children
}

function normalizeRef(ref) {
  if (ref == null) return
  return {
    // 原始的 ref
    r: ref,
    // 当前正在渲染的组件的实例
    i: getCurrentRenderingInstance(),
  }
}

/**
 * 用来创建虚拟节点的方法
 * @param type 节点的类型
 * @param props 节点携带的属性
 * @param children 节点的子级
 */
export function createVNode(type, props?, children = null) {
  let shapeFlag = 0

  // 处理 type 的 shapeFlag
  if (isString(type)) {
    // div span p h1
    shapeFlag = ShapeFlags.ELEMENT
  } else if (isObject(type)) {
    // 有状态的组件
    shapeFlag = ShapeFlags.STATEFUL_COMPONENT
  } else if (isFunction(type)) {
    // 函数式组件
    shapeFlag = ShapeFlags.FUNCTIONAL_COMPONENT
  }

  const vnode = {
    // 证明是一个虚拟节点  vnode
    __v_isVNode: true,
    type,
    props,
    children: null,
    // **key** 做 diff 需要的
    key: props?.key,
    // 虚拟节点要挂载的元素
    el: null,
    // 如果是 9 则表示 type 是一个 dom 元素, children 是一个字符串
    shapeFlag,
    // 绑定 ref
    ref: normalizeRef(props?.ref),
    // app 中一下会使用到的方法 例如: app.use | provides
    appContext: null,
  }

  // 处理 children 的标准化 和 shapeFlag
  normalizeChildren(vnode, children)

  return vnode
}
