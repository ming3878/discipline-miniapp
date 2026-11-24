// db.js 单测：次数归一化 / 双键排序分页 / 缓存与失效 / 按目标查询 / 最早日期
// 用法：node tools/test-db.js
// 原理：用内存 mock 替换 wx.cloud.database()，直接跑真实的 db.js 逻辑

const path = require('path');

// ---------------- 内存数据库 mock ----------------
function createState(seed) {
  return {
    habits: seed.habits || [],
    checkins: seed.checkins || [],
    calls: [],
    // 模拟 skip 分页在翻页期间数据变动导致的页偏移：第二页起整体错位 1 条
    shiftPages: false
  };
}

class Query {
  constructor(name, state) {
    this.name = name;
    this.state = state;
    this.orders = [];
    this.wheres = [];
    this.sk = 0;
    this.lim = 20;
  }
  orderBy(field, dir) {
    this.orders.push([field, dir]);
    return this;
  }
  where(cond) {
    this.wheres.push(cond);
    return this;
  }
  skip(n) {
    this.sk = n;
    return this;
  }
  limit(n) {
    this.lim = n;
    return this;
  }
  async get() {
    this.state.calls.push({ op: 'get', name: this.name, skip: this.sk, limit: this.lim, orders: this.orders, wheres: this.wheres });
    let rows = this.state[this.name].filter((r) =>
      this.wheres.every((w) => Object.keys(w).every((k) => r[k] === w[k]))
    );
    // 多字段排序：后声明的优先级更低，从后往前稳定排序
    for (const [field, dir] of this.orders.slice().reverse()) {
      rows.sort((a, b) => {
        const x = a[field];
        const y = b[field];
        if (x === y) return 0;
        return (x < y ? -1 : 1) * (dir === 'desc' ? -1 : 1);
      });
    }
    let from = this.sk;
    if (this.state.shiftPages && this.sk > 0) from = Math.max(0, this.sk - 1);
    const page = rows.slice(from, from + this.lim).map((r) => JSON.parse(JSON.stringify(r)));
    return { data: page };
  }
  async add({ data }) {
    this.state.calls.push({ op: 'add', name: this.name });
    const _id = 'id_' + this.state[this.name].length + '_' + Math.random().toString(36).slice(2, 6);
    const row = Object.assign({ _id }, data);
    this.state[this.name].push(row);
    return { _id };
  }
  async count() {
    return { total: this.state[this.name].length };
  }
  doc(id) {
    const state = this.state;
    const name = this.name;
    return {
      async get() {
        const r = state[name].find((x) => x._id === id);
        if (!r) throw new Error('document not found');
        return { data: r };
      },
      async update({ data }) {
        const r = state[name].find((x) => x._id === id);
        Object.assign(r, data);
        return { stats: { updated: 1 } };
      },
      async remove() {
        state[name] = state[name].filter((x) => x._id !== id);
        return { stats: { removed: 1 } };
      }
    };
  }
}

function installMock(state) {
  global.wx = {
    cloud: {
      database: () => ({
        collection: (name) => new Query(name, state)
      })
    }
  };
}

// ---------------- 断言 ----------------
let pass = 0;
let fail = 0;
function ok(cond, label, extra) {
  if (cond) {
    pass++;
    console.log('  PASS ' + label);
  } else {
    fail++;
    console.log('  FAIL ' + label + (extra === undefined ? '' : ' → ' + JSON.stringify(extra)));
  }
}
function eq(actual, expected, label) {
  ok(actual === expected, label, { actual, expected });
}

// ---------------- 造数据 ----------------
function makeCheckins(n) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    // 每 3 条共用同一个 date，用来验证同日期下按 createdAt 的二级排序
    const day = 1 + Math.floor(i / 3);
    rows.push({
      _id: 'c' + i,
      habitId: i % 2 === 0 ? 'h1' : 'h2',
      date: '2026-11-' + String(day).padStart(2, '0'),
      count: 1,
      note: '',
      createdAt: 1000 + i
    });
  }
  return rows;
}

