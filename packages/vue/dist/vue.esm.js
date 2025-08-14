// packages/shared/src/utils.ts
function isObject(value) {
  return typeof value == "object" && value !== null;
}
function hasChanged(newValue, oldValue) {
  return !Object.is(newValue, oldValue);
}
function isFunction(value) {
  return typeof value === "function";
}
function isString(value) {
  return typeof value === "string";
}
function isOn(key) {
  return /^on[A-Z]/.test(key);
}
function isNumber(value) {
  return typeof value === "number";
}
var isArray = Array.isArray;
function hasOwn(object = {}, key) {
  return Object.hasOwn(object, key);
}

// packages/reactivity/src/system.ts
var linkPool;
function link(dep, sub) {
  const currentDep = sub.depsTail;
  const nextDep = currentDep === void 0 ? sub.deps : currentDep.nextDep;
  if (nextDep && nextDep.dep === dep) {
    sub.depsTail = nextDep;
    return;
  }
  let newLink;
  if (linkPool) {
    newLink = linkPool;
    linkPool = linkPool.nextDep;
    newLink.nextDep = nextDep;
    newLink.dep = dep;
    newLink.sub = sub;
  } else {
    newLink = {
      dep,
      nextDep,
      sub,
      nextSub: void 0,
      prevSub: void 0
    };
  }
  if (dep.subsTail) {
    dep.subsTail.nextSub = newLink;
    newLink.prevSub = dep.subsTail;
    dep.subsTail = newLink;
  } else {
    dep.subs = newLink;
    dep.subsTail = newLink;
  }
  if (sub.depsTail) {
    sub.depsTail.nextDep = newLink;
    sub.depsTail = newLink;
  } else {
    sub.deps = newLink;
    sub.depsTail = newLink;
  }
}
function propagate(subs) {
  let link2 = subs;
  let queuedEffect = [];
  while (link2) {
    const sub = link2.sub;
    if (!sub.tracking && !sub.dirty) {
      sub.dirty = true;
      if ("update" in sub) {
        processComputedUpdate(sub);
      } else {
        queuedEffect.push(link2.sub);
      }
    }
    link2 = link2.nextSub;
  }
  queuedEffect.forEach((effect2) => effect2.notify());
}
function startTrack(sub) {
  sub.tracking = true;
  sub.depsTail = void 0;
}
function endTrack(sub) {
  sub.tracking = false;
  const depsTail = sub.depsTail;
  sub.dirty = false;
  if (depsTail) {
    if (depsTail.nextDep) {
      clearTracking(depsTail.nextDep);
      depsTail.nextDep = void 0;
    }
  } else if (sub.deps) {
    clearTracking(sub.deps);
    sub.deps = void 0;
  }
}
function clearTracking(link2) {
  while (link2) {
    const { prevSub, nextSub, dep, nextDep } = link2;
    if (prevSub) {
      prevSub.nextSub = nextSub;
      link2.nextSub = void 0;
    } else {
      dep.subs = nextSub;
    }
    if (nextSub) {
      nextSub.prevSub = prevSub;
      link2.prevSub = void 0;
    } else {
      dep.subsTail = prevSub;
    }
    link2.dep = link2.sub = void 0;
    link2.nextDep = linkPool;
    linkPool = link2;
    link2 = nextDep;
  }
}
function processComputedUpdate(sub) {
  if (sub.subs && sub.update()) {
    propagate(sub.subs);
  }
}

// packages/reactivity/src/effect.ts
var activeSub;
function setActiveSub(sub) {
  activeSub = sub;
}
var ReactiveEffect = class {
  constructor(fn) {
    this.fn = fn;
  }
  // 依赖链表的头节点
  deps;
  // 依赖链表的尾节点
  depsTail;
  // tracking 用于判断是否已经追踪
  tracking = false;
  // 处理一个 effect 内对同个 ref 进行多次收集的逻辑
  // - Vue 源码采取遍历的方法，查看 dep 链条中是否存在 sub
  // - 本内容采取空间换时间的方法，通过一个 dirty 确定是否需要收集
  dirty = false;
  /**
   * 用来执行响应式方法
   * @returns 执行当前的 响应式方法
   */
  run() {
    if (!this.active) {
      return this.fn();
    }
    const prevSub = activeSub;
    setActiveSub(this);
    startTrack(this);
    try {
      return this.fn();
    } finally {
      endTrack(this);
      setActiveSub(prevSub);
    }
  }
  /**
   * 通知更新，如果依赖的数据发生了变化，会调用这个函数
   */
  notify() {
    this.scheduler();
  }
  /**
   * 默认调用 run ，如果用户传了 scheduler 则调用用户传入的 scheduler 方法， 类似原型方法与实例方法
   */
  scheduler() {
    this.run();
  }
  // effect 激活标记，默认为 true
  active = true;
  stop() {
    if (this.active) {
      startTrack(this);
      endTrack(this);
      this.active = false;
    }
  }
};
function effect(fn, options) {
  const e = new ReactiveEffect(fn);
  Object.assign(e, options);
  e.run();
  const runner = e.run.bind(e);
  runner.effect = e;
  return runner;
}

