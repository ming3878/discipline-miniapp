// 云数据库封装：直接操作数据库，依赖集合权限「仅创建者可读写」实现多用户隔离
// 集合：habits（戒断目标卡）、checkins（破戒记录）
const db = wx.cloud.database();

const HABITS = 'habits';
const CHECKINS = 'checkins';
const PAGE = 100; // 小程序端单次查询上限
const MAX_COUNT = 99; // 单次破戒次数上限，页面与写入层共用同一个口径

function now() {
  return Date.now();
}

// 次数归一化：非整数/越界一律收敛到 [1, MAX_COUNT]
// 客户端校验可被绕过（直接调 SDK），写入层再收敛一次，避免脏数据污染统计
function normalizeCount(count) {
  const n = Math.floor(Number(count));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_COUNT);
}

// ---------- 记录缓存 ----------
// 多个页面 onShow / 翻月会重复拉同一批数据，用短 TTL 缓存省掉重复请求
// 本机任何写操作后立即失效；另一台设备的写入靠 TTL 兜底，不会长时间看到旧数据
const CACHE_TTL = 15000;
let cacheAll = null; // { data, at }
const cacheByHabit = {}; // habitId -> { data, at }

function fresh(entry) {
  return !!entry && Date.now() - entry.at < CACHE_TTL;
}

function invalidateCheckins() {
  cacheAll = null;
  for (const k in cacheByHabit) delete cacheByHabit[k];
}

// ---------- 戒断目标 habits ----------

async function getHabits() {
  // 小程序端单次 get() 默认只返回 20 条，显式放宽到 100 避免静默截断
  const res = await db.collection(HABITS).orderBy('order', 'asc').limit(PAGE).get();
  return res.data;
}

async function addHabit(data) {
  const count = await db.collection(HABITS).count();
  const res = await db.collection(HABITS).add({
    data: {
      name: data.name,
      subtitle: data.subtitle || '',
      icon: data.icon || '✨',
      startDate: data.startDate,
      periodType: data.periodType, // day | week | month
      limit: data.limit,
      order: count.total,
      createdAt: now(),
      updatedAt: now()
    }
  });
  return res._id;
}

async function updateHabit(id, data) {
  await db.collection(HABITS).doc(id).update({
    data: Object.assign({}, data, { updatedAt: now() })
  });
}

// 删除戒断目标：先分批删掉其全部破戒记录，再删戒断目标本身
async function deleteHabit(id) {
  const records = await getCheckinsByHabit(id);
  for (let i = 0; i < records.length; i += 20) {
    await Promise.all(
      records.slice(i, i + 20).map((r) => db.collection(CHECKINS).doc(r._id).remove())
    );
  }
  await db.collection(HABITS).doc(id).remove();
  invalidateCheckins();
}

async function reorderHabits(orderedIds) {
  await Promise.all(
    orderedIds.map((id, index) =>
      db.collection(HABITS).doc(id).update({ data: { order: index, updatedAt: now() } })
    )
  );
}

// ---------- 破戒记录 checkins ----------

// 分页拉全量记录
// 排序用 date + createdAt 双键：单键排序在同一天有多条记录时页边界不确定，会重复或漏记录
// skip 分页在翻页期间若有新写入会整体偏移，用 _id 去重兜底（同会话有缓存，窗口极小）
async function getAllCheckins() {
  if (fresh(cacheAll)) return cacheAll.data;
  const all = [];
  const seen = new Set();
  let skip = 0;
  while (true) {
    const res = await db
      .collection(CHECKINS)
      .orderBy('date', 'desc')
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(PAGE)
      .get();
    for (const r of res.data) {
      if (!seen.has(r._id)) {
        seen.add(r._id);
        all.push(r);
      }
    }
    if (res.data.length < PAGE) break;
    skip += PAGE;
  }
  cacheAll = { data: all, at: Date.now() };
  return all;
}

async function getCheckinsByHabit(habitId) {
  // 全表缓存已命中时直接派生，不再发请求
  if (fresh(cacheAll)) return cacheAll.data.filter((r) => r.habitId === habitId);
  const hit = cacheByHabit[habitId];
  if (fresh(hit)) return hit.data;
  const all = [];
  const seen = new Set();
  let skip = 0;
  while (true) {
    const res = await db
      .collection(CHECKINS)
      .where({ habitId })
      .orderBy('date', 'desc')
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(PAGE)
      .get();
    for (const r of res.data) {
      if (!seen.has(r._id)) {
        seen.add(r._id);
        all.push(r);
      }
    }
    if (res.data.length < PAGE) break;
    skip += PAGE;
  }
  cacheByHabit[habitId] = { data: all, at: Date.now() };
  return all;
}

// 只取该戒断目标最早的破戒日期（编辑起点时用作上限，避免为拿一个日期拉全量）
async function getEarliestCheckinDate(habitId) {
  let cached = null;
  if (fresh(cacheAll)) cached = cacheAll.data;
  else if (fresh(cacheByHabit[habitId])) cached = cacheByHabit[habitId].data;
  if (cached) {
    const dates = cached.filter((r) => r.habitId === habitId).map((r) => r.date);
    return dates.length ? dates.sort()[0] : '';
  }
  const res = await db
    .collection(CHECKINS)
    .where({ habitId })
    .orderBy('date', 'asc')
    .limit(1)
    .get();
  return res.data.length ? res.data[0].date : '';
}

// 新增一条破戒记录（同一天可多条，统计时按 date 聚合累加）
async function addCheckin({ habitId, date, count, note }) {
  const res = await db.collection(CHECKINS).add({
    data: {
      habitId,
      date,
      count: normalizeCount(count),
      note: note || '',
      createdAt: now()
    }
  });
  invalidateCheckins();
  return res._id;
}

async function deleteCheckin(id) {
  await db.collection(CHECKINS).doc(id).remove();
  invalidateCheckins();
}

async function getHabitById(id) {
  const res = await db.collection(HABITS).doc(id).get();
  return res.data;
}

module.exports = {
  db,
  MAX_COUNT,
  getHabits,
  addHabit,
  updateHabit,
  deleteHabit,
  reorderHabits,
  getHabitById,
  getAllCheckins,
  getCheckinsByHabit,
  getEarliestCheckinDate,
  addCheckin,
  deleteCheckin,
  invalidateCheckins
};
