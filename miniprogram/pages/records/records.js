// 记录明细页（FR-06）：按月筛选、倒序、单条删除
const DB = require('../../utils/db.js');
const D = require('../../utils/date.js');

Page({
  data: {
    habitId: '',
    habitName: '',
    allRecords: [],
    months: [],        // 有记录的月份 + '全部'
    monthIndex: 0,     // 默认最近一个月
    displayRecords: [],
    totalText: ''
  },

  async onLoad(options) {
    this.setData({ habitId: options.id || '' });
    await this.loadData();
  },

  onShow() {
    if (this.data.habitId) this.loadData();
  },

  async loadData() {
    try {
      const [habit, allCheckins] = await Promise.all([
        DB.getHabitById(this.data.habitId),
        DB.getAllCheckins()
      ]);
      const records = allCheckins.filter((r) => r.habitId === this.data.habitId).slice().sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      // 有记录的月份（倒序）+ 全部选项
      const monthSet = Array.from(new Set(records.map((r) => r.date.slice(0, 7)))).sort().reverse();
      const months = [{ key: '', label: '全部' }].concat(
        monthSet.map((m) => ({ key: m, label: `${Number(m.slice(0, 4))} 年 ${Number(m.slice(5))} 月` }))
      );
      // 默认选中最近一个月（index 1，index 0 是"全部"）；刷新后保留原选择
      let monthIndex = this.data.monthIndex || 1;
      if (monthIndex >= months.length) monthIndex = 1;
      this.setData({
        habitName: habit ? habit.name : '主题',
        allRecords: records,
        months,
        monthIndex
      }, () => this.applyFilter());
      if (habit) wx.setNavigationBarTitle({ title: habit.name + ' · 明细' });
    } catch (err) {
      console.error('[记录明细] 加载失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onMonthChange(e) {
    this.setData({ monthIndex: Number(e.detail.value) }, () => this.applyFilter());
  },

  applyFilter() {
    const { allRecords, months, monthIndex } = this.data;
    const selected = months[monthIndex];
    const isMonth = !!(selected && selected.key);
    const list = isMonth
      ? allRecords.filter((r) => r.date.slice(0, 7) === selected.key)
      : allRecords;
    const total = list.reduce((s, r) => s + (Number(r.count) || 0), 0);
    // WXML 不支持 .slice()，预处理日/月显示字段
    const displayRecords = list.map((r) => Object.assign({}, r, {
      dayDisplay: r.date.slice(8),
      monthDisplay: r.date.slice(5, 7)
    }));
    // 底部统计口径随筛选变化：全部才说「合计」，按月份只看该月
    let totalText;
    if (isMonth) {
      const y = selected.key.slice(0, 4);
      const m = Number(selected.key.slice(5));
      const prefix = y === D.todayKey().slice(0, 4) ? `${m} 月` : `${y} 年 ${m} 月`;
      totalText = `${prefix} · ${list.length} 条记录 · 破戒 ${total} 次`;
    } else {
      totalText = `共 ${list.length} 条记录 · 合计破戒 ${total} 次`;
    }
    this.setData({ displayRecords, totalText });
  },

  async deleteRecord(e) {
    const id = e.currentTarget.dataset.id;
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '删除记录',
        content: '确定删除这条破戒记录？删除后所有统计会自动重算。',
        confirmText: '删除',
        cancelText: '取消',
        confirmColor: '#C0533B',
        success: (res) => resolve(!!res.confirm),
        fail: () => resolve(false)
      });
    });
    if (!confirmed) return;
    try {
      await DB.deleteCheckin(id);
      wx.showToast({ title: '已删除', icon: 'success' });
      this.loadData();
    } catch (err) {
      console.error('[记录明细] 删除失败', err);
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  }
});
