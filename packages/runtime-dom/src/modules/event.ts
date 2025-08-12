const veiKey = Symbol('_vei')

/**
 * 对元素绑定相应的事件
 *
 * const fn1 = ()=>{ console.log('更新前')}
 * const fn2 = ()=>{ console.log('更新后')}
 * 这样重复的增删事件会比较浪费性能
 *
 * click el.addEventListener('click', (e) => { fn1(e)})
 * 通过更换要调用的函数来减少重复解绑事件
 */
export function patchEvent(el, rawName, nextValue) {
  const name = rawName.slice(2).toLowerCase()

  const invokers = (el[veiKey] ??= {}) // 为简写 el._vei = el._vei ?? {}

  // 原先是否已经有绑定过的事件
  const exisitingInvoker = invokers[rawName]

  if (nextValue) {
    // 如果原先有则直接将 exisitingInvoker = invokers[rawName] = invoker.value 的值替换为新的值，从而完成事件的换绑
    if (exisitingInvoker) {
      // 下一次进来应该是有值的
      exisitingInvoker.value = nextValue

      return
    }

    // 如果原先没有，则需要创建一个 invoker ，它是一个需要绑定的函数，但其执行函数可以直接通过 invoker.value 修改，从而只需要改变该值，即可改变需要执行的事件函数
    const invoker = createInvoker(nextValue)

    // 将 invoker 放到 invokers = el._vei 中
    invokers[rawName] = invoker

    // 绑定事件，事件的处理函数是 invoker.value 可以通过修改来改变执行的函数
    el.addEventListener(name, invoker)
  } else {
    // 如果新节点中没有事件，而老节点中有，则要移除事件
    if (exisitingInvoker) {
      el.removeEventListener(name, exisitingInvoker)
      invokers[rawName] = undefined
    }
  }
}

/**
 *  创建一个事件处理函数，内部调用 invoker.value
 *  如果需要更新事件，则直接修改 invoker.value 从而对事件进行换绑
 *
 *
 * @param value 接受的函数
 * @returns
 */
function createInvoker(value) {
  const invoker = e => {
    invoker.value(e)
  }
  invoker.value = value
  return invoker
}
