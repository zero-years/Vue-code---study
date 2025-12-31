// packages/compiler-core/src/tokenizer.ts
function isTagStart(str) {
  return /[a-zA-Z]/.test(str);
}
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
          this.stateText(str);
          break;
        }
        case 5 /* BeforeTagName */: {
          this.stateBeforeTagName(str);
          break;
        }
        case 6 /* InTagName */: {
          this.stateInTagName(str);
          break;
        }
        case 11 /* BeforeAttrName */: {
          this.stateBeforeAttrName(str);
          break;
        }
        case 9 /* InClosingTagName */: {
          this.stateInClosingTagName(str);
          break;
        }
      }
      this.index++;
    }
    this.cleanup();
  }
  // 处理尾标签的结束标签
  stateInClosingTagName(str) {
    if (str == ">") {
      this.cbs.onclosetag(this.sectionStart, this.index);
      this.sectionStart = this.index + 1;
      this.state = 1 /* Text */;
    }
  }
  // 解析头标签中的属性名
  stateBeforeAttrName(str) {
    if (str == ">") {
      this.cbs.onopentagend();
      this.sectionStart = this.index + 1;
      this.state = 1 /* Text */;
    }
  }
  // 处理头标签名内的内容
  stateInTagName(str) {
    if (str == ">" || str == " ") {
      this.cbs.onopentagname(this.sectionStart, this.index);
      this.state = 11 /* BeforeAttrName */;
      this.sectionStart = this.index;
      this.stateBeforeAttrName(str);
    }
  }
  // 解析标签名之前的操作
  stateBeforeTagName(str) {
    if (isTagStart(str)) {
      this.state = 6 /* InTagName */;
      this.sectionStart = this.index;
    } else if (str == "/") {
      this.state = 9 /* InClosingTagName */;
      this.sectionStart = this.index + 1;
    } else {
      this.state = 1 /* Text */;
    }
  }
  // 解析文本
  stateText(str) {
    if (str == "<") {
      if (this.sectionStart < this.index) {
        this.cbs.ontext(this.sectionStart, this.index);
      }
      this.state = 5 /* BeforeTagName */;
      this.sectionStart = this.index;
    }
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
var currentOpenTag;
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
var stack = [];
function addNode(node) {
  const lastNode = stack.at(-1);
  if (lastNode) {
    lastNode.children.push(node);
  } else {
    currentRoot.children.push(node);
  }
}
function setLocend(nodeLoc, end) {
  nodeLoc.source = getSlice(nodeLoc.start.offset, end);
  nodeLoc.end = tokenizer.getPos(end);
}
var tokenizer = new Tokenizer({
  ontext(start, end) {
    const content = getSlice(start, end);
    const textNode = {
      content,
      type: 2 /* TEXT */,
      loc: getLoc(start, end)
    };
    addNode(textNode);
  },
  onopentagname(start, end) {
    const tag = getSlice(start, end);
    currentOpenTag = {
      type: 1 /* ELEMENT */,
      tag,
      children: [],
      loc: getLoc(start - 1, end)
    };
  },
  onopentagend() {
    addNode(currentOpenTag);
    stack.push(currentOpenTag);
    currentOpenTag = null;
  },
  onclosetag(start, end) {
    const name = getSlice(start, end);
    const lastNode = stack.pop();
    if (lastNode.tag === name) {
      setLocend(lastNode.loc, end + 1);
    } else {
      console.warn("\u6807\u7B7E\u4E0D\u5408\u6CD5");
    }
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
