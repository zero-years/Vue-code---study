import { ShapeFlags } from '@vue/shared'
import { ReactiveEffect } from '@vue/reactivity'
import { isSameVNodeType, normalizeVnode, Text } from './vnode'
import { createAppApi } from './apiCreateApp'
import { createComponentInstance, setupComponent } from './component'
import { queueJob } from './scheduler'
import {
  renderComponentRoot,
  shouldUpdateComponent,
} from './componentRenderUtils'
import { updateProps } from './componentProps'
import { updateSlots } from './componentSlots'
import { triggerHooks, LifeCycleHooks } from './apiLifecycle'
import { setRef } from './renderTemplateRef'

export function createRenderer(options) {
  /**
   * 提供能够使得 虚拟节点(vnode) 渲染到页面上的功能
   */

  const {
    createElement: hostCreateElement,
    insert: hostInsert,
    remove: hostRemove,
    setElementText: hostSetElementText,
    createText: hostCreateText,
    setText: hostSetText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    patchProp: hostPatchProp,
  } = options

  /**
   * 当挂载的节点的子节点为一个数组时，调用此函数来挂载数组中的子节点
   * @param children
   * @param el
   */
  const mountChildren = (children, el, parentComponent) => {
    for (let i = 0; i < children.length; i++) {
      // 如果 children 为字符串则将它转换为对象
      const child = (children[i] = normalizeVnode(children[i]))

      // 通过递归去挂载子节点
      patch(null, child, el, null, parentComponent)
    }
  }

  /**
   * 挂载节点的方法
   * @param vnode 要挂载的节点
   * @param container 挂载的容器
   */
  const mountElement = (vnode, container, anchor = null, parentComponent) => {
    /**
     * 1. 创建 dom 节点
     * 2. 设置它的 props
     * 3. 挂载它的子节点
     */

    const { type, props, children, shapeFlag } = vnode

    //创建 dom 节点 ,创建 div,span 等
    const el = hostCreateElement(type)

    // 将当前 vnode 中的 el 进行更新，使得在 更新和卸载时具有一个内容可以复用
    vnode.el = el

    // 设置 props
    if (props) {
      for (const key in props) {
        hostPatchProp(el, key, null, props[key])
      }
    }

    // 处理子节点
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 子节点为文本
      hostSetElementText(el, children)
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 子节点是数组
      mountChildren(children, el, parentComponent)
    }

    // 挂载子节点，把 el 插入 container 中
    hostInsert(el, container, anchor)
  }

  /**
   * 递归卸载子节点需要用到的函数
   * @param children 需要删除的子节点，为一个数组
   */
  const unmountChildren = children => {
    for (let i = 0; i < children.length; i++) {
      unmount(children[i])
    }
  }

  /**
   * 卸载组件实例
   * @param instance
   */
  const unmountComponent = instance => {
    // 生命周期卸载前
    triggerHooks(instance, LifeCycleHooks.BEFORE_UNMOUNTED)

    // 把 subTree 卸载掉
    unmount(instance.subTree)

    // 生命周期卸载后
    triggerHooks(instance, LifeCycleHooks.UNMOUNTED)
  }

  /**
   * 卸载节点用的函数
   * @param vnode 要卸载的节点
   */
  const unmount = vnode => {
    const { shapeFlag, children, ref } = vnode

    if (shapeFlag & ShapeFlags.COMPONENT) {
      // 子节点为组件
      unmountComponent(vnode.component)
    } else if (shapeFlag & ShapeFlags.TELEPORT) {
      // teleport 卸载，就是卸载它的子节点
      unmountChildren(children)
      return
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 子节点为数组，需要递归卸载
      unmountChildren(children)
    }

    // 将当前节点删除掉
    hostRemove(vnode.el)

    if (ref != null) {
      setRef(ref, null)
    }
  }

  /**
   * 更新节点
   * @param el
   * @param oldProps
   * @param newProps
   */
  const patchProps = (el, oldProps, newProps) => {
    /**
     * 1. 把老的 props 全部删除
     * 2. 把新的 props 全部设置上
     */
    if (oldProps) {
      // 把老的 props 全部删除
      for (const key in oldProps) {
        hostPatchProp(el, key, oldProps[key], null)
      }
    }

    if (newProps) {
      for (const key in newProps) {
        hostPatchProp(el, key, oldProps?.[key], newProps[key])
      }
    }
  }

  /**
   * 更新子节点
   * @param n1
   * @param n2
   */
  const patchChildren = (n1, n2, el, parentComponent) => {
    /**
     * 1. n2 的子节点素为文本
     *  - 1.1 老的子节点是数组，新的是文本
     *  - 1.2 老的子节点是文本，新的也是文本
     * 2. n2 的子节点是 数组 或者 null
     *  - 2.1 老的子节点是文本，新的是数组
     *  - 2.2 老的子节点是数组，新的也是数组
     *  - 2.3 老的可能是 null
     */
    const prevShapeFlag = n1.shapeFlag
    const shapeFlag = n2.shapeFlag

    // 新的节点是文本
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 老的是数组，需要卸载掉老的
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(n1.children)
      }

      if (n1.children !== n2.children) {
        // 如果 n1 和 n2 的 children 不一样。直接设置文本
        hostSetElementText(el, n2.children)
      }
    } else {
      // 新的有可能是 数组 或者 null
      // 老的也有可能是 数组 或者 null
      if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
        // 老的是文本
        // 把老内容删除
        hostSetElementText(el, '')

        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 挂载新的节点
          mountChildren(n2.children, el, parentComponent)
        }
      } else {
        // 老的是 数组 或者 null
        // 新的是 数组 或者 null
        if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 老的是数组
          if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
            // 新的是数组，老的也是数组，全量 diff
            patchKeyedChildren(n1.children, n2.children, el, parentComponent)
          } else {
            // 新的是 null，卸载老的 数组
            unmountChildren(n1.children)
          }
        } else {
          // 老的是 null
          if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
            // 新的是数组，挂载新的
            mountChildren(n2.children, el, parentComponent)
          }
        }
      }
    }
  }

  const patchKeyedChildren = (c1, c2, container, parentComponent) => {
    /**
     * 全量 DIFF
     * 1. 双端 diff
     *
     * 1.1 头部对比
     * c1 = [a, b]
     * c2 = [a, b, c]
     *
     * 开始时的参数: i = 0 , e1 = 1, e2 = 2
     * 结束时的参数: i = 2 , e1 = 1, e2 = 2
     *
     * 1.2 尾部对比
     * c1 = [a, b]
     * c2 = [c, a, b]
     *
     * 开始时的参数: i = 0 , e1 = 1, e2 = 2
     * 结束时的参数: i = 0 , e1 = -1, e2 = 0
     *
     * 2. 乱序 diff
     * c1 = [a, b, c, d, e]
     * c2 = [a, c, d, b, e]
     *
     * 开始时的参数: i = 0 , e1 = 4, e2 = 4
     * 双端对比完时的参数: i = 1 , e1 = 3 , e2 = 3
     */

    // 开始对比的下标(指针)
    let i = 0

    // e1(旧节点) 的最后一个元素的下标
    let e1 = c1.length - 1

    // e2(新节点) 的最后一个元素的下标
    let e2 = c2.length - 1

    /**
     * 头部对比
     * c1 = [a, b]
     * c2 = [a, b, c]
     *
     * 开始时的参数: i = 0 , e1 = 1, e2 = 2
     * 结束时的参数: i = 2 , e1 = 1, e2 = 2
     */
    while (i <= e1 && i <= e2) {
      const n1 = c1[i]
      const n2 = (c2[i] = normalizeVnode(c2[i]))

      if (isSameVNodeType(n1, n2)) {
        // n1 与 n2 是同一个子节点，则可以更新，更新完后继续对比下一个元素
        patch(n1, n2, container, null, parentComponent)
      } else {
        break
      }

      i++
    }

    /**
     * 尾部对比
     * c1 = [a, b]
     * c2 = [c, a, b]
     *
     * 开始时的参数: i = 0 , e1 = 1, e2 = 2
     * 结束时的参数: i = 0 , e1 = -1, e2 = 0
     */
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1]
      const n2 = (c2[e2] = normalizeVnode(c2[e2]))

      if (isSameVNodeType(n1, n2)) {
        // n1 与 n2 是同一个子节点，则可以更新，更新完后继续对比上一个元素
        patch(n1, n2, container, null, parentComponent)
      } else {
        break
      }

      e1--
      e2--
    }

    // 当 i 比 e1 大，意味着新的节点中的元素比老的节点中的元素多，要挂载新的节点
    if (i > e1) {
      // 拿到锚点的位置，从而方便插入
      const nextPosition = e2 + 1

      const anchor = nextPosition < c2.length ? c2[nextPosition].el : null

      // 新的内容的范围是 i - e2
      while (i <= e2) {
        patch(
          null,
          (c2[i] = normalizeVnode(c2[i])),
          container,
          anchor,
          parentComponent,
        )
        i++
      }
    } else if (i > e2) {
      // 根据双端对比得出结果，i > e2，意味着新节点中的元素比老节点中的元素少，要卸载元素
      // 卸载的范围在 i - e1
      while (i <= e1) {
        unmount(c1[i])
        i++
      }
    } else {
      /**
       * 2. 乱序 diff
       * c1 = [a, b, c, d, e]
       * c2 = [a, c, d, b, e]
       *
       * 开始时的参数: i = 0 , e1 = 4, e2 = 4
       * 双端对比完时的参数: i = 1 , e1 = 3 , e2 = 3
       *
       * 找到 key 相同的虚拟节点，然后去 patch 一下
       * 需要查找的范围为 i - e1 和 i - e2
       */

      // 旧节点中的 i
      let s1 = i

      // 新节点中的 i
      let s2 = i

      /**
       * 做一份新的子节点的 key 与 index 之间的映射关系
       * map = {
       *  c：1，
       *  d: 2,
       *  b: 3,
       * }
       */
      const keyToNewIndexMap = new Map()

      // 一个存储需要进行求最长递增子序列的数组
      const newIndexToOldIndexMap = new Array(e2 - s2 + 1)

      // 先全部填充 -1 ，后面值为 -1 时表示不是同时在新旧节点上的，有可能是新增的。因此不需要计算
      newIndexToOldIndexMap.fill(-1)

      // 遍历 s2 到 e2 之间的元素，然后将他们存储到一份 键名为: key ，键值为 index 的 map
      for (let j = s2; j <= e2; j++) {
        // 从新节点中拿取当前索引对应的元素，然后存到 map 中
        const n2 = (c2[j] = normalizeVnode(c2[j]))
        keyToNewIndexMap.set(n2.key, j)
      }

      let pos = -1

      // 是否需要去计算然后移动
      let move = false

      for (let j = s1; j <= e1; j++) {
        // 从旧节点中拿取当前索引对应的节点，然后判断 map 中是否具有相同 key 值的节点
        const n1 = c1[j]
        const newIndex = keyToNewIndexMap.get(n1.key)

        // 有则获取他的索引，然后再从 新节点链 中获取出元素进行 patch
        if (newIndex !== null) {
          if (newIndex > pos) {
            // 如果当前项比上一个大，意味着当前是处于递增中，不需要移动。然后需要将 pos 设置为当前项，方便继续对比
            pos = newIndex
          } else {
            //  如果当前项比上一个小，意味着已经不是递增序列，从而需要进行移动
            move = true
          }
          newIndexToOldIndexMap[newIndex] = j

          // patch 更新
          patch(n1, c2[newIndex], container, null, parentComponent)
        } else {
          // 如果没有则表示老的有，新的没有，需要卸载该元素
          unmount(n1)
        }
      }

      // 如果 move 为 false 则表示不需要移动，就不计算
      const newIndexSequence = move ? getSequence(newIndexToOldIndexMap) : []
      // 更换为 Set 采用 hash 表，性能更好
      const sequenctSet = new Set(newIndexSequence)

      /**
       * 1. 遍历新的子元素，调整顺序
       * 不需要关心原先的顺序，只需要按照新的元素的顺序从后往前插入即可
       *
       * 2. 新的有，老的没有则没办法复用，需要挂载新的元素
       */
      for (let j = e2; j >= s2; j--) {
        // 倒序插入，从后往前
        const n2 = c2[j]

        // 拿到下一个子元素，从而插入到它前面
        const anchor = c2[j + 1]?.el || null

        // n2.el 存在，意味着该元素之前已经 patch 过(可以理解为已经挂载过)
        if (n2.el) {
          // 需要移动在进去
          if (move) {
            // 当 j 不在最长递增子序列中时进行移动，在则不需要移动
            if (!sequenctSet.has(j)) {
              // 依次进行倒序插入，保证顺序
              hostInsert(n2.el, container, anchor)
            }
          }
        } else {
          // 该元素是个新元素
          patch(null, n2, container, anchor, parentComponent)
        }
      }
    }
  }

  /**
   * 更新节点时用到的函数
   * @param n1 旧节点
   * @param n2 新节点
   */
  const patchElement = (n1, n2, parentComponent) => {
    /**
     * 1. 复用 dom 元素
     * 2. 更新 props
     * 3. 更新 children
     */

    // 复用 dom 元素，每次进来都将上一次的 el ，保存到最近的节点上，从而实现复用
    const el = (n2.el = n1.el)

    // 更新
    const oldProps = n1.props
    const newProps = n2.props
    patchProps(el, oldProps, newProps)

    // 更新 children
    patchChildren(n1, n2, el, parentComponent)
  }

  /**
   * 更新、挂载 都用这个函数
   * @param n1 老节点，之前的，如果有，表示要跟 n2 做 diff，更新，如果没有，表示直接挂载 n2
   * @param n2 新节点
   * @param container 挂载到的容器
   * @param parentComponent 父组件
   */
  const patch = (n1, n2, container, anchor = null, parentComponent = null) => {
    if (n1 === n2) {
      // 如果是同一个虚拟节点，则啥都不干
      return
    }

    /**有几种情况需要触发特殊的更新
     * 1. 节点的类型发生改变  AS: div ==> p
     * 2. 节点的 props 中的 key 发生改变，这种情况一般发生在 v-for 中的 key 值，同时用户也可以自己在节点中增加 key。 const vnode1 = h('div', { style: { color: 'red' }, key: 1 }, 'hello world')
     */
    if (n1 && !isSameVNodeType(n1, n2)) {
      // 比如说: n1 = div | n2 = span 。或者 n1.key = 1 | n2.key = 2 都需要特殊的更新
      // 在卸载 n1 之前，先拿到 n1 的 anchor
      anchor = hostNextSibling(n1.el)

      // 不一样则卸载 n1 ，重新挂载 n2
      unmount(n1)
      // 将 n1 设置为 null 触发下面的重新挂载
      n1 = null
    }

    /**
     * 文本，元素，组件
     */
    const { shapeFlag, type, ref } = n2

    switch (type) {
      case Text:
        processText(n1, n2, container, anchor)
        break
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          // 处理 DOM 元素: div span p h1
          // 元素也需要将父组件传过去，因为有可能出现以下情况 <div><Child></Child></div>
          processElement(n1, n2, container, anchor, parentComponent)
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          // 组件
          processComponent(n1, n2, container, anchor, parentComponent)
        } else if (shapeFlag & ShapeFlags.TELEPORT) {
          type.process(n1, n2, container, anchor, parentComponent, {
            mountChildren,
            patchChildren,
            options,
          })
        }
    }

    if (ref != null) {
      setRef(ref, n2)
    }
  }

  /**
   * 判断两个组件是否相同，相同则更新组件，不同则不更新
   * @param n1
   * @param n2
   */
  const updateComponent = (n1, n2) => {
    const instance = (n2.component = n1.component)

    /**
     * 需要更新: props 或者 slots 发生变化
     * 不需要更新: 没有发生改变
     */

    // 需要更新
    if (shouldUpdateComponent(n1, n2)) {
      // 将新的节点存储到实例中，使得可以读到新的 props
      instance.next = n2

      instance.update()
    } else {
      // 没有发生变化，不需要更新，但要更新虚拟节点与复用元素
      // 复用元素
      n2.el = n1.el
      // 更新虚拟节点
      instance.vnode = n2
    }
  }

  /**
   * 处理组件的挂载和更新
   * @param n1
   * @param n2
   * @param container
   * @param anchor
   */
  const processComponent = (n1, n2, container, anchor, parent) => {
    if (n1 == null) {
      // 挂载与更新，自身中的属性发生变化
      mountComponent(n2, container, anchor, parent)
    } else {
      // 父组件传递的属性发生变化从而进行更新
      updateComponent(n1, n2)
    }
  }

  /**
   * 更新组件
   * @param instance
   * @param nextVnode
   */
  const updateComponentPreRender = (instance, nextVnode) => {
    /**
     * 复用组件实例
     * 更新 props
     * 更新 slots
     */

    // 更新虚拟节点
    instance.vnode = nextVnode
    instance.next = null

    // 更新组件的属性
    updateProps(instance, nextVnode)

    // 更新组件的插槽
    updateSlots(instance, nextVnode)
  }

  /**
   * 挂载组件到页面中
   *  1. 处理挂载与更新
   *  2. 将组件其转换为响应式
   *
   * @param instance
   * @param container
   * @param anchor
   */
  const setupRenderEffect = (instance, container, anchor) => {
    const componentUpdateFn = () => {
      /**
       * 区分挂载和更新
       */
      if (!instance.isMounted) {
        // 实例挂载的处理逻辑

        // 拿到 vnode 的虚拟节点
        const { vnode, render } = instance

        // 生命周期挂载前
        triggerHooks(instance, LifeCycleHooks.BEFORE_MOUNT)

        // 将子树的 this 指向 setupState 从而能够使用 setupState 返回的状态
        const subTree = renderComponentRoot(instance)

        // 将 subTree 挂载到页面中
        patch(null, subTree, container, anchor, instance)

        // 共享真实 DOM 元素，组件的 el 会指向 subTree 的 el
        vnode.el = subTree.el

        // 保存子树
        instance.subTree = subTree

        // 将挂载状态更新
        instance.isMounted = true

        // 生命周期挂载完
        triggerHooks(instance, LifeCycleHooks.MOUNTED)
      } else {
        // 更新的逻辑
        let { vnode, next } = instance

        if (next) {
          // 当父组件传递的属性发生变化时，next 就会存在
          updateComponentPreRender(instance, next)
        } else {
          // 如果没有，意味着没有子组件，就用之前的
          // next 只有当子组件发生更新时才有
          next = vnode
        }

        // 生命周期更新前
        triggerHooks(instance, LifeCycleHooks.BEFORE_UPDATE)

        const prevSubTree = instance.subTree

        // 将子树的 this 指向 setupState 从而能够使用 setupState 返回的状态
        const subTree = renderComponentRoot(instance)

        // 将 subTree 挂载到页面中
        patch(prevSubTree, subTree, container, anchor, instance)

        // 共享真实 DOM 元素，组件的 el 会指向 subTree 的 el
        next.el = subTree.el

        // 保存最新的 subTree
        instance.subTree = subTree

        // 生命周期更新完
        triggerHooks(instance, LifeCycleHooks.UPDATED)
      }
    }

    /**
     *
     */
    // 创建 effect
    const effect = new ReactiveEffect(componentUpdateFn)
    // 拿到 effect 中的 run 方法
    const update = effect.run.bind(effect)

    // 将更新的方法存储到当前的实例上
    instance.update = update

    effect.scheduler = () => {
      queueJob(update)
    }

    // 启动 effct
    update()
  }

  const mountComponent = (vnode, container, anchor, parentComponent) => {
    /**
     * 1. 创建组件实例
     * 2. 初始化组件的状态
     * 3. 将组件挂载到页面中
     */
    // 创建组件实例
    const instance = createComponentInstance(vnode, parentComponent)

    // 保存实例，方便复用
    vnode.component = instance

    // 初始化组件的状态
    setupComponent(instance)

    // 挂载组件
    setupRenderEffect(instance, container, anchor)
  }

  /**
   * 处理文本的挂载和更新
   * @param n1
   * @param n2
   * @param container
   * @param anchor
   */
  const processText = (n1, n2, container, anchor) => {
    if (n1 == null) {
      // 挂载
      const el = hostCreateText(n2.children)
      // 给 vnode 绑定 el
      n2.el = el
      // 插入元素中
      hostInsert(el, container, anchor)
    } else {
      // 复用节点
      n2.el = n1.el

      // 如果文本内容变了就更新文本
      if (n1.children !== n2.children) {
        hostSetText(n2.el, n2.children)
      }
    }
  }

  /**
   * 处理 DOM 元素的的挂载与更新
   * @param n1
   * @param n2
   * @param container
   * @param anchor
   */
  const processElement = (n1, n2, container, anchor, parent) => {
    if (n1 == null) {
      // 挂载 n2
      mountElement(n2, container, anchor, parent)
    } else {
      // 更新 n2
      patchElement(n1, n2, parent)
    }
  }

  const render = (vnode, container) => {
    /**
     * 1. 挂载
     * 2. 更新
     * 3. 卸载
     */

    if (vnode == null) {
      // 卸载
      if (container._vnode) {
        unmount(container._vnode)
      }
    } else {
      // 挂载与更新
      patch(container._vnode || null, vnode, container)
    }

    // 把最新的 vnode 保存到 container ,方便更新和卸载时候复用
    container._vnode = vnode
  }

  return {
    render,
    createApp: createAppApi(render),
  }
}

