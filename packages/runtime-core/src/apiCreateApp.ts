import { h } from './h'

export function createAppApi(render) {
  return function createApp(rootComponent, rootProps) {
    const app = {
      _container: null,

      mount(container) {
        /**
         * 根组件
         * 要挂载的 container 容器
         */

        // 创建虚拟节点
        const vnode = h(rootComponent, rootProps)

        // 将虚拟节点挂载在容器上
        render(vnode, container)

        // 将容器备份一份，方便卸载
        app._container = container
      },

      // 卸载虚拟节点
      unmount() {
        render(null, app._container)
      },
    }

    return app
  }
}
