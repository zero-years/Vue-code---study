// packages/compiler-core/src/tokenizer.ts
var Tokenizer = class {
  constructor(cbs) {
    this.cbs = cbs;
  }
  /**
   * 状态机的状态
   * 状态机就是在不同的状态下去执行不同的操作，他会在解析字符串的时候根据当前解析的字符进行改变
   * 比如:
   * State.Text ==> 表示当前在解析文本
   * State.InTagName ==> 表示当前在解析标签名
   */
  state = 1 /* Text */;
  // 当前正在解析的字符下标
  index = 0;
  /**解析开始的位置，可以理解为当前状态切换时的初始位置
   * hello world 解析完成时 index = 11 ，sectionStart = 0 ，要解析的字符串就为 0 - 11
   * hello<div></div> world ， hello 解析完成时 index = 4 ，sectionStart = 0 ，要解析的字符串就为 0 - 4
   * 然后在将 sectionStart 设置为 5，表示从5开始继续解析
   */
  sectionStart = 0;
  // 保存要解析的字符串
  buffer = "";
  /**
   * 负责遍历字符串，然后输出需要操作的内容的索引
   * @param input
   */
  parse(input) {
    this.buffer = input;
    while (this.index < this.buffer.length) {
      const str = this.buffer[this.index];
      switch (this.state) {
        case 1 /* Text */: {
          break;
        }
      }
      this.index++;
    }
    this.cleanup();
  }
  /**
   * 根据 sectionStart 和 index 将一段内容进行处理
   */
  cleanup() {
    if (this.sectionStart < this.index) {
      if (this.state == 1 /* Text */) {
        this.cbs.ontext(this.sectionStart, this.index);
        this.sectionStart = this.index;
      }
    }
  }
  /**
   * 返回指定 index 的位置
   * @param index
   */
  getPos(index) {
    return {
      column: index + 1,
      // 列号
      line: 1,
      // 行号 TODO 暂时不考虑换行
      offset: index
      // 偏移量
    };
  }
};

// packages/compiler-core/src/parser.ts
var currentInput = "";
var currentRoot;
function getSlice(start, end) {
  return currentInput.slice(start, end);
}
function getLoc(start, end) {
  return {
    start: tokenizer.getPos(start),
    // 开始的位置信息
    end: tokenizer.getPos(end),
    // 结束的位置信息
    source: getSlice(start, end)
    // 内容,
  };
}
var tokenizer = new Tokenizer({
  ontext(start, end) {
    console.log("start,end ==>", start, end);
    const content = getSlice(start, end);
    const textNode = {
      content,
      type: 2 /* TEXT */,
      loc: getLoc(start, end)
    };
    currentRoot.children.push(textNode);
  }
});
function createRoot(source) {
  return {
    children: [],
    // 子节点
    type: 0 /* ROOT */,
    // 根节点是 0
    source
    // 初始化字符串
  };
}
function parse(input) {
  currentInput = input;
  const root = createRoot(input);
  currentRoot = root;
  tokenizer.parse(input);
  return root;
}
export {
  parse
};
//# sourceMappingURL=compiler-core.esm.js.map
