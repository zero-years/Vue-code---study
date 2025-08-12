import { ShapeFlags } from '@vue/shared'

export function initSlots(instance) {
  const { slots, vnode } = instance

  // 组件的子元素是一个插槽
  if (vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    const { children } = vnode
    /**
     * 一开始 ： slots = {}
     * children = { header: () => h('div', 'hello')}
     * 结束: slots = { header: () => h('div', 'hello')}
     */
    for (const key in children) {
      slots[key] = children[key]
    }
  }
}

export function updateSlots(instance, vnode) {
  const { slots } = instance

  // 组件的子元素是一个插槽
  if (instance.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    const { children } = vnode
    /**
     * 更新新的子元素插槽
     * 一开始 ： slots = {header: () => h('div', 'hello')}
     * children = { footer: () => h('div', 'hello')}
     * 结束: slots = { header: () => h('div', 'hello'), footer: () => h('div', 'hello')}
     */
    for (const key in children) {
      slots[key] = children[key]
    }

    /**
     * 删除掉老有新的没有的插槽
     * 一开始 ： slots = { header: () => h('div', 'hello'), footer: () => h('div', 'hello')}
     * children = { footer: () => h('div', 'hello')}
     * 结束: slots = { footer: () => h('div', 'hello')}
     */
    for (const key in slots) {
      if (children[key] == null) {
        delete slots[key]
      }
    }
  }
}
