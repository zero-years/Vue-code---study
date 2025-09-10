import { ShapeFlags } from '@vue/shared'
import { getCurrentInstance } from '../component'

export const isKeepAlive = type => type?.__isKeepAlive

export const KeepAlive = {
  name: 'KeepAlive',
  __isKeepAlive: true,

  setup(props, { slots }) {
    const instance = getCurrentInstance()

    const { options } = instance.ctx.render
    const { createElement, insert } = options

    /**
     * 缓存:
     * component(当前的子组件) => vnode
     * 或者
     * key => vnode
     */
    const cache = new Map()

    // 创建一个 dom 元素来存放停用的节点，但这个 dom 元素不会挂载到页面之中
    const storageContainer = createElement('div')
    /**
     * unmount 不再卸载该节点，但需要将这个虚拟节点，进行放置，从而不在继续使用
     */
    instance.ctx.deactivate = vnode => {
      insert(vnode.el, storageContainer)
    }

    /**
     * processComponent 不再重新挂载节点，而是将已经缓存的 dom 元素进行复用(移动到 container 中)
     */
    instance.ctx.activate = (vnode, container, anchor) => {
      insert(vnode.el, container, anchor)
    }

    return () => {
      const vnode = slots.default()
      const key = vnode.key != null ? vnode.key : vnode.type

      const cachedVnode = cache.get(key)

      // 查看当前节点是否已经缓存过
      if (cachedVnode) {
        // 复用之前已经缓存过的组件实例与 dom 元素
        vnode.component = cachedVnode.component
        vnode.el = cachedVnode.el

        // 再打一个标记，通过标记使得 mount 不会重新挂载，而是复用旧的节点
        vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE
      }

      // 处理缓存
      cache.set(key, vnode)

      /**
       * 阻止该组件的卸载，通过标记使得 unmount 不会卸载该节点
       */
      vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE

      return vnode
    }
  },
}
