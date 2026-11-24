// 单卡统计页（FR-04）：6 项总览 + 月历破戒图
const DB = require('../../utils/db.js');
const S = require('../../utils/stats.js');
const D = require('../../utils/date.js');

const PERIOD_TEXT = { day: '每天', week: '每周', month: '每月' };

Page({
  data: {
    habitId: '',
    habit: null,
    detail: null,
    month: '',        // 当前浏览月份 YYYY-MM
    monthLabel: '',
    weeks: [],
    canPrev: false,
    canNext: false,
    selectedCell: null,  // 点击日期的详情弹窗
    dayRecords: []
  },

  async onLoad(options) {
    const habitId = options.id || '';
    this.setData({ habitId });
    if (!habitId) {
      wx.showToast({ title: '戒断目标不存在', icon: 'none' });
      return;
    }
    await this.loadData();
  },

  onShow() {
    // 从记录明细删除后返回，重新计算统计
    if (this.data.habitId) this.loadData();
  },

  async loadData() {
    try {
      const today = D.todayKey();
      // 只查本戒断目标的记录：原先拉整张 checkins 表再在前端过滤，数据越多越慢
      const [habit, records] = await Promise.all([
        DB.getHabitById(this.data.habitId),
        DB.getCheckinsByHabit(this.data.habitId)
      ]);
      if (!habit) {
        wx.showToast({ title: '戒断目标不存在', icon: 'none' });
        return;
      }
      // 记录挂在页面实例上，翻月 / 点格子直接复用，不重复请求
      this.habitRaw = habit;
      this.records = records;
      const month = this.data.month || today.slice(0, 7);
      const detail = S.habitDetail(habit, records, today);
      // WXML 不支持 .slice()，在 JS 层预处理显示用日期
      detail.startDateDisplay = detail.startDate.slice(5);
      // 头部小字：周期目标 + 起点（与原型一致）
      const habitView = Object.assign({}, habit, {
        periodLabel: `${PERIOD_TEXT[habit.periodType] || '每周'}不超过 ${habit.limit} 次`
      });
      this.setData({
        habit: habitView,
        detail,
        today
      });
      this.buildMonth(month, habit, records, today);
      wx.setNavigationBarTitle({ title: '戒断目标统计' });
    } catch (err) {
      console.error('[单卡统计] 加载失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 构建月历网格
  buildMonth(month, habit, records, today) {
    const weeks = S.monthCells(habit, records, month, today);
    const minMonth = habit.startDate.slice(0, 7);
    const maxMonth = today.slice(0, 7);
    this.setData({
      month,
      monthLabel: `${Number(month.slice(0, 4))} 年 ${Number(month.slice(5))} 月`,
      weeks,
      canPrev: month > minMonth,
      canNext: month < maxMonth
    });
  },

  prevMonth() {
    if (!this.data.canPrev) return;
    const month = D.shiftMonth(this.data.month, -1);
    this.rebuildMonth(month);
  },

  nextMonth() {
    if (!this.data.canNext) return;
    const month = D.shiftMonth(this.data.month, 1);
    this.rebuildMonth(month);
  },

  // 翻月只重算网格，复用已加载的记录，不再发请求
  rebuildMonth(month) {
    if (!this.habitRaw) return;
    this.buildMonth(month, this.habitRaw, this.records || [], D.todayKey());
  },

  // 点击月历某日：从已加载记录里取当日明细，不再全表查询
  onCellTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    const dayRecords = (this.records || []).filter((r) => r.date === key);
    this.setData({ selectedCell: key, dayRecords });
  },

  closeCell() {
    this.setData({ selectedCell: null, dayRecords: [] });
  },

  noop() {},

  goRecords() {
    wx.navigateTo({ url: `/pages/records/records?id=${this.data.habitId}` });
  }
});
