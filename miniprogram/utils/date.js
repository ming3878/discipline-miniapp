// 日期工具：全部基于本地时间（用户手机时区）
// 核心约定：日期键统一为 'YYYY-MM-DD'，月份键为 'YYYY-MM'

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dateKey(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayKey() {
  return dateKey(new Date());
}

function monthKey(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function shiftDay(key, offset) {
  const dt = parseKey(key);
  dt.setDate(dt.getDate() + offset);
  return dateKey(dt);
}

// 两个日期键的自然日差（b - a），可正可负
function diffDays(a, b) {
  const da = parseKey(a);
  const db = parseKey(b);
  return Math.round((db - da) / 86400000);
}

// 该日期所在自然周的周一
function weekStart(key) {
  const dt = parseKey(key);
  const wd = dt.getDay(); // 0=周日
  const back = wd === 0 ? 6 : wd - 1;
  return shiftDay(key, -back);
}

// 该日期所在自然周的周日
function weekEnd(key) {
  return shiftDay(weekStart(key), 6);
}

// 某周从周一到周日的 7 个日期键
function weekKeys(key) {
  const start = weekStart(key);
  const arr = [];
  for (let i = 0; i < 7; i++) arr.push(shiftDay(start, i));
  return arr;
}

// 该月第一天 / 最后一天的日期键
function monthFirst(key) {
  return key + '-01';
}

function monthLast(key) {
  const [y, m] = key.split('-').map(Number);
  const dt = new Date(y, m, 0);
  return dateKey(dt);
}

// 某月的全部日期键（用于月历）
function monthKeys(key) {
  const last = Number(monthLast(key).slice(-2));
  const arr = [];
  for (let d = 1; d <= last; d++) arr.push(`${key}-${pad(d)}`);
  return arr;
}

// 某月 1 号是星期几（0=周日），用于月历首行占位
function monthFirstWeekday(key) {
  return parseKey(monthFirst(key)).getDay();
}

// 最近 n 个月的月份键（含当前月），从早到晚
function lastNMonths(n, endKey) {
  const end = (endKey || todayKey()).slice(0, 7);
  const [y, m] = end.split('-').map(Number);
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(y, m - 1 - i, 1);
    arr.push(monthKey(dt));
  }
  return arr;
}

function shiftMonth(key, offset) {
  const [y, m] = key.split('-').map(Number);
  const dt = new Date(y, m - 1 + offset, 1);
  return monthKey(dt);
}

function weekdayLabel(key) {
  return ['日', '一', '二', '三', '四', '五', '六'][parseKey(key).getDay()];
}

function shortDate(key) {
  const [, m, d] = key.split('-');
  return `${Number(m)}/${Number(d)}`;
}

function monthLabel(key) {
  const [, m] = key.split('-');
  return `${Number(m)}月`;
}

module.exports = {
  pad,
  parseKey,
  dateKey,
  todayKey,
  monthKey,
  shiftDay,
  diffDays,
  weekStart,
  weekEnd,
  weekKeys,
  monthFirst,
  monthLast,
  monthKeys,
  monthFirstWeekday,
  lastNMonths,
  shiftMonth,
  weekdayLabel,
  shortDate,
  monthLabel
};
