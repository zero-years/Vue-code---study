/**
 * 打包开发环境
 *
 * node script/dev.js --format cjs
 */
import { parseArgs } from 'node:util'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'
import { createRequire } from 'node:module'

/**
 * 解析命令行参数
 */
const {
  values: { format },
  positionals,
} = parseArgs({
  allowPositionals: true,
  options: {
    format: {
      type: 'string',
      short: 'f',
      default: 'esm',
    },
  },
})

// 创建 esm 的 __filename
const __filename = fileURLToPath(import.meta.url)
// 创建 esm 的 __dirname
const __dirname = dirname(__filename)

const require = createRequire(import.meta.url)
const target = positionals.length ? positionals[0] : 'vue'

const entry = resolve(__dirname, `../packages/${target}/src/index.ts`)

/**
 * --format cjs(commandjs) / esm(esmodule)
 * cjs => reactivity.cjs.js
 * esm => reactivity.esm.js
 */
const outfile = resolve(
  __dirname,
  `../packages/${target}/dist/${target}.${format}.js`,
)

const pkg = require(`../packages/${target}/package.json`)

console.log(pkg)

esbuild
  .context({
    entryPoints: [entry], //入口文件
    outfile, //输出文件
    format, // 打包格式 cjs esm iife
    platform: format == 'cjs' ? 'node' : 'browser', // 打包平台 node 浏览器
    sourcemap: true, // 开启 sourcemap 方便调试
    bundle: true, // 把所有依赖打包到一个文件中
    globalName: pkg.buildOptions.name, // name
  })
  .then(ctx => ctx.watch())
