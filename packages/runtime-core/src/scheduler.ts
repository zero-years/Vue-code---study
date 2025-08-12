const resolvePromise = Promise.resolve()

/**
 * 将用户传递的函数放到微任务中，此函数用于由于渲染函数是异步，因此有时候一些需要对更新后的数据进行操作的函数中出现数据不对称的情况(一般是函数内的数据还是原先的数据)
 *
 * @param fn
 * @returns
 */
export function nextTick(fn) {
  return resolvePromise.then(() => {
    fn.call(this)
  })
}

/**
 * 把渲染函数放到微任务中，渲染函数是当数据更新一次就会触发一次
 * @param job
 */
export function queueJob(job) {
  // 这里 promise 外的 job 也只会执行一次，因为它本身的 dirty 的属性在更新前会被设置为脏，但由于该函数被放入到异步队列中，因此该函数还没更新完，固不会再触发一次更新函数
  resolvePromise.then(() => {
    job()
  })
}
