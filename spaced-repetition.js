/**
 * 间隔重复算法模块
 * 基于艾宾浩斯遗忘曲线和SM-2算法
 */

const SpacedRepetition = {
  // 间隔时间配置（毫秒）
  INTERVALS: {
    NEW: 0,
    1_DAY: 24 * 60 * 60 * 1000,
    2_DAYS: 2 * 24 * 60 * 60 * 1000,
    4_DAYS: 4 * 24 * 60 * 60 * 1000,
    8_DAYS: 8 * 24 * 60 * 60 * 1000,
    16_DAYS: 16 * 24 * 60 * 60 * 1000,
    32_DAYS: 32 * 24 * 60 * 60 * 1000
  },

  // 艾宾浩斯遗忘曲线的保留率
  RETENTION_RATES: [100, 58, 44, 36, 33, 28, 25, 22],

  /**
   * 计算下次复习时间
   * @param {Object} record - 学习记录
   * @param {number} score - 本次评分（1-5）
   * @returns {Object} 更新后的学习记录
   */
  calculateNextReview(record, score) {
    const now = Date.now();
    let newRecord = { ...record };

    // 更新评分和重复次数
    newRecord.score = score;
    newRecord.repetitions = (record.repetitions || 0) + 1;
    newRecord.lastReviewed = now;

    // 计算难度因子（EF）
    if (!newRecord.easeFactor) {
      newRecord.easeFactor = 2.5; // 初始难度因子
    }

    // 根据评分调整难度因子
    const quality = score - 1; // 转换为0-5的范围
    newRecord.easeFactor = Math.max(1.3,
      newRecord.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );

    // 计算新的间隔
    if (score <= 2) {
      // 评分低，重新开始
      newRecord.interval = this.INTERVALS['1_DAY'];
      newRecord.repetitions = 0;
    } else {
      // 评分高，增加间隔
      if (newRecord.repetitions === 1) {
        newRecord.interval = this.INTERVALS['1_DAY'];
      } else if (newRecord.repetitions === 2) {
        newRecord.interval = this.INTERVALS['2_DAYS'];
      } else {
        // 使用间隔公式：I(n) = I(n-1) * EF
        const previousInterval = record.interval || this.INTERVALS['1_DAY'];
        newRecord.interval = Math.round(previousInterval * newRecord.easeFactor);
      }
    }

    // 设置下次复习时间
    newRecord.nextReview = now + newRecord.interval;

    // 计算保留率
    newRecord.retentionRate = this.calculateRetentionRate(newRecord);

    return newRecord;
  },

  /**
   * 计算当前保留率
   * @param {Object} record - 学习记录
   * @returns {number} 保留率百分比
   */
  calculateRetentionRate(record) {
    if (!record.lastReviewed) return 100;

    const now = Date.now();
    const elapsed = now - record.lastReviewed;
    const intervalIndex = Math.min(
      Math.floor(elapsed / (24 * 60 * 60 * 1000)),
      this.RETENTION_RATES.length - 1
    );

    return this.RETENTION_RATES[intervalIndex];
  },

  /**
   * 检查卡片是否需要复习
   * @param {Object} record - 学习记录
   * @returns {boolean} 是否需要复习
   */
  needsReview(record) {
    if (!record.nextReview) return true; // 新卡片
    return Date.now() >= record.nextReview;
  },

  /**
   * 获取复习状态
   * @param {Object} record - 学习记录
   * @returns {string} 状态：new, learning, review, mastered
   */
  getReviewStatus(record) {
    if (!record.lastReviewed) return 'new';
    if (record.repetitions < 3) return 'learning';
    if (this.needsReview(record)) return 'review';
    if (record.retentionRate >= 80) return 'mastered';
    return 'review';
  },

  /**
   * 计算卡片权重（用于智能选择下一个卡片）
   * @param {Object} record - 学习记录
   * @returns {number} 权重（越高越应该复习）
   */
  calculateCardWeight(record) {
    let weight = 1;

    // 新卡片权重高
    if (!record.lastReviewed) return 10;

    // 需要复习的卡片权重高
    if (this.needsReview(record)) {
      weight += 5;
    }

    // 保留率低的卡片权重高
    const retention = record.retentionRate || 100;
    weight += (100 - retention) / 20;

    // 评分低的卡片权重高
    if (record.score) {
      weight += (6 - record.score) * 2;
    }

    // 距离上次复习的时间越长，权重越高
    if (record.lastReviewed) {
      const daysSinceReview = (Date.now() - record.lastReviewed) / (24 * 60 * 60 * 1000);
      weight += Math.min(daysSinceReview, 10);
    }

    return Math.max(0.1, weight);
  },

  /**
   * 获取下次复习时间的友好显示
   * @param {number} nextReview - 下次复习时间戳
   * @returns {string} 友好的时间描述
   */
  formatNextReview(nextReview) {
    if (!nextReview) return '待学习';

    const now = Date.now();
    const diff = nextReview - now;

    if (diff <= 0) return '需要复习';

    const hours = Math.floor(diff / (60 * 60 * 1000));
    const days = Math.floor(hours / 24);

    if (hours < 1) return '即将复习';
    if (hours < 24) return `${hours}小时后`;
    if (days < 7) return `${days}天后`;
    if (days < 30) return `${Math.floor(days / 7)}周后`;
    return `${Math.floor(days / 30)}月后`;
  },

  /**
   * 获取保留率的颜色
   * @param {number} retention - 保留率
   * @returns {string} 颜色代码
   */
  getRetentionColor(retention) {
    if (retention >= 80) return '#4caf50'; // 绿色
    if (retention >= 60) return '#ff9800'; // 橙色
    if (retention >= 40) return '#f44336'; // 红色
    return '#9e9e9e'; // 灰色
  },

  /**
   * 生成学习统计
   * @param {Object} progress - 学习进度数据
   * @returns {Object} 统计信息
   */
  generateStats(progress) {
    const records = Object.values(progress);
    const now = Date.now();

    const stats = {
      total: records.length,
      newCards: 0,
      learning: 0,
      review: 0,
      mastered: 0,
      dueToday: 0,
      averageRetention: 0
    };

    let totalRetention = 0;

    records.forEach(record => {
      const status = this.getReviewStatus(record);
      stats[status]++;

      if (this.needsReview(record)) {
        stats.dueToday++;
      }

      totalRetention += record.retentionRate || 100;
    });

    stats.averageRetention = Math.round(totalRetention / (records.length || 1));

    return stats;
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpacedRepetition;
}
