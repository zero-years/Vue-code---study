export enum State {
  /** 普通文本状态，处理标签和插值表达式之外的内容 */
  Text = 1,

  /** 插值表达式相关状态 */
  InterpolationOpen, // 开始解析插值表达式 {{
  Interpolation, // 解析插值表达式内容
  InterpolationClose, // 结束解析插值表达式 }}

  /** HTML标签相关状态 */
  BeforeTagName, // 遇到<后的状态，准备解析标签名
  InTagName, // 正在解析标签名
  InSelfClosingTag, // 处理自闭合标签 />
  BeforeClosingTagName, // 处理结束标签的开始 </
  InClosingTagName, // 解析结束标签的标签名
  AfterClosingTagName, // 结束标签名后的状态

  /** 属性和指令相关状态 */
  BeforeAttrName, // 准备解析属性名
  InAttrName, // 解析普通属性名
  InDirName, // 解析指令名（v-if, v-for等）
  InDirArg, // 解析指令参数（v-bind:arg）
  InDirDynamicArg, // 解析动态指令参数（v-bind:[arg]）
  InDirModifier, // 解析指令修饰符（v-on:click.prevent）
  AfterAttrName, // 属性名后的状态
  BeforeAttrValue, // 准备解析属性值
  InAttrValueDq, // 双引号属性值 "value"
  InAttrValueSq, // 单引号属性值 'value'
  InAttrValueNq, // 无引号属性值 value

  /** 声明相关状态 */
  BeforeDeclaration, // <!开始的声明
  InDeclaration, // 解析声明内容

  /** 处理指令相关状态 */
  InProcessingInstruction, // 处理XML处理指令 <?xml ?>

  /** 注释和CDATA相关状态 */
  BeforeComment, // 准备解析注释
  CDATASequence, // 解析CDATA序列
  InSpecialComment, // 特殊注释处理
  InCommentLike, // 类注释内容处理

  /** 特殊标签处理状态 */
  BeforeSpecialS, // 处理<script>或<style>
  BeforeSpecialT, // 处理<title>或<textarea>
  SpecialStartSequence, // 特殊标签的开始序列
  InRCDATA, // 处理RCDATA内容（script/style/textarea等）

  /** 实体解析状态 */
  InEntity, // 解析HTML实体（如&amp;）

  /** SFC相关状态 */
  InSFCRootTagName, // 解析单文件组件根标签名
}

function isTagStart(str) {
  return /[a-zA-Z]/.test(str)
}

export function isWhiteSpace(str) {
  return str == ' ' || str == '\n' || str == '\r' || str == '\t'
}

/**
 * 解析器
 * 基于状态机实现的
 */
export class Tokenizer {
  /**
   * 状态机的状态
   * 状态机就是在不同的状态下去执行不同的操作，他会在解析字符串的时候根据当前解析的字符进行改变
   * 比如:
   * State.Text ==> 表示当前在解析文本
   * State.InTagName ==> 表示当前在解析标签名
   */
  state = State.Text

  // 当前正在解析的字符下标
  index = 0

  /**解析开始的位置，可以理解为当前状态切换时的初始位置
   * hello world 解析完成时 index = 11 ，sectionStart = 0 ，要解析的字符串就为 0 - 11
   * hello<div></div> world ， hello 解析完成时 index = 4 ，sectionStart = 0 ，要解析的字符串就为 0 - 4
   * 然后在将 sectionStart 设置为 5，表示从5开始继续解析
   */
  sectionStart = 0

  // 保存要解析的字符串
  buffer = ''

  constructor(public cbs) {}

  /**
   * 负责遍历字符串，然后输出需要操作的内容的索引
   * @param input
   */
  parse(input) {
    this.buffer = input

    while (this.index < this.buffer.length) {
      const str = this.buffer[this.index]

      // 状态机
      switch (this.state) {
        case State.Text: {
          // 正在解析文本
          this.stateText(str)
          break
        }
        case State.BeforeTagName: {
          // 解析标签名之前的操作
          this.stateBeforeTagName(str)
          break
        }
        case State.InTagName: {
          // 处理头标签名内的内容
          this.stateInTagName(str)
          break
        }
        case State.BeforeAttrName: {
          // 解析头标签中的属性名
          this.stateBeforeAttrName(str)
          break
        }
        case State.InClosingTagName: {
          // 处理尾标签的结束标签
          this.stateInClosingTagName(str)
          break
        }
        case State.InAttrName: {
          // 处理标签内的属性名
          this.stateInAttrName(str)
          break
        }
        case State.AfterAttrName: {
          // 处理属性名称后的内容，直到遇到双引号
          this.stateAfterAttrName(str)
          break
        }
        case State.InAttrValueDq: {
          // 处理双引号中的属性值
          this.stateInAttrValueDq(str)
          break
        }
        case State.Interpolation: {
          this.stateInterpolation(str)
        }
      }

      this.index++
    }

    this.cleanup()
  }

