import { hasChanged, isObject } from 'packages/shared/src/utils'
import { activeSub, ReactiveEffect } from './effect'
import { Dependency, link, propagate, Link } from './system'
import { reactive, isReactive } from './reavtive'

export enum ReactiveFlags {
  IS_REF = '__v_isRef',
}

/**
 * ref 的类 用来保存值
 */
class RefImpl implements Dependency {
  // 保存实际的值
  _value

  // 订阅者链表的头节点，理解为链表中的 head
  subs: Link

  // 订阅者链表的尾节点，理解为链表中的 tail
  subsTail: Link;

  // ref 的标记，证明是 ref
  [ReactiveFlags.IS_REF] = true

  constructor(value) {
    //  如果 value 是一个对象则使用 reactive 转换为响应式
    this._value = isObject(value) ? reactive(value) : value
  }

  get value() {
    // 收集依赖
    if (activeSub) {
      trackRef(this)
    }
    return this._value
  }

  set value(newValue) {
    // 只有值发生变化才触发更新
    if (hasChanged(newValue, this._value)) {
      // 触发更新
      // 如果 newValue 是一个对象则使用 reactive 转换为响应式
      this._value = isObject(newValue) ? reactive(newValue) : newValue
    }

    triggerRef(this)
  }
}

/**
 *  ref 函数
 */
export function ref(value) {
  return new RefImpl(value)
}

/**
 * isref 函数
 * 判断是否为 ref
 */
export function isRef(value) {
  return !!(value && value[ReactiveFlags.IS_REF])
}

/**
 * 收集 ref 的相关依赖，并且建立 ref 与 effect 之间的链表关系
 * @param dep
 */
export function trackRef(dep) {
  if (activeSub) {
    link(dep, activeSub)
  }
}

/**
 * 触发 ref 关联的 effect 重新执行
 * @param dep
 */
export function triggerRef(dep) {
  if (dep.subs) {
    propagate(dep.subs)
  }
}

class ObjectRefImpl {
  [ReactiveFlags.IS_REF] = true

  constructor(
    public _object,
    public _key,
  ) {}

  get value() {
    return this._object[this._key]
  }

  set value(newVal) {
    this._object[this._key] = newVal
  }
}
/**
 * 将一个对象内的某个值单独提取出来作为响应式数据
 * @param target 对象
 * @param key 值
 * @returns
 */
export function toRef(target, key) {
  return new ObjectRefImpl(target, key)
}

/**
 * 将一个响应式对象里的所有属性转换为响应式数据，并放在一个对象中给用户提取
 * @param target 要从中提取的对象
 * @returns
 */
export function toRefs(target) {
  if (!isReactive(target)) {
    console.warn('传入的值，必须为响应式对象')
  }

  const res = {}

  for (const key in target) {
    res[key] = new ObjectRefImpl(target, key)
  }

  // 返回一个具有原先 target 里面的所有值的对象。并且该对象的每个值都需要变为 ObjectRefImple
  return res
}

/**
 * 如果参数是 ref，则返回内部值，否则返回参数本身
 * @param value
 * @returns
 */
export function unRef(value) {
  return isRef(value) ? value.value : value
}

/**
 * 让这个响应式对象里面的值不需要再通过 .value 去读取
 *
 * AS: state.a.value ==> state.a
 *
 * @param target
 * @returns
 */
export function proxyRefs(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      /**
       * 自动解包 ref
       * 如果 target[key] 是一个 ref 则返回 ref.value ，否则返回 target[key]
       */

      const res = Reflect.get(target, key, receiver)

      return unRef(res)
    },
    set(target, key, newValue, receiver) {
      const oldValue = target[key]
      // 如果更新 reactive 里面 a 的值之前是个 ref ，且新的 ref 不是一个 ref 。则需要同步修改 始 a 的 ref 的值为 newValue
      // 如果更新的 newValue 是一个 ref ，那就不需要同步更新
      if (isRef(oldValue) && !isRef(newValue)) {
        /**
         * const a = ref(0)
         * target = { a}
         *
         * target.a = 1 就可以看作 a.value = 1
         * a.value = 1
         */
        oldValue.value = newValue
        return true
      }

      return Reflect.set(target, key, newValue, receiver)
    },
  })
}
