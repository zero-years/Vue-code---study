import {
  getCurrentInstance,
  setCurrentInstance,
  unsetCurrentInstance,
} from './component'

export enum LifeCycleHooks {
  // 挂载 instance.bm
  BEFORE_MOUNT = 'bm',
  MOUNTED = 'm',

  // 更新
  BEFORE_UPDATE = 'bu',
  UPDATED = 'u',

  // 卸载
  BEFORE_UNMOUNTED = 'bum',
  UNMOUNTED = 'um',
}

/**
 * 用来创建生命周期函数的
 * @param type
 * @returns
 */
function createHook(type) {
  return (hook, target = getCurrentInstance()) => {
    injectHook(target, hook, type)
  }
}

/**
 * 注入生命周期，将回调函数放到实例上对应的生命周期标记中
 * @param target 当前组件的实例
 * @param hook 用户传递的回调函数
 * @param type 生命周期 'bm' 'bum'
 */
function injectHook(target, hook, type) {
  // 一开始实例上的这个生命周期中没有值，则将其设置为数组，然后将需要执行的函数 push 进去
  if (target[type] == null) {
    target[type] = []
  }

  // 将 hook 进行包装，确保用户可以在生命周期函数中访问到实例
  const _hook = () => {
    // 将当前的实例进行设置，从而使得能够在生命周期中获取到
    setCurrentInstance(target)

    // 执行生命周期的回调函数
    hook()

    // 清空实例
    unsetCurrentInstance
  }

  // 将该生命周期类型中的 回调函数 放置到数组中
  target[type].push(_hook)
}

/**
 * 触发相应的生命周期函数
 * @param instance 当前的组件实例
 * @param type 生命周期的类型
 */
export function triggerHooks(instance, type) {
  // 拿到当前需要触发的生命周期类型
  const hooks = instance[type]

  // 有则依次执行
  if (hooks) {
    // getCurrentInstance(instance)
    setCurrentInstance(instance)
    try {
      hooks.forEach(hook => hook())
    } finally {
      unsetCurrentInstance()
    }
  }
}

/**
 * 组件的生命周期
 *
 * 挂载
 * onBeforeMount
 * onMounted
 *
 * 更新
 * onBeforeUpdate
 * onUpdated
 *
 * 卸载
 * onBeforeUnmount
 * onUnmounted
 *
 */
// 挂载
export const onBeforeMount = createHook(LifeCycleHooks.BEFORE_MOUNT)
export const onMounted = createHook(LifeCycleHooks.MOUNTED)

// 更新
export const onBeforeUpdate = createHook(LifeCycleHooks.BEFORE_UPDATE)
export const onUpdated = createHook(LifeCycleHooks.UPDATED)

// 卸载
export const onBeforeUnmount = createHook(LifeCycleHooks.BEFORE_UNMOUNTED)
export const onUnmounted = createHook(LifeCycleHooks.UNMOUNTED)
