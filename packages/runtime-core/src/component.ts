import { proxyRefs } from '@vue/reactivity'
import { normalizePropsOptions, initProps } from './componentProps'
import { hasOwn, isFunction, isObject } from '@vue/shared'
import { nextTick } from './scheduler'
import { initSlots } from './componentSlots'

/**
 * 创建组件实例
 * @param vnode
 * @returns
 */
export function createComponentInstance(vnode) {
  const { type } = vnode
  const instance: any = {
    type,
    vnode,
    render: null,
    // setup 返回的内容
    setupState: {},
    // 用户声明的组件 props
    propsOptions: normalizePropsOptions(type.props),
    props: {},
    attrs: {},
    // 组件的插槽
    slots: {},
    refs: {},
    // 子树， render 的返回值
    subTree: null,
    // 组件是否已经挂载
    isMounted: false,
  }

  instance.ctx = { _: instance }

  // 将组件传递的事件(emit) 进行存储
  instance.emit = (event, ...args) => emit(instance, event, ...args)
  // 写法二: instance.emit = emit.bind(null, instance)  bind 第一位为 null 时，表示绑定为全局对象

  return instance
}

/**
 * 初始化组件状态
 */
export function setupComponent(instance) {
  /**
   * 1. 初始化属性
   * 2. 初始化插槽
   * 3. 初始化状态
   */

  // 初始化属性
  initProps(instance)

  // 初始化插槽
  initSlots(instance)

  // 初始化状态
  setupStatefulComponent(instance)
}

/**
 * 存储 attrs 、 slots 等，使得用户可以获取里面的数据
 */
const publicPropertiesMap = {
  $el: instance => instance.vnode.el,
  $attrs: instance => instance.attrs,
  $slots: instance => instance.slots,
  $refs: instance => instance.refs,
  $emit: instance => instance.emit,
  $nextTick: instance => {
    return nextTick.bind(instance)
  },
  $forceUpdate: instance => {
    return () => instance.update()
  },
}

const publicInstacneProxyHandlers = {
  get(target, key) {
    const { _: instance } = target

    const { setupState, props } = instance

    /**
     * 当访问某个属性时，先去 setupState 中找，再到 props 中找
     */

    if (hasOwn(setupState, key)) {
      return setupState[key]
    }

    if (hasOwn(props, key)) {
      return props[key]
    }

    /**
     * $attrs
     * $slots
     * $refs
     */
    if (hasOwn(publicPropertiesMap, key)) {
      const publicGetter = publicPropertiesMap[key]

      return publicGetter(instance)
    }

    // 如果实在没有就只能中整个实例中找
    return instance[key]
  },

  set(target, key, value) {
    const { _: instance } = target

    // 只能修改 setup 里面的数据，不能修改 props 中的数据
    const { setupState } = instance

    if (hasOwn(setupState, key)) {
      setupState[key] = value
    }

    return true
  },
}

function setupStatefulComponent(instance) {
  const type = instance.type

  // 创建代理对象，内部访问 setupState props $attrs $slots
  instance.proxy = new Proxy(instance.ctx, publicInstacneProxyHandlers)

  if (isFunction(type.setup)) {
    const setupContext = createSetUpContext(instance)

    // 保存 setupContext
    instance.setupContext = setupContext

    // 设置当前组件的实例
    setCurrentInstance(instance)

    // 执行 setup 函数
    const setupResult = type.setup(instance.props, setupContext)

    // 清除当前组件的实例
    unsetCurrentInstance()

    /**
     * setup 的返回值有两种，一种是返回存储数据的对象，另一种是一个函数
     * 如果 setup 的返回值是一个函数，则证明该函数是 render
     *
     * */
    handleSetupResult(instance, setupResult)
  }

  if (!instance.render) {
    // 上面处理完还没有 render 则需要到组件的配置中去拿 render
    // 将 render 绑定给 instance
    instance.render = type.render
  }
}

/**
 * 用来处理setup 的返回值，有两种情况，一种是返回存储数据的对象，另一种是一个函数
 * @param instance
 * @param setupResult
 */
function handleSetupResult(instance, setupResult) {
  if (isFunction(setupResult)) {
    // setup 返回的是函数，则为 render
    instance.render = setupResult
  } else if (isObject(setupResult)) {
    // setup 返回的是对象，则为 状态
    // 拿到 setup 返回的状态
    instance.setupState = proxyRefs(setupResult)
  }
}

/**
 * 创建 setUpContext(当前组件的参数)
 * 将 attrs | solt | emit 等，生成然后传递给 setup 方法
 * @param instance
 * @returns
 */
function createSetUpContext(instance) {
  return {
    // 处理 props 之外的属性
    get attrs() {
      return instance.attrs
    },
    // 处理事件
    emit(event, ...args) {
      emit(instance, event, ...args)
    },
    // 处理插槽
    slots: instance.slots,
  }
}

/**
 * 将 父组件传递给子组件的事件进行处理，从而使得其能在子组件中调用，调用方法为: 父组件: onFoo(...args){} ==> 子组件: emit('foo', ...args)
 * 由于 emit 同时需要放置到 instance 中，因此将整个执行逻辑进行封装，从而复用
 * @param instance
 * @param event
 * @param args
 */
function emit(instance, event, ...args) {
  /**
   * 1.转换事件名
   *  foo => onFoo
   *  bar => onBar
   * 2. 拿到事件
   * 3. 如果事件是一个函数则调用
   */

  // foo: event[0] = f   event.slice(1) = oo
  const eventName = `on${event[0].toUpperCase() + event.slice(1)}`

  const handler = instance.vnode.props[eventName]

  if (isFunction(handler)) {
    handler(...args)
  }
}

/**
 * 当前组件的实例
 */
let currentInstance = null

/**
 * 将当前组件的实例设置好
 * @param instance
 */
export function setCurrentInstance(instance) {
  currentInstance = instance
}

/**
 * 获取当前组件的实例，没有则返回 null
 * @returns
 */
export function getCurrentInstance() {
  return currentInstance
}

/**
 * 清除组件实例
 */
function unsetCurrentInstance() {
  currentInstance = null
}
