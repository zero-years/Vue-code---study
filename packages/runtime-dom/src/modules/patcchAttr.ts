/**
 * 新增或删除属性名
 * @param el
 * @param key
 * @param value
 */
export function patchAttr(el, key, value) {
  if (value == undefined) {
    // null | undefined 那就理解为要移除

    el.removeAttribute(key)
  } else {
    el.setAttribute(key, value)
  }
}