// packages/reactivity/src/dep.ts
var targetMap = /* @__PURE__ */ new WeakMap();
function track(target, key) {
  if (!activeSub) {
    return;
  }
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    depsMap = /* @__PURE__ */ new Map();
    targetMap.set(target, depsMap);
  }
  let dep = depsMap.get(key);
  if (!dep) {
    dep = new Dep();
    depsMap.set(key, dep);
  }
  link(dep, activeSub);
}
function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    return;
  }
  const targetIsArray = Array.isArray(target);
  if (targetIsArray && key === "length") {
    const length = target.length;
    depsMap.forEach((dep, depKey) => {
      if (depKey >= length || depKey === "length") {
        propagate(dep.subs);
      }
    });
  } else {
    const dep = depsMap.get(key);
    if (!dep) {
      return;
    }
    propagate(dep.subs);
  }
}
var Dep = class {
  // 订阅者链表的头节点，理解为链表中的 head
  subs;
  // 订阅者链表的尾节点，理解为链表中的 tail
  subsTail;
};

// packages/reactivity/src/baseHandlers.ts
var mutableHandlers = {
  /**
   * 收集依赖， 绑定 target 中的某一个 key 和 sub 之间的关系
   *
   * @param target target = {a:0}
   * @param key  target 中对应的 key值 a
   * @param receiver
   * @returns
   */
  get(target, key, receiver) {
    track(target, key);
    const res = Reflect.get(target, key, receiver);
    if (isRef(res)) {
      return res.value;
    }
    if (isObject(res)) {
      return reactive(res);
    }
    return res;
  },
  /**
   * 触发更新, set 的时候，通知已经收集完的相对应的依赖重新执行
   *
   * @param target 对象 target = { a: 0}
   * @param key 键名 a
   * @param newValue 修改的值
   * @param receiver
   */
  set(target, key, newValue, receiver) {
    const oldValue = target[key];
    const targetIsArray = Array.isArray(target);
    const oldLength = targetIsArray ? target.length : 0;
    if (isRef(oldValue) && !isRef(newValue)) {
      oldValue.value = newValue;
      return true;
    }
    const res = Reflect.set(target, key, newValue, receiver);
    if (hasChanged(newValue, oldValue)) {
      trigger(target, key);
    }
    const newLength = targetIsArray ? target.length : 0;
    if (targetIsArray && newLength !== oldLength && key !== "length") {
      trigger(target, "length");
    }
    return res;
  }
};

// packages/reactivity/src/reavtive.ts
function reactive(target) {
  return createReactiveObject(target);
}
var reactiveMap = /* @__PURE__ */ new WeakMap();
var reactiveSet = /* @__PURE__ */ new WeakSet();
function createReactiveObject(target) {
  if (!isObject(target)) {
    return target;
  }
  if (reactiveSet.has(target)) {
    return target;
  }
  const exisitingProxy = reactiveMap.get(target);
  if (exisitingProxy) {
    return exisitingProxy;
  }
  const proxy = new Proxy(target, mutableHandlers);
  reactiveMap.set(target, proxy);
  reactiveSet.add(proxy);
  return proxy;
}
function isReactive(target) {
  return reactiveSet.has(target);
}

// packages/reactivity/src/ref.ts
var ReactiveFlags = /* @__PURE__ */ ((ReactiveFlags2) => {
  ReactiveFlags2["IS_REF"] = "__v_isRef";
  return ReactiveFlags2;
})(ReactiveFlags || {});
var RefImpl = class {
  // 保存实际的值
  _value;
  // 订阅者链表的头节点，理解为链表中的 head
  subs;
  // 订阅者链表的尾节点，理解为链表中的 tail
  subsTail;
  // ref 的标记，证明是 ref
  ["__v_isRef" /* IS_REF */] = true;
  constructor(value) {
    this._value = isObject(value) ? reactive(value) : value;
  }
  get value() {
    if (activeSub) {
      trackRef(this);
    }
    return this._value;
  }
  set value(newValue) {
    if (hasChanged(newValue, this._value)) {
      this._value = isObject(newValue) ? reactive(newValue) : newValue;
    }
    triggerRef(this);
  }
};
function ref(value) {
  return new RefImpl(value);
}
function isRef(value) {
  return !!(value && value["__v_isRef" /* IS_REF */]);
}
function trackRef(dep) {
  if (activeSub) {
    link(dep, activeSub);
  }
}
function triggerRef(dep) {
  if (dep.subs) {
    propagate(dep.subs);
  }
}
var ObjectRefImpl = class {
  constructor(_object, _key) {
    this._object = _object;
    this._key = _key;
  }
  ["__v_isRef" /* IS_REF */] = true;
  get value() {
    return this._object[this._key];
  }
  set value(newVal) {
    this._object[this._key] = newVal;
  }
};
function toRef(target, key) {
  return new ObjectRefImpl(target, key);
}
function toRefs(target) {
  if (!isReactive(target)) {
    console.warn("\u4F20\u5165\u7684\u503C\uFF0C\u5FC5\u987B\u4E3A\u54CD\u5E94\u5F0F\u5BF9\u8C61");
  }
  const res = {};
  for (const key in target) {
    res[key] = new ObjectRefImpl(target, key);
  }
  return res;
}
function unRef(value) {
  return isRef(value) ? value.value : value;
}
function proxyRefs(target) {
  return new Proxy(target, {
    get(target2, key, receiver) {
      const res = Reflect.get(target2, key, receiver);
      return unRef(res);
    },
    set(target2, key, newValue, receiver) {
      const oldValue = target2[key];
      if (isRef(oldValue) && !isRef(newValue)) {
        oldValue.value = newValue;
        return true;
      }
      return Reflect.set(target2, key, newValue, receiver);
    }
  });
}

