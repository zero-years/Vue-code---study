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