  private stateInterpolation(str: string) {
    // 如果碰到 }} 则表示插值结束
    if (str == '}') {
      if (this.buffer[this.index + 1] == '}') {
        this.index++
        this.cbs.oninterpolation(this.sectionStart, this.index + 1)
        this.state = State.Text
        this.sectionStart = this.index + 1
      }
    }
  }

  private stateInAttrValueDq(str: string) {
    if (str == '"') {
      // 属性值获取完毕
      this.cbs.onattrvalue(this.sectionStart, this.index)

      // 切回去继续解析
      this.state = State.BeforeAttrName
      this.sectionStart = this.index
    }
  }

  private stateAfterAttrName(str: string) {
    if (str == '"') {
      // 遇到双引号，开始解析属性值
      this.state = State.InAttrValueDq
      this.sectionStart = this.index + 1
    }
  }

  // 处理标签内的属性名
  private stateInAttrName(str: string) {
    // 遇到 = 表示属性的名字解析完成
    if (str == '=') {
      this.cbs.onattrname(this.sectionStart, this.index)
      // 属性名解析完毕
      this.state = State.AfterAttrName
    }
  }

  // 处理尾标签的结束标签
  private stateInClosingTagName(str: string) {
    // <div></div>
    if (str == '>') {
      this.cbs.onclosetag(this.sectionStart, this.index)
      // 结束后，需从下一个 str 开始继续运行,否则会包含 >
      this.sectionStart = this.index + 1
      this.state = State.Text
    }
  }

  // 解析头标签中的属性名
  private stateBeforeAttrName(str: string) {
    /**
     * <div id="123"></div>
     * 可能会遇到 空格，字母, >
     */

    if (str == '>') {
      // 开始标签解析完毕
      this.cbs.onopentagend()
      // 解析标签内的内容，默认为文本
      this.sectionStart = this.index + 1
      this.state = State.Text
    } else if (!isWhiteSpace(str)) {
      this.state = State.InAttrName
      this.sectionStart = this.index
    }
  }

  // 处理头标签名内的内容
  private stateInTagName(str: string) {
    // <div></div>
    if (str == '>' || isWhiteSpace(str)) {
      // 标签的名称解析完毕
      this.cbs.onopentagname(this.sectionStart, this.index)

      // 切换为解析属性状态
      this.state = State.BeforeAttrName
      this.sectionStart = this.index
      this.stateBeforeAttrName(str)
    }
  }

  // 解析标签名之前的操作
  private stateBeforeTagName(str: string) {
    // <div></div>
    if (isTagStart(str)) {
      // 表示为开始标签，切换状态
      this.state = State.InTagName
      this.sectionStart = this.index
    } else if (str == '/') {
      // 表示为结束标签 < /div> index = /
      this.state = State.InClosingTagName
      // 结束后，需从下一个 str 开始继续运行,否则会包含 >
      this.sectionStart = this.index + 1
    } else {
      // 并非一个合格的标签,转换为文字处理
      this.state = State.Text
    }
  }

  // 解析文本
  private stateText(str: string) {
    /**
     * 在解析文本的时候，可能会遇到两种情况：
     * 1. 遇到标签 <，需要切换状态去解析标签
     * 2. 遇到插值表达式 {{，需要切换状态去解析插值表达式
     */

    if (str == '<') {
      // 遇到标签，需要切换状态，但切换之前需要将当前的内容进行处理
      if (this.sectionStart < this.index) {
        // 处理之前的文本
        this.cbs.ontext(this.sectionStart, this.index)
      }

      // 切换状态
      this.state = State.BeforeTagName

      // 更新开始位置
      this.sectionStart = this.index
    } else if (str == '{') {
      // 得遇到两个括号才是插值
      if (this.buffer[this.index + 1] == '{') {
        if (this.sectionStart < this.index) {
          // 处理前面多余的文字信息
          this.cbs.ontext(this.sectionStart, this.index)
        }
        // 转换状态
        this.state = State.Interpolation
        this.sectionStart = this.index
      }
    }
  }

  /**
   * 根据 sectionStart 和 index 将一段内容进行处理
   */
  cleanup() {
    if (this.sectionStart < this.index) {
      // 还有没解析的内容
      if (this.state == State.Text) {
        // 要处理的是文本节点
        // 把开始位置和结束位置传过去
        this.cbs.ontext(this.sectionStart, this.index)
        // 处理完成移动 sectionStart 的位置
        this.sectionStart = this.index
      }
    }
  }

  /**
   * 返回指定 index 的位置
   * @param index
   */
  getPos(index) {
    return {
      column: index + 1, // 列号
      line: 1, // 行号 TODO 暂时不考虑换行
      offset: index, // 偏移量
    }
  }
}