// packages/reactivity/src/computed.ts
var ComputedRefImpl = class {
  constructor(fn, setter) {
    this.fn = fn;
    this.setter = setter;
  }
  // computed 也是一个 ref ，通过 isRef 也返回 true
  ["__v_isRef" /* IS_REF */] = true;
  // 保存 fn 的返回值
  _value;
  //region 作为 dep,要关联 subs 如果值发生改变则通知更新
  // 订阅者链表的头节点，理解为链表中的 head
  subs;
  // 订阅者链表的尾节点，理解为链表中的 tail
  subsTail;
  //endregion
  //region  作为 sub ，要保存被我收集的 dep
  // 依赖链表的头节点
  deps;
  // 依赖链表的尾节点
  depsTail;
  // tracking 用于判断是否已经追踪
  tracking = false;
  //endregion
  // 计算属性脏不脏，如果 dirty 为 true 则证明该计算是脏的, 所以 get 和 set 的时候，需要执行 update
  dirty = true;
  get value() {
    if (this.dirty) {
      this.update();
    }
    if (activeSub) {
      link(this, activeSub);
    }
    return this._value;
  }
  set value(newValue) {
    if (this.setter) {
      this.setter(newValue);
    } else {
      console.warn("\u6211\u662F\u53EA\u8BFB\u7684\uFF0C\u65E0\u6CD5\u91CD\u65B0\u8D4B\u503C");
    }
  }
  update() {
    const prevSub = activeSub;
    setActiveSub(this);
    startTrack(this);
    try {
      const oldValue = this._value;
      this._value = this.fn();
      return hasChanged(this._value, oldValue);
    } finally {
      endTrack(this);
      setActiveSub(prevSub);
    }
  }
};
function computed(getterOrOptions) {
  let getter;
  let setter;
  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions;
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }
  return new ComputedRefImpl(getter, setter);
}

// packages/reactivity/src/watch.ts
function watch(source, cb, options) {
  let getter;
  let { immediate, once, deep } = options || {};
  if (once) {
    const _cb = cb;
    cb = (...args) => {
      _cb(...args);
      stop();
    };
  }
  if (isRef(source)) {
    getter = () => source.value;
  } else if (isReactive(source)) {
    getter = () => source;
    if (!deep) {
      deep = true;
    }
  } else if (isFunction(source)) {
    getter = source;
  }
  if (deep) {
    const baseGetter = getter;
    const depth = deep === true ? Infinity : deep;
    getter = () => traverse(baseGetter(), depth);
  }
  let oldValue;
  let cleanup = null;
  function onClaenup(cb2) {
    cleanup = cb2;
  }
  function job() {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    const newValue = effect2.run();
    cb(newValue, oldValue, onClaenup);
    oldValue = newValue;
  }
  const effect2 = new ReactiveEffect(getter);
  effect2.scheduler = job;
  if (immediate) {
    job();
  } else {
    oldValue = effect2.run();
  }
  function stop() {
    effect2.stop();
  }
  return stop;
}
function traverse(value, depth = Infinity, seen = /* @__PURE__ */ new Set()) {
  if (!isObject(value) || depth <= 0) {
    return value;
  }
  if (seen.has(value)) {
    return value;
  }
  depth--;
  seen.add(value);
  for (const key in value) {
    traverse(value[key], depth, seen);
    return value;
  }
}

// packages/runtime-core/src/componentProps.ts
function normalizePropsOptions(props) {
  if (isArray(props)) {
    return props.reduce((prev, cur) => {
      prev[cur] = {};
      return prev;
    }, {});
  }
  return props;
}
function initProps(instance) {
  const { vnode } = instance;
  const rawProps = vnode.props;
  const props = {};
  const attrs = {};
  setFullProps(instance, rawProps, props, attrs);
  instance.props = reactive(props);
  instance.attrs = attrs;
}
function setFullProps(instance, rawProps, props, attrs) {
  const propsOptions = instance.propsOptions;
  if (rawProps) {
    for (const key in rawProps) {
      const value = rawProps[key];
      if (hasOwn(propsOptions, key)) {
        props[key] = value;
      } else {
        attrs[key] = value;
      }
    }
  }
}
function updateProps(instance, nextVnode) {
  const { props, attrs } = instance;
  const rawProps = nextVnode.props;
  setFullProps(instance, rawProps, props, attrs);
  for (const key in props) {
    if (!hasOwn(rawProps, key)) {
      delete props[key];
    }
  }
  for (const key in attrs) {
    if (!hasOwn(rawProps, key)) {
      delete attrs[key];
    }
  }
}

// packages/runtime-core/src/scheduler.ts
var resolvePromise = Promise.resolve();
function nextTick(fn) {
  return resolvePromise.then(() => {
    fn.call(this);
  });
}
function queueJob(job) {
  resolvePromise.then(() => {
    job();
  });
}

// packages/runtime-core/src/componentSlots.ts
function initSlots(instance) {
  const { slots, vnode } = instance;
  if (vnode.shapeFlag & 32 /* SLOTS_CHILDREN */) {
    const { children } = vnode;
    for (const key in children) {
      slots[key] = children[key];
    }
  }
}
function updateSlots(instance, vnode) {
  const { slots } = instance;
  if (instance.shapeFlag & 32 /* SLOTS_CHILDREN */) {
    const { children } = vnode;
    for (const key in children) {
      slots[key] = children[key];
    }
    for (const key in slots) {
      if (children[key] == null) {
        delete slots[key];
      }
    }
  }
}

