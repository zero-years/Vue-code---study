import { isArray, hasOwn } from '@vue/shared'
import { reactive } from '@vue/reactivity'

/**
 * 标准化 props ，当用户传入的 props 为数组时，将他转换为对象
 * @param props
 * @returns
 */
export function normalizePropsOptions(props: {}) {
  // 当 props 为数组时，把他转换为对象
  if (isArray(props)) {
    // 把数组转换为对象，值无所谓  ['msg', 'count] => { msg: true, count: true }
    return props.reduce((prev, cur) => {
      prev[cur] = {}

      return prev
    }, {})
  }

  return props
}

/**
 * 初始化属性
 * @param instacne
 */
export function initProps(instance) {
  // 拿到用户传递过来的 props
  const { vnode } = instance
  const rawProps = vnode.props

  // 将 props 分为 props 和 attrs
  // 1. props: 由用户声明的内容就是 props
  // 2. attrs: 用户
  const props = {}
  const attrs = {}

  // 对 props 进行分类
  setFullProps(instance, rawProps, props, attrs)

  // 处理完毕后将 props 和 attrs 都放到组件实例上
  // props 是响应式的，因此需要 reactive
  instance.props = reactive(props)

  // attrs 不是响应式的
  instance.attrs = attrs
}

/**
 * 设置所有的 props attrs，将用户传入的 props 根据是否已经被用户声明过进行分类
 * @param instance
 * @param rawProps
 * @param props
 * @param attrs
 */
function setFullProps(instance, rawProps, props, attrs) {
  const propsOptions = instance.propsOptions

  if (rawProps) {
    for (const key in rawProps) {
      const value = rawProps[key]
      if (hasOwn(propsOptions, key)) {
        // 如果用户声明的 propsOptions 中有当前的 key 值，就放到 props 中
        props[key] = value
      } else {
        // 否则就放到 attrs 中
        attrs[key] = value
      }
    }
  }
}

/**
 * 更新子组件中的属性
 * @param instance
 * @param nextVnode
 */
export function updateProps(instance, nextVnode) {
  const { props, attrs } = instance

  const rawProps = nextVnode.props

  // 设置所有的新的属性
  setFullProps(instance, rawProps, props, attrs)

  // 把新的没有，老的有的东西删除
  // old: { msg: '123', age:0} ==> new: { msg:'123 }
  for (const key in props) {
    if (!hasOwn(rawProps, key)) {
      delete props[key]
    }
  }
  for (const key in attrs) {
    if (!hasOwn(rawProps, key)) {
      delete attrs[key]
    }
  }
}
