// 云数据库封装：直接操作数据库，依赖集合权限「仅创建者可读写」实现多用户隔离
// 集合：habits（戒断目标卡）、checkins（破戒记录）
const db = wx.cloud.database();

const HABITS = 'habits';
const CHECKINS = 'checkins';
const PAGE = 100; // 小程序端单次查询上限

function now() {
  return Date.now();
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
async function getAllCheckins() {
  let all = [];
  let skip = 0;
  while (true) {
    const res = await db.collection(CHECKINS).orderBy('date', 'desc').skip(skip).limit(PAGE).get();
    all = all.concat(res.data);
    if (res.data.length < PAGE) break;
    skip += PAGE;
  }
  return all;
}

async function getCheckinsByHabit(habitId) {
  let all = [];
  let skip = 0;
  while (true) {
    const res = await db
      .collection(CHECKINS)
      .where({ habitId })
      .orderBy('date', 'desc')
      .skip(skip)
      .limit(PAGE)
      .get();
    all = all.concat(res.data);
    if (res.data.length < PAGE) break;
    skip += PAGE;
  }
  return all;
}

// 新增一条破戒记录（同一天可多条，统计时按 date 聚合累加）
async function addCheckin({ habitId, date, count, note }) {
  const res = await db.collection(CHECKINS).add({
    data: {
      habitId,
      date,
      count: count || 1,
      note: note || '',
      createdAt: now()
    }
  });
  return res._id;
}

async function deleteCheckin(id) {
  await db.collection(CHECKINS).doc(id).remove();
}

async function getHabitById(id) {
  const res = await db.collection(HABITS).doc(id).get();
  return res.data;
}

module.exports = {
  db,
  getHabits,
  addHabit,
  updateHabit,
  deleteHabit,
  reorderHabits,
  getHabitById,
  getAllCheckins,
  getCheckinsByHabit,
  addCheckin,
  deleteCheckin
};
