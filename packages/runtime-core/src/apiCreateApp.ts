import { h } from './h'

export function createAppApi(render) {
  return function createApp(rootComponent, rootProps) {
    // app.use() provide
    const context = {
      // app 往后代组件使用 provide 注入的属性，会存到这里面
      provides: {},
    }

    const app = {
      context,
      _container: null,

      mount(container) {
        /**
         * 根组件
         * 要挂载的 container 容器
         */

        // 创建虚拟节点
        const vnode = h(rootComponent, rootProps)

        //  为根组件绑定 appContext
        vnode.appContext = context

        // 将虚拟节点挂载在容器上
        render(vnode, container)

        // 将容器备份一份，方便卸载
        app._container = container
      },

      // 卸载虚拟节点
      unmount() {
        render(null, app._container)
      },

      provide(key, value) {
        context.provides[key] = value
      },
    }

    return app
  }
}
