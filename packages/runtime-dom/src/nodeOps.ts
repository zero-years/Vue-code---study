/**
 * 封装 DOM 节点操作的 API
 */
export const nodeOps = {
  // 插入节点
  insert(el, parent, anchor) {
    // insertBefore 中第二个参数为觉得插入的位置，如果为 null 则插入在最后面
    parent.insertBefore(el, anchor || null)
  },
  // 创建元素
  createElement(type) {
    return document.createElement(type)
  },
  // 移除元素
  remove(el) {
    const parentNode = el.parentNode
    if (parentNode) {
      parentNode.removeChild(el)
    }
  },

  // 设置元素 text
  setElementText(el, text) {
    el.textContent = text
  },
  // 创建文本节点
  createText(text) {
    return document.createTextNode(text)
  },
  // 设置 node 节点的 nodeValue
  setText(node, text) {
    return (node.nodeValue = text)
  },
  // 获取元素的的父节点
  parentNode(el) {
    return el.parentNode
  },
  // 获取元素的下一个兄弟节点
  nextSibling(el) {
    return el.nextSibling
  },
  // 元素选择器 dom 查询
  querySelector(selector) {
    return document.querySelector(selector)
  },
}
