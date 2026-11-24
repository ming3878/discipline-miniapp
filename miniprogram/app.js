App({
  globalData: {
    // 云开发环境 ID
    env: 'cloud1-d8g0losuc67784138',
    cloudReady: false
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('当前基础库版本过低，请使用 2.2.3 及以上版本');
      return;
    }
    const initOpts = { traceUser: true };
    if (this.globalData.env) {
      initOpts.env = this.globalData.env;
    }
    wx.cloud.init(initOpts);
    this.globalData.cloudReady = true;
  }
});