// packages/runtime-core/src/component.ts
function createComponentInstance(vnode, parent) {
  const { type } = vnode;
  const appContext = parent ? parent.appContext : vnode.appContext;
  const instance = {
    type,
    vnode,
    // createApp 产生的 appContext
    appContext,
    // 父组件的实例
    parent,
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
    isMounted: false
  };
  instance.ctx = { _: instance };
  instance.emit = (event, ...args) => emit(instance, event, ...args);
  return instance;
}
function setupComponent(instance) {
  initProps(instance);
  initSlots(instance);
  setupStatefulComponent(instance);
}
var publicPropertiesMap = {
  $el: (instance) => instance.vnode.el,
  $attrs: (instance) => instance.attrs,
  $slots: (instance) => instance.slots,
  $refs: (instance) => instance.refs,
  $emit: (instance) => instance.emit,
  $nextTick: (instance) => {
    return nextTick.bind(instance);
  },
  $forceUpdate: (instance) => {
    return () => instance.update();
  }
};
var publicInstacneProxyHandlers = {
  get(target, key) {
    const { _: instance } = target;
    const { setupState, props } = instance;
    if (hasOwn(setupState, key)) {
      return setupState[key];
    }
    if (hasOwn(props, key)) {
      return props[key];
    }
    if (hasOwn(publicPropertiesMap, key)) {
      const publicGetter = publicPropertiesMap[key];
      return publicGetter(instance);
    }
    return instance[key];
  },
  set(target, key, value) {
    const { _: instance } = target;
    const { setupState } = instance;
    if (hasOwn(setupState, key)) {
      setupState[key] = value;
    }
    return true;
  }
};
function setupStatefulComponent(instance) {
  const type = instance.type;
  instance.proxy = new Proxy(instance.ctx, publicInstacneProxyHandlers);
  if (isFunction(type.setup)) {
    const setupContext = createSetUpContext(instance);
    instance.setupContext = setupContext;
    setCurrentInstance(instance);
    const setupResult = type.setup(instance.props, setupContext);
    unsetCurrentInstance();
    handleSetupResult(instance, setupResult);
  }
  if (!instance.render) {
    instance.render = type.render;
  }
}
function handleSetupResult(instance, setupResult) {
  if (isFunction(setupResult)) {
    instance.render = setupResult;
  } else if (isObject(setupResult)) {
    instance.setupState = proxyRefs(setupResult);
  }
}
function createSetUpContext(instance) {
  return {
    // 处理 props 之外的属性
    get attrs() {
      return instance.attrs;
    },
    // 处理事件
    emit(event, ...args) {
      emit(instance, event, ...args);
    },
    // 处理插槽
    slots: instance.slots,
    // 暴露属性
    expose(exposed) {
      instance.exposed = exposed;
    }
  };
}
function emit(instance, event, ...args) {
  const eventName = `on${event[0].toUpperCase() + event.slice(1)}`;
  const handler = instance.vnode.props[eventName];
  if (isFunction(handler)) {
    handler(...args);
  }
}
var currentInstance = null;
function setCurrentInstance(instance) {
  currentInstance = instance;
}
function getCurrentInstance() {
  return currentInstance;
}
function unsetCurrentInstance() {
  currentInstance = null;
}
function getComponentPublicInstance(instance) {
  if (instance.exposedProxy) return instance.exposedProxy;
  if (instance.exposed) {
    instance.exposedProxy = new Proxy(proxyRefs(instance.exposed), {
      get(target, key) {
        if (key in target) {
          return target[key];
        }
        if (key in publicPropertiesMap) {
          return publicPropertiesMap[key](instance);
        }
      }
    });
    return instance.exposedProxy;
  } else {
    return instance.proxy;
  }
}
var currentRenderInstance = null;
function setCurrentRenderingInstance(instance) {
  currentRenderInstance = instance;
}
function unsetCurrentRenderingInstance() {
  currentRenderInstance = null;
}
function getCurrentRenderingInstance() {
  return currentRenderInstance;
}