/**
 * 求最长递增子序列
 * @param arr
 * @returns
 */
function getSequence(arr) {
  // 最长递增子序列的结果
  const result = []

  // 记录序列中元素的前驱索引
  const map = new Map()

  // 计算出最长递增子序列
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i]

    // -1 不需要计算
    if (item === -1 || item === undefined) {
      continue
    }

    // 判断是否为第一位
    if (result.length === 0) {
      result.push(i)
      continue
    }

    // 记录最长递增子序列的最后一项，方便比较
    const lastIndex = result[result.length - 1]
    const lastItem = arr[lastIndex]

    // 如果当项大于上一个，则继续排序在后面
    if (item > lastItem) {
      result.push(i)
      // 将前一位存入 map
      map.set(i, lastIndex)
      continue
    }

    // 当前项小于上一个，则使用二分查法，找出最适合插入的位置
    let left = 0
    let right = result.length - 1

    while (left < right) {
      // 保存 result 的中间索引 和 中间项
      const mid = Math.floor((left + right) / 2)
      const midItem = arr[result[mid]]

      if (midItem < item) {
        left = mid + 1
      } else {
        right = mid - 1
      }
    }

    // 找出最佳插入的值
    if (arr[result[left]] > item) {
      // 当该项找到第一项则不需要记录前驱节点
      if (left > 0) {
        // 记录前驱节点
        map.set(i, result[left - 1])
      }
      // 将最长递增子序列中最适合的值进行替换
      result[left] = i
    }
  }

  // 反向追溯，保证顺序正确
  let l = result.length
  let last = result[l - 1]

  while (l > 0) {
    l--

    // 将子序列的内容根据记录的前驱节点从后往前进行替换
    result[l] = last

    // 获取下一个要存入的前驱索引
    last = map.get(last)
  }

  return result
}
