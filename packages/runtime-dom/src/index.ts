export * from '@vue/runtime-core'

import { isString } from '@vue/shared'
import { nodeOps } from './nodeOps'
import { patchProp } from './patchProp'
import { createRenderer } from '@vue/runtime-core'

// createRenderer(nodeOps)

const renderOptions = { patchProp, ...nodeOps }

const renderer = createRenderer(renderOptions)

export function render(vNode, container) {
  renderer.render(vNode, container)
}

export function createApp(rootComponent, rootProps) {
  const app = renderer.createApp(rootComponent, rootProps)
  const _mount = app.mount.bind(app)

  // 拦截 app.mount ，使得可以通过传递选择器去挂载，不然只能为 DOM 元素去挂载
  function mount(selector) {
    let el = selector
    if (isString(selector)) {
      el = document.querySelector(selector)
    }
    _mount(el)
  }
  app.mount = mount

  return app
}

export { renderOptions }
