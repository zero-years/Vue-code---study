export const isTeleport = type => type.__isTeleport

export const Teleport = {
  name: 'Teleport',
  __isTeleport: true,
  props: {
    to: {
      // 当前 teleport 要挂载到哪个容器上
      type: String,
    },
    disabled: {
      /**
       * 是否禁用 teleport ，如果禁用则把子节点挂载到 container 上(也就是下方的外部的 div 上s)
       * h('div', [
       *     h('p', { id: 'container', ref: 'elRef' }, '我是父组件的p标签'),
       *     h(
       *       Teleport,
       *       { to: 'body', disabled: true },
       *       h('div', '我是 Teleport 的子节点'),
       *     ),
       *   ])
       */
      type: Boolean,
    },
  },
  process(n1, n2, container, anchor, parentComponent, internals) {
    const {
      mountChildren,
      patchChildren,
      options: { querySelector, insert },
    } = internals

    /**
     * 1. 挂载
     * 2. 更新
     */
    const { disabled, to } = n2.props

    // 挂载
    if (n1 == null) {
      /**
       * 挂载的逻辑:
       * 把 n2.children 挂载在 选择器为 to 的容器中
       */

      // 如果禁用，则挂载到 container 中，否则挂载到 to 查询到的元素中
      const target = disabled ? container : querySelector(to)

      if (target) {
        // 将 el 进行存储
        n2.target = target

        // 把 n2.children 挂载到目标元素上
        mountChildren(n2.children, target, parentComponent)
      }
    } else {
      // 更新
      patchChildren(n1, n2, n1.target, parentComponent)
      n2.target = n1.target

      const preProps = n1.props

      // 如果两次的 to 不一样，则需要将旧节点上的内容移动到新节点上
      if (preProps.to !== to || preProps.disabled !== disabled) {
        /**
         * to 发生变化: 获取新的 target 然后移动到新的 target 上
         * disabled 发生变化: 判断是否禁用，从而决定放到 container 还是 to 上
         */
        const target = disabled ? container : querySelector(to)

        for (const child of n2.children) {
          insert(child.el, target)
        }

        // 重置 target
        n2.target = target
      }
    }
  },
}
