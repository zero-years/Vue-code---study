var VueReactivity = (() => {
  // packages/shared/src/index.ts
  function isObject(value) {
    return typeof value == "object" && value !== null;
  }

  // packages/reactivity/src/index.ts
  isObject({});
})();
//# sourceMappingURL=reactivity.iife.js.map
