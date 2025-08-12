export function patchStyle(el, preValue, nextValue) {
  const style = el.style

  // 如果存在新的样式值，则更新相应的 style
  if (nextValue) {
    for (const key in nextValue) {
      style[key] = nextValue[key]
    }
  }

  // 如果有旧值，则需要根据当前的新值内是否具有原先相同的样式名称，如果有则不需要置空，没有则需要置空，以便清除旧的样式
  // old: { backgroundColor: 'red', color: 'blue'  } ==> new: { background: 'green'}
  // 此时则需要将 color 置空，但 background 不置空直接替换即可
  if (preValue) {
    for (const key in preValue) {
      if (nextValue?.[key] == null) {
        style[key] = null
      }
    }
  }
}
