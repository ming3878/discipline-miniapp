// 设计系统落地：颜色对齐 + 字号收敛
// 用法：node tools/apply-design-system.js [--write]
// 不带 --write 时只打印将要发生的改动（dry run）
const fs = require('fs');
const path = require('path');

const WRITE = process.argv.includes('--write');

const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.wxss')) files.push(p);
  }
})('miniprogram');

// 装饰性选择器：保留浅色，不参与文字色提深
const FAINT_SKIP = ['.step-btn.off', '.c-before', '.input .arrow', '.filter .arr', '.faint'];
// 图标/emoji 尺寸：不参与字号体系
const ICON_SKIP = ['empty-ic', 'emoji', 'step-btn'];

// 字号映射：旧 rpx -> 令牌
const SIZE_TOKEN = {
  80: 'var(--t-num)',
  56: 'var(--t-num-2)',
  44: 'var(--t-h)',
  36: 'var(--t-h2)',
  32: 'var(--t-body)',
  28: 'var(--t-sub)',
  24: 'var(--t-cap)'
};
const SIZE_MAP = {
  22: 24, 24: 24, 25: 24,
  26: 28, 28: 28,
  30: 32, 31: 32, 32: 32,
  33: 36, 34: 36, 35: 36, 36: 36,
  40: 44, 45: 44, 47: 44, 48: 44,
  58: 56, 61: 56,
  80: 80
};

const changes = [];
const skipped = [];

for (const file of files) {
  let css = fs.readFileSync(file, 'utf8');
  const short = file.replace(/^miniprogram\//, '');
  const blocks = css.split('}');

  const out = blocks.map((block) => {
    const i = block.lastIndexOf('{');
    if (i < 0) return block;
    const sel = block.slice(0, i).trim().split('\n').pop().trim();
    let body = block.slice(i + 1);
    const before = body;

    // ---- 1. 文字色：装饰选择器以外，faint 一律提深到 sub ----
    if (/color:\s*var\(--faint\)/.test(body)) {
      if (FAINT_SKIP.includes(sel)) {
        skipped.push(['faint保留', short, sel]);
      } else {
        body = body.replace(/color:\s*var\(--faint\)/g, 'color: var(--sub)');
        changes.push(['faint→sub', short, sel]);
      }
    }

    // ---- 2. 语义绿做文字色：一律换成深绿 ----
    if (/color:\s*var\(--sage\)/.test(body)) {
      body = body.replace(/color:\s*var\(--sage\)/g, 'color: var(--sage-ink)');
      changes.push(['sage→sage-ink', short, sel]);
    }

    // ---- 3. 字号：图标跳过，其余吸附到令牌 ----
    const m = body.match(/font-size:\s*(\d+)rpx/);
    if (m) {
      const old = Number(m[1]);
      const isIcon = ICON_SKIP.some((k) => sel.includes(k));
      if (isIcon) {
        skipped.push(['图标尺寸', short, sel + ' ' + old + 'rpx']);
      } else if (SIZE_MAP[old]) {
        const token = SIZE_TOKEN[SIZE_MAP[old]];
        body = body.replace(/font-size:\s*\d+rpx/, 'font-size: ' + token);
        if (SIZE_MAP[old] !== old) changes.push(['字号 ' + old + '→' + SIZE_MAP[old], short, sel]);
      } else {
        skipped.push(['未映射字号', short, sel + ' ' + old + 'rpx']);
      }
    }

    return before === body ? block : block.slice(0, i + 1) + body;
  });

  const next = out.join('}');
  if (WRITE && next !== css) fs.writeFileSync(file, next, 'utf8');
}

const group = (list) => {
  const g = {};
  for (const [type, file, sel] of list) (g[type] = g[type] || []).push(file + ' :: ' + sel);
  return g;
};

console.log(WRITE ? '=== 已写入 ===' : '=== DRY RUN（未写入，加 --write 生效）===');
for (const [type, items] of Object.entries(group(changes))) {
  console.log('\n[' + type + '] ' + items.length + ' 处');
  for (const it of items) console.log('  ' + it);
}
console.log('\n=== 跳过 ===');
for (const [type, items] of Object.entries(group(skipped))) {
  console.log('\n[' + type + '] ' + items.length + ' 处');
  for (const it of items) console.log('  ' + it);
}