// packages/runtime-core/src/vnode.ts
var Text = Symbol("v-txt");
function isSameVNodeType(n1, n2) {
  return n1.type === n2.type && n1.key === n2.key;
}
function normalizeVnode(vnode) {
  if (isString(vnode) || isNumber(vnode)) {
    return createVNode(Text, null, String(vnode));
  }
  return vnode;
}
function isVnode(value) {
  return value?.__v_isVNode;
}
function normalizeChildren(vnode, children) {
  let { shapeFlag } = vnode;
  if (isArray(children)) {
    shapeFlag |= 16 /* ARRAY_CHILDREN */;
  } else if (isObject(children)) {
    if (shapeFlag & 6 /* COMPONENT */) {
      shapeFlag |= 32 /* SLOTS_CHILDREN */;
    }
  } else if (isFunction(children)) {
    if (shapeFlag & 6 /* COMPONENT */) {
      shapeFlag |= 32 /* SLOTS_CHILDREN */;
      children = { default: children };
    }
  } else if (isNumber(children) || isString(children)) {
    children = String(children);
    shapeFlag |= 8 /* TEXT_CHILDREN */;
  }
  vnode.shapeFlag = shapeFlag;
  vnode.children = children;
  return children;
}
function normalizeRef(ref2) {
  if (ref2 == null) return;
  return {
    // 原始的 ref
    r: ref2,
    // 当前正在渲染的组件的实例
    i: getCurrentRenderingInstance()
  };
}
function createVNode(type, props, children = null) {
  let shapeFlag = 0;
  if (isString(type)) {
    shapeFlag = 1 /* ELEMENT */;
  } else if (isObject(type)) {
    shapeFlag = 4 /* STATEFUL_COMPONENT */;
  }
  const vnode = {
    // 证明是一个虚拟节点  vnode
    __v_isVNode: true,
    type,
    props,
    children: null,
    // **key** 做 diff 需要的
    key: props?.key,
    // 虚拟节点要挂载的元素
    el: null,
    // 如果是 9 则表示 type 是一个 dom 元素, children 是一个字符串
    shapeFlag,
    // 绑定 ref
    ref: normalizeRef(props?.ref),
    // app 中一下会使用到的方法 例如: app.use | provides
    appContext: null
  };
  normalizeChildren(vnode, children);
  return vnode;
}

// packages/runtime-core/src/h.ts
function h(type, propsOrChildren, children) {
  let l = arguments.length;
  if (l === 2) {
    if (isArray(propsOrChildren)) {
      return createVNode(type, null, propsOrChildren);
    }
    if (isObject(propsOrChildren)) {
      if (isVnode(propsOrChildren)) {
        return createVNode(type, null, [propsOrChildren]);
      }
      return createVNode(type, propsOrChildren, children);
    }
    return createVNode(type, null, propsOrChildren);
  } else {
    if (l > 3) {
      children = [...arguments].slice(2);
    } else if (isVnode(children)) {
      children = [children];
    }
    return createVNode(type, propsOrChildren, children);
  }
}

// packages/runtime-core/src/apiCreateApp.ts
function createAppApi(render2) {
  return function createApp2(rootComponent, rootProps) {
    const context = {
      // app 往后代组件使用 provide 注入的属性，会存到这里面
      provides: {}
    };
    const app = {
      _container: null,
      mount(container) {
        const vnode = h(rootComponent, rootProps);
        vnode.appContext = context;
        render2(vnode, container);
        app._container = container;
      },
      // 卸载虚拟节点
      unmount() {
        render2(null, app._container);
      }
    };
    return app;
  };
}

// packages/runtime-core/src/componentRenderUtils.ts
function hasPropsChanged(prevProps, nextProps) {
  const prevKeys = Object.keys(prevProps);
  const nextKeys = Object.keys(nextProps);
  if (nextKeys.length !== prevKeys.length) {
    return true;
  }
  for (const key of nextKeys) {
    if (nextKeys[key] !== prevProps[key]) {
      return true;
    }
  }
  return false;
}
function shouldUpdateComponent(n1, n2) {
  const { props: prevProps, children: prevChildren } = n1;
  const { props: nextProps, children: nextChildren } = n2;
  if (prevChildren || nextChildren) {
    return true;
  }
  if (!prevProps) {
    return !!nextProps;
  }
  if (!nextProps) {
    return true;
  }
  return hasPropsChanged(prevProps, nextProps);
}
function renderComponentRoot(instance) {
  setCurrentRenderingInstance(instance);
  const subTree = instance.render.call(instance.proxy);
  unsetCurrentRenderingInstance();
  return subTree;
}

// packages/runtime-core/src/apiLifecycle.ts
var LifeCycleHooks = /* @__PURE__ */ ((LifeCycleHooks2) => {
  LifeCycleHooks2["BEFORE_MOUNT"] = "bm";
  LifeCycleHooks2["MOUNTED"] = "m";
  LifeCycleHooks2["BEFORE_UPDATE"] = "bu";
  LifeCycleHooks2["UPDATED"] = "u";
  LifeCycleHooks2["BEFORE_UNMOUNTED"] = "bum";
  LifeCycleHooks2["UNMOUNTED"] = "um";
  return LifeCycleHooks2;
})(LifeCycleHooks || {});
function createHook(type) {
  return (hook, target = getCurrentInstance()) => {
    injectHook(target, hook, type);
  };
}
function injectHook(target, hook, type) {
  if (target[type] == null) {
    target[type] = [];
  }
  const _hook = () => {
    setCurrentInstance(target);
    hook();
    unsetCurrentInstance;
  };
  target[type].push(_hook);
}
function triggerHooks(instance, type) {
  const hooks = instance[type];
  if (hooks) {
    hooks.forEach((hook) => hook());
  }
}
var onBeforeMount = createHook("bm" /* BEFORE_MOUNT */);
var onMounted = createHook("m" /* MOUNTED */);
var onBeforeUpdate = createHook("bu" /* BEFORE_UPDATE */);
var onUpdated = createHook("u" /* UPDATED */);
var onBeforeUnmount = createHook("bum" /* BEFORE_UNMOUNTED */);
var onUnmounted = createHook("um" /* UNMOUNTED */);

