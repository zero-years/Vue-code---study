import { isArray, isObject } from 'packages/shared/src/index'
import { createVNode, isVnode } from './vnode'

/**
 * h 函数的使用方法
 *  - 1. h('div', 'hellow world') 第二个参数为子节点
 *  - 2. h('div', [h('span', 'hellow'), h('span', 'world')]) 第二个参数为子节点
 *  - 3. h('div', h('span', 'hello')) 第二个参数为子节点
 *  - 4. h('div', { class: 'container' }) 第二个参数为 props
 * -------- 三个参数 ---------
 *  - 5. h('div', { class: 'container' }, 'hellow world')
 *  - 6. h('div', { class: 'container' }, h('span', 'hellow world'))
 *  - 7. h('div', { class: 'container' }, h('span', 'hellow'), h('span', ' world'))
 *  - 8. h('div', { class: 'container' }, [h('span', 'hellow'), h('span', ' world')])
 */

export function h(type, propsOrChildren?, children?) {
  // h 函数主要的作用是对 createVNode 做一个参数标准化(归一化) ，不会产生一个虚拟节点
  let l = arguments.length

  if (l === 2) {
    if (isArray(propsOrChildren)) {
      return createVNode(type, null, propsOrChildren)
    }
    if (isObject(propsOrChildren)) {
      // 对象有两种: 虚拟节点 || props
      if (isVnode(propsOrChildren)) {
        // h('div', h('span', 'hello'))
        return createVNode(type, null, [propsOrChildren])
      }
      // h('div', { class: 'container' })
      return createVNode(type, propsOrChildren, children)
    }
    // h('div', 'hellow world')
    return createVNode(type, null, propsOrChildren)
  } else {
    if (l > 3) {
      // h('div', { class: 'container' }, h('span', 'hellow'), h('span', ' world'))
      // ==> h('div', { class: 'container' }, [h('span', 'hellow'), h('span', ' world')])
      children = [...arguments].slice(2)
    } else if (isVnode(children)) {
      // h('div', { class: 'container' }, h('span', 'hellow world'))
      children = [children]
    }
    return createVNode(type, propsOrChildren, children)
  }
}
