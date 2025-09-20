import { ShapeFlags } from '@vue/shared'
import { getCurrentInstance } from '../component'

export const isKeepAlive = type => type?.__isKeepAlive

export const KeepAlive = {
  name: 'KeepAlive',
  __isKeepAlive: true,
  props: ['max'],

  setup(props, { slots }) {
    const instance = getCurrentInstance()

    const { options, unmount } = instance.ctx.render
    const { createElement, insert } = options

    /**
     * 缓存:
     * component(当前的子组件) => vnode
     * 或者
     * key => vnode
     */
    const cache = new LRUCache(props.max)

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
      const _vnode = cache.set(key, vnode)
      // 判断是否有需要卸载的节点
      if (_vnode) {
        // 超出最大的缓存值，需要进行卸载
        reSetShapleFlag(_vnode)
        unmount(_vnode)
      }

      /**
       * 阻止该组件的卸载，通过标记使得 unmount 不会卸载该节点
       */
      vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE

      return vnode
    }
  },
}

/**
 * 将两个标记清空，从而使得可以重新卸载与挂载组件
 * @param vnode
 */
function reSetShapleFlag(vnode) {
  vnode.shapeFlag &= ~ShapeFlags.COMPONENT_KEPT_ALIVE
  vnode.shapeFlag &= ~ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
}

class LRUCache {
  caches = new Map()
  max

  constructor(max = Infinity) {
    this.max = max
  }

  get(key) {
    if (!this.caches.has(key)) return

    // 缓存中存在 key ，因此需要将它放置在 map 的最后面，从而刷新它的使用时间
    const value = this.caches.get(key)

    // 通过先删除原先的 key ，然后设置新的，将当前的 key 放置到缓存的最新位置
    this.caches.delete(key)
    this.caches.set(key, value)

    return value
  }

  set(key, value) {
    // 设置需要卸载的节点
    let vnode
    /**
     * set 有两种
     * 1. 设置原先有的内容
     *      将原先的内容更新到缓存的最新位置
     * 2. 设置新的内容
     *      判断当前缓存是否已经超过最大值，超过就需要删除掉最旧的一个缓存，然后在设置新的
     */

    if (this.caches.has(key)) {
      this.caches.delete(key)
    } else {
      if (this.caches.size >= this.max) {
        const firstKey = this.caches.keys().next().value
        // 拿到需要卸载的 vnode
        vnode = this.caches.get(firstKey)

        this.caches.delete(firstKey)
      }
    }

    this.caches.set(key, value)

    return vnode
  }
}