// packages/runtime-core/src/renderTemplateRef.ts
function setRef(ref2, vnode) {
  const { r: rawRef, i: instance } = ref2;
  if (vnode == null) {
    if (isRef(rawRef)) {
      rawRef.value = null;
    } else if (isString(rawRef)) {
      instance.refs[rawRef] = null;
    }
    return;
  }
  const { shapeFlag } = vnode;
  if (isRef(rawRef)) {
    if (shapeFlag & 6 /* COMPONENT */) {
      rawRef.value = getComponentPublicInstance(vnode.component);
    } else {
      rawRef.value = vnode.el;
    }
  } else if (isString(rawRef)) {
    if (shapeFlag & 6 /* COMPONENT */) {
      instance.refs[rawRef] = getComponentPublicInstance(vnode.component);
    } else {
      instance.refs[rawRef] = vnode.el;
    }
  }
}

// packages/runtime-core/src/renderer.ts
function createRenderer(options) {
  const {
    createElement: hostCreateElement,
    insert: hostInsert,
    remove: hostRemove,
    setElementText: hostSetElementText,
    createText: hostCreateText,
    setText: hostSetText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    patchProp: hostPatchProp
  } = options;
  const mountChildren = (children, el, parentComponent) => {
    for (let i = 0; i < children.length; i++) {
      const child = children[i] = normalizeVnode(children[i]);
      patch(null, child, el, null, parentComponent);
    }
  };
  const mountElement = (vnode, container, anchor = null, parentComponent) => {
    const { type, props, children, shapeFlag } = vnode;
    const el = hostCreateElement(type);
    vnode.el = el;
    if (props) {
      for (const key in props) {
        hostPatchProp(el, key, null, props[key]);
      }
    }
    if (shapeFlag & 8 /* TEXT_CHILDREN */) {
      hostSetElementText(el, children);
    } else if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
      mountChildren(children, el, parentComponent);
    }
    hostInsert(el, container, anchor);
  };
  const unmountChildren = (children) => {
    for (let i = 0; i < children.length; i++) {
      unmount(children[i]);
    }
  };
  const unmountComponent = (instance) => {
    triggerHooks(instance, "bum" /* BEFORE_UNMOUNTED */);
    unmount(instance.subTree);
    triggerHooks(instance, "um" /* UNMOUNTED */);
  };
  const unmount = (vnode) => {
    const { shapeFlag, children, ref: ref2 } = vnode;
    if (shapeFlag & 6 /* COMPONENT */) {
      unmountComponent(vnode.component);
    } else if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
      unmountChildren(children);
    }
    hostRemove(vnode.el);
    if (ref2 != null) {
      setRef(ref2, null);
    }
  };
  const patchProps = (el, oldProps, newProps) => {
    if (oldProps) {
      for (const key in oldProps) {
        hostPatchProp(el, key, oldProps[key], null);
      }
    }
    if (newProps) {
      for (const key in newProps) {
        hostPatchProp(el, key, oldProps?.[key], newProps[key]);
      }
    }
  };
  const patchChildren = (n1, n2, parentComponent) => {
    const el = n2.el;
    const prevShapeFlag = n1.shapeFlag;
    const shapeFlag = n2.shapeFlag;
    if (shapeFlag & 8 /* TEXT_CHILDREN */) {
      if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
        unmountChildren(n1.children);
      }
      if (n1.children !== n2.children) {
        hostSetElementText(el, n2.children);
      }
    } else {
      if (prevShapeFlag & 8 /* TEXT_CHILDREN */) {
        hostSetElementText(el, "");
        if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
          mountChildren(n2.children, el, parentComponent);
        }
      } else {
        if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
          if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
            patchKeyedChildren(n1.children, n2.children, el, parentComponent);
          } else {
            unmountChildren(n1.children);
          }
        } else {
          if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
            mountChildren(n2.children, el, parentComponent);
          }
        }
      }
    }
  };
  const patchKeyedChildren = (c1, c2, container, parentComponent) => {
    let i = 0;
    let e1 = c1.length - 1;
    let e2 = c2.length - 1;
    while (i <= e1 && i <= e2) {
      const n1 = c1[i];
      const n2 = c2[i] = normalizeVnode(c2[i]);
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, container, null, parentComponent);
      } else {
        break;
      }
      i++;
    }
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1];
      const n2 = c2[e2] = normalizeVnode(c2[e2]);
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, container, null, parentComponent);
      } else {
        break;
      }
      e1--;
      e2--;
    }
    if (i > e1) {
      const nextPosition = e2 + 1;
      const anchor = nextPosition < c2.length ? c2[nextPosition].el : null;
      while (i <= e2) {
        patch(
          null,
          c2[i] = normalizeVnode(c2[i]),
          container,
          anchor,
          parentComponent
        );
        i++;
      }
    } else if (i > e2) {
      while (i <= e1) {
        unmount(c1[i]);
        i++;
      }
    } else {
      let s1 = i;
      let s2 = i;
      const keyToNewIndexMap = /* @__PURE__ */ new Map();
      const newIndexToOldIndexMap = new Array(e2 - s2 + 1);
      newIndexToOldIndexMap.fill(-1);
      for (let j = s2; j <= e2; j++) {
        const n2 = c2[j] = normalizeVnode(c2[j]);
        keyToNewIndexMap.set(n2.key, j);
      }
      let pos = -1;
      let move = false;
      for (let j = s1; j <= e1; j++) {
        const n1 = c1[j];
        const newIndex = keyToNewIndexMap.get(n1.key);
        if (newIndex !== null) {
          if (newIndex > pos) {
            pos = newIndex;
          } else {
            move = true;
          }
          newIndexToOldIndexMap[newIndex] = j;
          patch(n1, c2[newIndex], container, null, parentComponent);
        } else {
          unmount(n1);
        }
      }
      const newIndexSequence = move ? getSequence(newIndexToOldIndexMap) : [];
      const sequenctSet = new Set(newIndexSequence);
      for (let j = e2; j >= s2; j--) {
        const n2 = c2[j];
        const anchor = c2[j + 1]?.el || null;
        if (n2.el) {
          if (move) {
            if (!sequenctSet.has(j)) {
              hostInsert(n2.el, container, anchor);
            }
          }
        } else {
          patch(null, n2, container, anchor, parentComponent);
        }
      }
    }
  };
  const patchElement = (n1, n2, parentComponent) => {
    const el = n2.el = n1.el;
    const oldProps = n1.props;
    const newProps = n2.props;
    patchProps(el, oldProps, newProps);
    patchChildren(n1, n2, parentComponent);
  };
  const patch = (n1, n2, container, anchor = null, parentComponent = null) => {
    if (n1 === n2) {
      return;
    }
    if (n1 && !isSameVNodeType(n1, n2)) {
      anchor = hostNextSibling(n1.el);
      unmount(n1);
      n1 = null;
    }
    const { shapeFlag, type, ref: ref2 } = n2;
    switch (type) {
      case Text:
        processText(n1, n2, container, anchor);
        break;
      default:
        if (shapeFlag & 1 /* ELEMENT */) {
          processElement(n1, n2, container, anchor, parentComponent);
        } else if (shapeFlag & 6 /* COMPONENT */) {
          processComponent(n1, n2, container, anchor, parentComponent);
        }
    }
    if (ref2 != null) {
      setRef(ref2, n2);
    }
  };
  const updateComponent = (n1, n2) => {
    const instance = n2.component = n1.component;
    if (shouldUpdateComponent(n1, n2)) {
      instance.next = n2;
      instance.update();
    } else {
      n2.el = n1.el;
      instance.vnode = n2;
    }
  };
  const processComponent = (n1, n2, container, anchor, parent) => {
    if (n1 == null) {
      mountComponent(n2, container, anchor, parent);
    } else {
      updateComponent(n1, n2);
    }
  };
  const updateComponentPreRender = (instance, nextVnode) => {
    instance.vnode = nextVnode;
    instance.next = null;
    updateProps(instance, nextVnode);
    updateSlots(instance, nextVnode);
  };
  const setupRenderEffect = (instance, container, anchor) => {
    const componentUpdateFn = () => {
      if (!instance.isMounted) {
        const { vnode, render: render3 } = instance;
        triggerHooks(instance, "bm" /* BEFORE_MOUNT */);
        const subTree = renderComponentRoot(instance);
        patch(null, subTree, container, anchor, instance);
        vnode.el = subTree.el;
        instance.subTree = subTree;
        instance.isMounted = true;
        triggerHooks(instance, "m" /* MOUNTED */);
      } else {
        let { vnode, next } = instance;
        if (next) {
          updateComponentPreRender(instance, next);
        } else {
          next = vnode;
        }
        triggerHooks(instance, "bu" /* BEFORE_UPDATE */);
        const prevSubTree = instance.subTree;
        const subTree = renderComponentRoot(instance);
        patch(prevSubTree, subTree, container, anchor, instance);
        next.el = subTree.el;
        instance.subTree = subTree;
        triggerHooks(instance, "u" /* UPDATED */);
      }
    };
    const effect2 = new ReactiveEffect(componentUpdateFn);
    const update = effect2.run.bind(effect2);
    instance.update = update;
    effect2.scheduler = () => {
      queueJob(update);
    };
    update();
  };
  const mountComponent = (vnode, container, anchor, parentComponent) => {
    const instance = createComponentInstance(vnode, parentComponent);
    vnode.component = instance;
    setupComponent(instance);
    setupRenderEffect(instance, container, anchor);
  };
  const processText = (n1, n2, container, anchor) => {
    if (n1 == null) {
      const el = hostCreateText(n2.children);
      n2.el = el;
      hostInsert(el, container, anchor);
    } else {
      n2.el = n1.el;
      if (n1.children !== n2.children) {
        hostSetText(n2.el, n2.children);
      }
    }
  };
  const processElement = (n1, n2, container, anchor, parent) => {
    if (n1 == null) {
      mountElement(n2, container, anchor, parent);
    } else {
      patchElement(n1, n2, parent);
    }
  };
  const render2 = (vnode, container) => {
    if (vnode == null) {
      if (container._vnode) {
        unmount(container._vnode);
      }
    } else {
      patch(container._vnode || null, vnode, container);
    }
    container._vnode = vnode;
  };
  return {
    render: render2,
    createApp: createAppApi(render2)
  };
}
function getSequence(arr) {
  const result = [];
  const map = /* @__PURE__ */ new Map();
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (item === -1 || item === void 0) {
      continue;
    }
    if (result.length === 0) {
      result.push(i);
      continue;
    }
    const lastIndex = result[result.length - 1];
    const lastItem = arr[lastIndex];
    if (item > lastItem) {
      result.push(i);
      map.set(i, lastIndex);
      continue;
    }
    let left = 0;
    let right = result.length - 1;
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      const midItem = arr[result[mid]];
      if (midItem < item) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    if (arr[result[left]] > item) {
      if (left > 0) {
        map.set(i, result[left - 1]);
      }
      result[left] = i;
    }
  }
  let l = result.length;
  let last = result[l - 1];
  while (l > 0) {
    l--;
    result[l] = last;
    last = map.get(last);
  }
  return result;
}

