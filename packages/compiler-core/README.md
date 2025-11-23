# 概念篇

## 运行时

代码在浏览器运行的时候，就是运行时

## 编译时

编译时一般是在 构建工具(打包工具)中进行使用
将模板编译成 js 的过程，就是编译时。这是由于浏览器只能运行 js 文件，因此需要将 .vue 等文件编译成 js 文件，这个过程就叫编译时

### ast 语法树

ast 语法树(抽象语法树)，是指将源代码进行抽象化的转换为树形结构，它不会依赖任何源代码的语法。通过 ast 语法树能够将我们编写的字符串转换为有逻辑的树形结构，从而使得计算机更好的解析

#### 过程:

1. 把 vue 文件的所有内容当作一个字符串，转换成 ast 语法树(他是用来描述语法的一个对象)，它是一个对象
2. 把 ast 语法树转换为我们运行时的代码 'createElementBlock' | 'createVNode' 等

##### ast 语法树常见的地方

查看代码解析出 ast 语法树的网站
https://astexplorer.net/
babel 、 prettierrc 、 eslint 都是基于 ast 语法树

```js
<div id="1">{{ 123 }}</div> ==>
const ast = {
  type: 1, // div 对应的标记是 1
  tag: 'div',
  props: [
    type: 3, // 假设 id 的类型为 3
    name: 'id',
    content: "1",
  ]
  children: [
    {
      type: 2, // 表达式的类型是 4
      content: 'setupstate.msg',
    }
  ]
}

// 把上方这个 ast 语法树转换为运行时的代码的这个过程就叫编译
const vode = createElementBlock('div', { id: "1" }, ['123'])
```

#### ast 语法树类型枚举值

```ts
export enum NodeTypes {
  // 根节点
  ROOT,
  // 元素节点
  ELEMENT,
  // 文本节点
  TEXT,
  // 注释节点
  COMMENT,
  // 简单表达式节点
  SIMPLE_EXPRESSION,
  // 插值节点，例如 {{ value }}
  INTERPOLATION,
  // 属性节点
  ATTRIBUTE,
  // 指令节点，例如 v-if、v-for 等
  DIRECTIVE,
  // 容器节点
  // 复合表达式节点，包含多个子表达式
  COMPOUND_EXPRESSION,
  // if 条件节点
  IF,
  // if 分支节点
  IF_BRANCH,
  // for 循环节点
  FOR,
  // 文本调用节点
  TEXT_CALL,
  // 代码生成相关节点
  // 虚拟节点调用
  VNODE_CALL,
  // 函数调用表达式
  JS_CALL_EXPRESSION,
  // 对象表达式
  JS_OBJECT_EXPRESSION,
  // 对象属性
  JS_PROPERTY,
  // 数组表达式
  JS_ARRAY_EXPRESSION,
  // 函数表达式
  JS_FUNCTION_EXPRESSION,
  // 条件表达式
  JS_CONDITIONAL_EXPRESSION,
  // 缓存表达式
  JS_CACHE_EXPRESSION,
}
```

#### 解析器的状态

```ts
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
```
