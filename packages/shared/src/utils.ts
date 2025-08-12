export function isObject(value) {
  return typeof value == 'object' && value !== null
}

/**
 * 判断值是否变化。是为 true
 * @param newValue 新值
 * @param oldValue 老值
 * @returns
 */
export function hasChanged(newValue, oldValue) {
  return !Object.is(newValue, oldValue)
}

/**
 * 判断值是否为函数，是为 true
 */
export function isFunction(value) {
  return typeof value === 'function'
}

/**
 * 判断值是否为 string
 * @param value
 * @returns
 */
export function isString(value) {
  return typeof value === 'string'
}

/**
 *  判断是否为事件
 *  事件在 vue 的开头都是 onXxx ==> onClick ，因此通过正则去提取前三位，然后通过 test 方法去检索 key 中是否存在，存在则返回 true
 *
 * @param key
 * @returns
 */
export function isOn(key) {
  return /^on[A-Z]/.test(key)
}

/**
 * 判断是否为数字
 * @param value
 * @returns
 */
export function isNumber(value) {
  return typeof value === 'number'
}

// 判断是否为数组
export const isArray = Array.isArray

/**
 * 判断当前对象中是否存在 key 相关的属性
 * @param object
 * @param key
 * @returns
 */
export function hasOwn(object = {}, key) {
  return Object.hasOwn(object, key)
}