// packages/runtime-core/src/useTemplateRef.ts
function useTemplateRef(key) {
  const vm = getCurrentInstance();
  const { refs } = vm;
  const elRef = ref(null);
  Object.defineProperty(refs, key, {
    get() {
      return elRef.value;
    },
    set(value) {
      elRef.value = value;
    }
  });
  return elRef;
}

// packages/runtime-dom/src/nodeOps.ts
var nodeOps = {
  // 插入节点
  insert(el, parent, anchor) {
    parent.insertBefore(el, anchor || null);
  },
  // 创建元素
  createElement(type) {
    return document.createElement(type);
  },
  // 移除元素
  remove(el) {
    const parentNode = el.parentNode;
    if (parentNode) {
      parentNode.removeChild(el);
    }
  },
  // 设置元素 text
  setElementText(el, text) {
    el.textContent = text;
  },
  // 创建文本节点
  createText(text) {
    return document.createTextNode(text);
  },
  // 设置 node 节点的 nodeValue
  setText(node, text) {
    return node.nodeValue = text;
  },
  // 获取元素的的父节点
  parentNode(el) {
    return el.parentNode;
  },
  // 获取元素的下一个兄弟节点
  nextSibling(el) {
    return el.nextSibling;
  },
  // 元素选择器 dom 查询
  querySelector(selector) {
    return document.querySelector(selector);
  }
};

