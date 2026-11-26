#!/usr/bin/env node
/**
 * 校验「设计原型」与「实现代码」的设计令牌是否一致。
 *
 * 背景：色值同时写在两处 —— miniprogram/app.wxss 的 page{} 与 design/界面设计原型.html 的 :root{}。
 * 两处都手写，改了一处忘另一处就会静默分叉（本轮之前就发生过：原型还在用旧的 #6B7A72 / #9AA096）。
 * 语法检查抓不到这类问题，所以单独做一个比对。
 *
 * 用法：
 *   node tools/check-tokens-sync.js          # 只比对
 *   node tools/check-tokens-sync.js --strict # 不一致时退出码 1（可用于 CI / 提交前）
 *
 * 只比颜色令牌（#RRGGBB）。尺寸类令牌两边单位不同（rpx vs px），按换算关系单独核对。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WXSS = path.join(ROOT, 'miniprogram/app.wxss');
const PROTO = path.join(ROOT, 'design/界面设计原型.html');

const strict = process.argv.includes('--strict');

function readColorTokens(css, blockStart, blockEnd) {
  const start = css.indexOf(blockStart);
  if (start < 0) throw new Error(`找不到 ${blockStart}`);
  const end = css.indexOf(blockEnd, start);
  const block = css.slice(start, end < 0 ? css.length : end);
  const out = {};
  // 匹配 --name: #RRGGBB
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{6})\b/g)) {
    out[m[1]] = m[2].toUpperCase();
  }
  return out;
}

const wxss = fs.readFileSync(WXSS, 'utf8');
// app.wxss 的令牌写在 page{...} 里，取到第一个闭合大括号为止（令牌全部在开头）
const code = readColorTokens(wxss, 'page {', '\n}');
const protoHtml = fs.readFileSync(PROTO, 'utf8');
const proto = readColorTokens(protoHtml, ':root{', '}');

const onlyCode = Object.keys(code).filter((k) => !(k in proto));
const onlyProto = Object.keys(proto).filter((k) => !(k in code));
const mismatch = Object.keys(code)
  .filter((k) => k in proto && code[k] !== proto[k])
  .map((k) => ({ token: k, code: code[k], proto: proto[k] }));

console.log(`代码 app.wxss  颜色令牌 ${Object.keys(code).length} 个`);
console.log(`原型 :root     颜色令牌 ${Object.keys(proto).length} 个`);
console.log('');

let bad = 0;

if (mismatch.length) {
  bad += mismatch.length;
  console.log('✗ 色值不一致：');
  for (const m of mismatch) {
    console.log(`  ${m.token.padEnd(14)} 代码 ${m.code}   原型 ${m.proto}`);
  }
} else {
  console.log('✓ 共有令牌色值全部一致');
}

if (onlyCode.length) {
  bad += onlyCode.length;
  console.log('✗ 只在代码里定义（原型缺）:', onlyCode.join(', '));
}
if (onlyProto.length) {
  bad += onlyProto.length;
  console.log('✗ 只在原型里定义（代码缺）:', onlyProto.join(', '));
}

// 字号：代码 rpx → 原型 px，换算系数 318/750
const codeType = {};
for (const m of wxss.matchAll(/(--t-[a-z0-9-]+)\s*:\s*(\d+)rpx/g)) {
  codeType[m[1]] = Number(m[2]);
}
const protoType = {};
for (const m of protoHtml.matchAll(/(--t-[a-z0-9-]+)\s*:\s*([\d.]+)px/g)) {
  protoType[m[1]] = Number(m[2]);
}

console.log('');
const typeKeys = [...new Set([...Object.keys(codeType), ...Object.keys(protoType)])];
if (!typeKeys.length) {
  console.log('（未发现字号令牌，跳过）');
}
for (const k of typeKeys) {
  if (!(k in codeType) || !(k in protoType)) {
    bad++;
    console.log(`✗ ${k} 只在一侧定义`);
    continue;
  }
  const expect = (codeType[k] * 318) / 750;
  const diff = Math.abs(expect - protoType[k]);
  const ok = diff <= 0.35; // 允许四舍五入到 0.5px
  if (!ok) bad++;
  console.log(
    `${ok ? '✓' : '✗'} ${k.padEnd(12)} 代码 ${String(codeType[k]).padStart(3)}rpx` +
      ` → 应为 ${expect.toFixed(2)}px，原型 ${protoType[k]}px`
  );
}

console.log('');
if (bad) {
  console.log(`共 ${bad} 项需处理`);
  if (strict) process.exit(1);
} else {
  console.log('令牌同步检查：全部通过');
}