async function main() {
  // ---------- T1 次数归一化 ----------
  console.log('\n[T1] 写入层次数归一化（防止绕过前端写入脏数据）');
  let state = createState({ habits: [], checkins: [] });
  installMock(state);
  delete require.cache[require.resolve('../miniprogram/utils/db.js')];
  let DB = require('../miniprogram/utils/db.js');

  const cases = [
    [0, 1, '0 → 1'],
    [-5, 1, '负值 → 1'],
    [100, 99, '100 → 99'],
    [2.7, 2, '2.7 → 2（向下取整）'],
    ['3', 3, '字符串 "3" → 3'],
    [undefined, 1, 'undefined → 1'],
    [null, 1, 'null → 1']
  ];
  for (const [input, expect, label] of cases) {
    await DB.addCheckin({ habitId: 'h1', date: '2026-11-01', count: input });
    const saved = state.checkins[state.checkins.length - 1];
    eq(saved.count, expect, 'count ' + label);
  }
  ok(state.checkins.every((r) => Number.isInteger(r.count)), '落库 count 全为整数');

  // ---------- T2 分页与排序 ----------
  console.log('\n[T2] 分页拉全量：双键排序 + 重复去重');
  state = createState({ checkins: makeCheckins(250) });
  installMock(state);
  delete require.cache[require.resolve('../miniprogram/utils/db.js')];
  DB = require('../miniprogram/utils/db.js');

  const all = await DB.getAllCheckins();
  eq(all.length, 250, '250 条跨 3 页全部取回');
  eq(new Set(all.map((r) => r._id)).size, 250, '无重复记录');
  const sortedRight = all.every((r, i) => {
    if (i === 0) return true;
    const p = all[i - 1];
    if (p.date !== r.date) return p.date > r.date;
    return (p.createdAt || 0) >= (r.createdAt || 0);
  });
  ok(sortedRight, '顺序为 date desc + createdAt desc');

  // 翻页期间数据变动导致页偏移 → 去重兜底
  state = createState({ checkins: makeCheckins(250) });
  state.shiftPages = true;
  installMock(state);
  delete require.cache[require.resolve('../miniprogram/utils/db.js')];
  DB = require('../miniprogram/utils/db.js');
  const shifted = await DB.getAllCheckins();
  eq(new Set(shifted.map((r) => r._id)).size, shifted.length, '页偏移时返回结果仍无重复 _id');

  // ---------- T3 缓存 ----------
  console.log('\n[T3] 缓存：命中不发请求，写操作后失效');
  state = createState({ checkins: makeCheckins(10) });
  installMock(state);
  delete require.cache[require.resolve('../miniprogram/utils/db.js')];
  DB = require('../miniprogram/utils/db.js');

  const countGet = () => state.calls.filter((c) => c.op === 'get' && c.name === 'checkins').length;
  await DB.getAllCheckins();
  const afterFirst = countGet();
  await DB.getAllCheckins();
  eq(countGet(), afterFirst, '第二次调用命中缓存，未发新请求');

  await DB.addCheckin({ habitId: 'h1', date: '2026-11-30', count: 1 });
  await DB.getAllCheckins();
  ok(countGet() > afterFirst, '写入后缓存失效，重新拉取');

  // TTL 过期后自动重新拉取
  const realNow = Date.now;
  let clock = realNow();
  Date.now = () => clock;
  try {
    const base = countGet();
    await DB.getAllCheckins();
    eq(countGet(), base, 'TTL 内命中缓存');
    clock += 16000; // 超过 CACHE_TTL
    await DB.getAllCheckins();
    ok(countGet() > base, 'TTL 过期后重新拉取');
  } finally {
    Date.now = realNow;
  }

  // ---------- T4 按目标下推 ----------
  console.log('\n[T4] 单目标查询：命中全表缓存零请求，未命中只查本目标');
  state = createState({ checkins: makeCheckins(20) });
  installMock(state);
  delete require.cache[require.resolve('../miniprogram/utils/db.js')];
  DB = require('../miniprogram/utils/db.js');

  const full = await DB.getAllCheckins();
  const before = countGet();
  const h1 = await DB.getCheckinsByHabit('h1');
  eq(countGet(), before, '全表缓存命中时 getCheckinsByHabit 不发请求');
  eq(h1.length, full.filter((r) => r.habitId === 'h1').length, '派生结果与该目标记录数一致');
  ok(h1.every((r) => r.habitId === 'h1'), '派生结果不含其他目标记录');

  DB.invalidateCheckins();
  const c0 = countGet();
  const h2 = await DB.getCheckinsByHabit('h2');
  eq(countGet(), c0 + 1, '未命中缓存时只发 1 次请求（非全表翻页）');
  const lastCall = state.calls[state.calls.length - 1];
  ok(JSON.stringify(lastCall.wheres) === JSON.stringify([{ habitId: 'h2' }]), '查询条件下推为 habitId');
  ok(h2.every((r) => r.habitId === 'h2'), '结果只包含该目标记录');

  // ---------- T5 最早破戒日期 ----------
  console.log('\n[T5] 最早破戒日期：只取 1 条，不拉全量');
  state = createState({ checkins: makeCheckins(50) });
  installMock(state);
  delete require.cache[require.resolve('../miniprogram/utils/db.js')];
  DB = require('../miniprogram/utils/db.js');

  const earliest = await DB.getEarliestCheckinDate('h1');
  const call = state.calls[state.calls.length - 1];
  eq(call.limit, 1, '查询 limit=1');
  eq(call.orders[0][1], 'asc', '按 date 升序取第一条');
  const expectDate = makeCheckins(50)
    .filter((r) => r.habitId === 'h1')
    .map((r) => r.date)
    .sort()[0];
  eq(earliest, expectDate, '返回值是真正最早的日期');

  // 缓存命中时从内存派生
  DB.invalidateCheckins();
  await DB.getAllCheckins();
  const cBefore = state.calls.length;
  const earliest2 = await DB.getEarliestCheckinDate('h1');
  eq(state.calls.length, cBefore, '缓存命中时不发请求');
  eq(earliest2, expectDate, '缓存派生结果一致');

  // 无记录时返回空串
  const none = await DB.getEarliestCheckinDate('h_not_exist');
  eq(none, '', '无记录返回空字符串');

  console.log('\n' + (fail === 0 ? 'PASS' : 'FAIL') + ' 共 ' + (pass + fail) + ' 项：' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('执行异常：', err);
  process.exit(1);
});
