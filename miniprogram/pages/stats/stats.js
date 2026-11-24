// 总体统计页（FR-05）：4 项总览 + 2 个月度图形
const DB = require('../../utils/db.js');
const S = require('../../utils/stats.js');
const D = require('../../utils/date.js');

Page({
  data: {
    loading: true,
    summary: null,
    trend: null,       // 近 6 月破戒趋势
    compare: null,     // 本月主题对比
    hasData: false
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const today = D.todayKey();
      const [habits, records] = await Promise.all([DB.getHabits(), DB.getAllCheckins()]);
      const summary = S.overallSummary(habits, records, today);
      const trend = S.monthlyTrend(records, today, 6);
      const compare = S.habitMonthCompare(habits, records, today.slice(0, 7), today);
      this.setData({
        loading: false,
        summary,
        trend,
        compare,
        hasData: habits.length > 0 || records.length > 0
      });
    } catch (err) {
      console.error('[总体统计] 加载失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  }
});
