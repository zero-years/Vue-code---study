import { NodeTypes } from './ast'
import { Tokenizer } from './tokenizer'

let currentInput = ''
let currentRoot

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

const tokenizer = new Tokenizer({
  ontext(start, end) {
    console.log('start,end ==>', start, end)
    const content = getSlice(start, end)
    const textNode = {
      content,
      type: NodeTypes.TEXT,
      loc: getLoc(start, end),
    }
    currentRoot.children.push(textNode)
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
