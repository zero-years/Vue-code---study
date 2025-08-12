import { isOn } from 'packages/shared/src/utils'
import { patchClass } from './modules/patchClass'
import { patchStyle } from './modules/patchStyle'
import { patchEvent } from './modules/event'
import { patchAttr } from './modules/patcchAttr'

/**
 * 更新属性的函数
 * key 可能的值
 * 1. class 样式名
 * 2. style 样式
 * 3. event 事件
 * 4. attrs
 *
 * @param el
 * @param key
 * @param preValue
 * @param nextValue
 */
export function patchProp(el, key, preValue, nextValue) {
  if (key === 'class') {
    return patchClass(el, nextValue)
  }
  if (key === 'style') {
    return patchStyle(el, preValue, nextValue)
  }

  // @click => onClick
  if (isOn(key)) {
    return patchEvent(el, key, nextValue)
  }

  patchAttr(el, key, nextValue)
}
