import { getCurrentInstance } from './component'

/**
 * 注入 provide ，将属性设置到当前组件的 provides 中
 * @param key
 * @param value
 */
export function provide(key, value) {
  // count = 0

  // 首次调用的时候，instance.provides 为 parent.provides
  const instance = getCurrentInstance()

  // 拿到父组件的 privides ， 如果没有父组件，则该组件为根组件，则拿 appContext 中的 privides
  const parentProvides = instance.parent
    ? instance.parent.provides
    : instance.appContext.provides

  // 自己的 provides
  let provides = instance.provides

  // 证明在这个 provide 之前，当前组件内没有 provide 任何东西，因此拿的是父组件中的 provides
  if (parentProvides === provides) {
    instance.provides = Object.create(parentProvides)
    provides = instance.provides
  }

  // 设置属性设置到 provides 上
  provides[key] = value
}

export function inject(key, defaultValue) {
  const instance = getCurrentInstance()

  // 拿到父组件的 privides ， 如果没有父组件，则该组件为根组件，则拿 appContext 中的 privides
  const parentProvides = instance.parent
    ? instance.parent.provides
    : instance.appContext.provides

  // 如果父组件的 provides 中有，则返回父组件中的值，否则返回默认值
  if (key in parentProvides) {
    return parentProvides[key]
  }

  return defaultValue
}