// packages/runtime-dom/src/modules/patchClass.ts
function patchClass(el, value) {
  if (value == void 0) {
    el.removeAttribute("class");
  } else {
    el.className = value;
  }
}

// packages/runtime-dom/src/modules/patchStyle.ts
function patchStyle(el, preValue, nextValue) {
  const style = el.style;
  if (nextValue) {
    for (const key in nextValue) {
      style[key] = nextValue[key];
    }
  }
  if (preValue) {
    for (const key in preValue) {
      if (nextValue?.[key] == null) {
        style[key] = null;
      }
    }
  }
}

// packages/runtime-dom/src/modules/event.ts
var veiKey = Symbol("_vei");
function patchEvent(el, rawName, nextValue) {
  const name = rawName.slice(2).toLowerCase();
  const invokers = el[veiKey] ??= {};
  const exisitingInvoker = invokers[rawName];
  if (nextValue) {
    if (exisitingInvoker) {
      exisitingInvoker.value = nextValue;
      return;
    }
    const invoker = createInvoker(nextValue);
    invokers[rawName] = invoker;
    el.addEventListener(name, invoker);
  } else {
    if (exisitingInvoker) {
      el.removeEventListener(name, exisitingInvoker);
      invokers[rawName] = void 0;
    }
  }
}
function createInvoker(value) {
  const invoker = (e) => {
    invoker.value(e);
  };
  invoker.value = value;
  return invoker;
}

// packages/runtime-dom/src/modules/patcchAttr.ts
function patchAttr(el, key, value) {
  if (value == void 0) {
    el.removeAttribute(key);
  } else {
    el.setAttribute(key, value);
  }
}

// packages/runtime-dom/src/patchProp.ts
function patchProp(el, key, preValue, nextValue) {
  if (key === "class") {
    return patchClass(el, nextValue);
  }
  if (key === "style") {
    return patchStyle(el, preValue, nextValue);
  }
  if (isOn(key)) {
    return patchEvent(el, key, nextValue);
  }
  patchAttr(el, key, nextValue);
}

// packages/runtime-dom/src/index.ts
var renderOptions = { patchProp, ...nodeOps };
var renderer = createRenderer(renderOptions);
function render(vNode, container) {
  renderer.render(vNode, container);
}
function createApp(rootComponent, rootProps) {
  const app = renderer.createApp(rootComponent, rootProps);
  const _mount = app.mount.bind(app);
  function mount(selector) {
    let el = selector;
    if (isString(selector)) {
      el = document.querySelector(selector);
    }
    _mount(el);
  }
  app.mount = mount;
  return app;
}
export {
  LifeCycleHooks,
  ReactiveEffect,
  ReactiveFlags,
  Text,
  activeSub,
  computed,
  createApp,
  createComponentInstance,
  createReactiveObject,
  createRenderer,
  createVNode,
  effect,
  getComponentPublicInstance,
  getCurrentInstance,
  getCurrentRenderingInstance,
  h,
  isReactive,
  isRef,
  isSameVNodeType,
  isVnode,
  nextTick,
  normalizeVnode,
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onMounted,
  onUnmounted,
  onUpdated,
  proxyRefs,
  queueJob,
  reactive,
  ref,
  render,
  renderOptions,
  setActiveSub,
  setCurrentInstance,
  setCurrentRenderingInstance,
  setupComponent,
  toRef,
  toRefs,
  trackRef,
  triggerHooks,
  triggerRef,
  unRef,
  unsetCurrentInstance,
  unsetCurrentRenderingInstance,
  useTemplateRef,
  watch
};
//# sourceMappingURL=vue.esm.js.map
