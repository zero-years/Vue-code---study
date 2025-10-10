import { ref } from '@vue/reactivity'
import { h } from './h'
import { isFunction } from '@vue/shared'

/**
 * 生成异步组件的函数，用来创建一个异步组件，该组件会在加载异步组件的函数执行完毕后加载
 * @param options 加载异步组件的函数 | 一个对象里面包含 loader 和 loadingComponent
 * @returns
 */
export function defineAsyncComponent(options) {
  // 如果是一个函数，则证明传入的参数是一个 loader ，需要进行标准化，方便后面解构执行
  // 如果是一个对象，则直接读取 options 对象中的 loader 即可
  if (isFunction(options)) {
    options = {
      loader: options,
    }
  }

  const defaultComponent = () => h('span', null, '')

  const {
    loader,
    loadingComponent = defaultComponent,
    errorComponent = defaultComponent,
    timeout,
  } = options

  return {
    setup(props, { attrs, slots }) {
      const component = ref(() => {
        return h(loadingComponent)
      })

      // 用来嵌套 loader ，从而能够实现超时功能
      function loadComponent() {
        return new Promise((resolve, reject) => {
          if (timeout && timeout > 0) {
            setTimeout(() => {
              // promsie 状态是不可逆的
              reject('超时')
            }, timeout)
          }

          // 如果在超时时间前，请求回来则调 resolve 否则为 reject
          loader().then(resolve, reject)
        })
      }

      loadComponent().then(
        comp => {
          console.log('comp ==>', comp)
          if (comp && comp[Symbol.toStringTag] === 'Module') {
            // @ts-ignore
            comp = comp.default
          }

          component.value = comp
        },
        err => {
          console.log(err)

          // 加载失败
          component.value = errorComponent
        },
      )

      return () => {
        return h(component.value, { ...props, ...attrs }, slots)
      }
    },
  }
}
