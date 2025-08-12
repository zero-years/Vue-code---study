// packages/shared/src/index.ts
function isObject(value) {
  return typeof value == "object" && value !== null;
}
function hasChanged(newValue, oldValue) {
  return !Object.is(newValue, oldValue);
}
function isFunction(value) {
  return typeof value === "function";
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
export {
  ReactiveEffect,
  ReactiveFlags,
  activeSub,
  computed,
  createReactiveObject,
  effect,
  isReactive,
  isRef,
  proxyRefs,
  reactive,
  ref,
  setActiveSub,
  toRef,
  toRefs,
  trackRef,
  triggerRef,
  unRef,
  watch
};
//# sourceMappingURL=reactivity.esm.js.map
