import { NodeTypes } from './ast'
import { Tokenizer } from './tokenizer'

let currentInput = ''
let currentRoot
let currentOpenTag

function getSlice(start, end) {
  return currentInput.slice(start, end)
}

function getLoc(start, end) {
  return {
    start: tokenizer.getPos(start), // 开始的位置信息
    end: tokenizer.getPos(end), // 结束的位置信息
    source: getSlice(start, end), // 内容,
  }
}

const stack = []
function addNode(node) {
  // ;(stack.at(-1) || currentRoot).children.push(node)

  // 找到栈的最后一个
  const lastNode = stack.at(-1)
  if (lastNode) {
    // 如果有则加到该节点的子节点中
    lastNode.children.push(node)
  } else {
    // 否则加到根结点
    currentRoot.children.push(node)
  }
}

function setLocend(nodeLoc, end) {
  nodeLoc.source = getSlice(nodeLoc.start.offset, end)
  nodeLoc.end = tokenizer.getPos(end)
}

const tokenizer = new Tokenizer({
  ontext(start, end) {
    const content = getSlice(start, end)
    const textNode = {
      content,
      type: NodeTypes.TEXT,
      loc: getLoc(start, end),
    }
    addNode(textNode)
  },
  onopentagname(start, end) {
    // 将标签名提取出来
    const tag = getSlice(start, end)
    // 通过将该节点放置到公共区域，使得可以给该节点添加属性，子元素等内容
    currentOpenTag = {
      type: NodeTypes.ELEMENT,
      tag,
      children: [],
      loc: getLoc(start - 1, end),
    }
  },
  onopentagend() {
    addNode(currentOpenTag)
    stack.push(currentOpenTag)
    currentOpenTag = null
  },
  onclosetag(start, end) {
    // 闭合标签的标签名
    const name = getSlice(start, end)

    // 弹出栈顶元素
    const lastNode = stack.pop()
    if (lastNode.tag === name) {
      setLocend(lastNode.loc, end + 1)
    } else {
      console.warn('标签不合法')
    }
  },
})

/**
 * 创建 ast 语法树根节点
 * @param source
 * @returns
 */
function createRoot(source) {
  return {
    children: [], // 子节点
    type: NodeTypes.ROOT, // 根节点是 0
    source, // 初始化字符串
  }
}

export function parse(input) {
  // 把当前正在解析的字符串暴露给外部作用域
  currentInput = input
  const root = createRoot(input)
  // 把当前创建的根节点暴露给外部作用域
  currentRoot = root

  // 开始解析 input
  tokenizer.parse(input)

  return root
}
