/**
 * 间隔重复算法模块
 * 基于SM-2算法魔改的，参考了艾宾浩斯遗忘曲线
 * 有些参数是凭感觉调的，不一定是理论最优
 */

var SpacedRepetition = (function() {
  "use strict";

  // 复习间隔时间（毫秒）
  // 这个间隔序列是我自己试出来的，1-2-4-8-16-32天
  var REVIEW_GAPS = [
    0,                            // 新卡片
    24 * 60 * 60 * 1000,          // 1天
    2 * 24 * 60 * 60 * 1000,      // 2天
    4 * 24 * 60 * 60 * 1000,      // 4天
    8 * 24 * 60 * 60 * 1000,      // 8天
    16 * 24 * 60 * 60 * 1000,     // 16天
    32 * 24 * 60 * 60 * 1000      // 32天
  ];

  // 艾宾浩斯遗忘曲线的保留率
  // 第0天100%，然后逐渐下降，第7天只有22%了
  // 这个数据是从网上查的，具体出处忘了
  var MEMORY_DECAY = [100, 58, 44, 36, 33, 28, 25, 22];

  // 一天多少毫秒，省得重复算
  var ONE_DAY_MS = 24 * 60 * 60 * 1000;

  /**
   * 计算下次复习时间
   * 这个是核心算法，改了好几次才调好
   *
   * @param {Object} record - 当前学习记录
   * @param {number} score - 用户评分 1-5
   * @returns {Object} 更新后的记录
   */
  function computeNextReview(record, score) {
    var now = Date.now();
    var updated = {};
    // 复制一份，别直接改原对象
    for (var key in record) {
      if (record.hasOwnProperty(key)) {
        updated[key] = record[key];
      }
    }

    updated.score = score;
    updated.repeatCount = (record.repeatCount || 0) + 1;
    updated.lastStudied = now;

    // 难度因子，初始值2.5
    // 这个公式是从SM-2算法抄的，稍微改了改
    if (!updated.difficulty) {
      updated.difficulty = 2.5;
    }

    // quality是0-5分，score是1-5分
    var quality = score - 1;
    var efDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
    updated.difficulty = Math.max(1.3, updated.difficulty + efDelta);

    // 根据评分决定间隔
    if (score <= 2) {
      // 分太低了，重新来过
      updated.gapDays = REVIEW_GAPS[1]; // 1天
      updated.repeatCount = 0;
    } else {
      // 分够了，按公式算间隔
      if (updated.repeatCount === 1) {
        updated.gapDays = REVIEW_GAPS[1];
      } else if (updated.repeatCount === 2) {
        updated.gapDays = REVIEW_GAPS[2];
      } else {
        // 间隔 = 上次间隔 * 难度因子
        var prevGap = record.gapDays || REVIEW_GAPS[1];
        updated.gapDays = Math.round(prevGap * updated.difficulty);
      }
    }

    // 下次复习时间
    updated.scheduledFor = now + updated.gapDays;

    // 算一下保留率
    updated.memoryStrength = calcMemoryStrength(updated);

    return updated;
  }

  /**
   * 计算当前的记忆强度（保留率）
   * 根据距离上次学习的时间来算
   */
  function calcMemoryStrength(record) {
    if (!record.lastStudied) return 100;

    var elapsed = Date.now() - record.lastStudied;
    var dayIndex = Math.floor(elapsed / ONE_DAY_MS);

    // 别越界了
    if (dayIndex >= MEMORY_DECAY.length) {
      dayIndex = MEMORY_DECAY.length - 1;
    }

    return MEMORY_DECAY[dayIndex];
  }

  /**
   * 判断是否需要复习
   * 到了scheduledFor时间就该复习了
   */
  function isDueForReview(record) {
    if (!record.scheduledFor) return true; // 新卡片
    return Date.now() >= record.scheduledFor;
  }

  /**
   * 获取复习状态
   * 返回: new, learning, review, mastered
   */
  function getReviewStatus(record) {
    if (!record.lastStudied) return "new";
    if (record.repeatCount < 3) return "learning";
    if (isDueForReview(record)) return "review";
    if (record.memoryStrength >= 80) return "mastered";
    return "review";
  }

  /**
   * 计算卡片权重，用于智能选择下一张
   * 权重越高越应该优先出现
   *
   * 这个权重算法是我自己想的，不一定科学
   */
  function calcCardWeight(record) {
    var weight = 1;

    // 新卡片权重高
    if (!record.lastStudied) return 10;

    // 需要复习的加权重
    if (isDueForReview(record)) {
      weight += 5;
    }

    // 记忆强度越低权重越高
    var strength = record.memoryStrength || 100;
    weight += (100 - strength) / 20;

    // 分数越低权重越高
    if (record.score) {
      weight += (6 - record.score) * 2;
    }

    // 距离上次学习越久权重越高
    if (record.lastStudied) {
      var daysSince = (Date.now() - record.lastStudied) / ONE_DAY_MS;
      weight += Math.min(daysSince, 10);
    }

    // 保底返回0.1，别返回0
    return Math.max(0.1, weight);
  }

  /**
   * 格式化下次复习时间
   * 显示成人类能看懂的文字
   */
  function formatNextReview(timestamp) {
    if (!timestamp) return "待学习";

    var diff = timestamp - Date.now();
    if (diff <= 0) return "需要复习";

    var hours = Math.floor(diff / (60 * 60 * 1000));
    var days = Math.floor(hours / 24);

    if (hours < 1) return "即将复习";
    if (hours < 24) return hours + "小时后";
    if (days < 7) return days + "天后";
    if (days < 30) return Math.floor(days / 7) + "周后";
    return Math.floor(days / 30) + "月后";
  }

  /**
   * 根据保留率返回颜色
   * 绿>橙>红>灰
   */
  function getRetentionColor(rate) {
    if (rate >= 80) return "#4caf50";
    if (rate >= 60) return "#ff9800";
    if (rate >= 40) return "#f44336";
    return "#9e9e9e";
  }

  /**
   * 生成学习统计信息
   * 汇总所有卡片的状态
   */
  function buildStudyStats(progressData) {
    var allRecords = [];
    for (var id in progressData) {
      if (progressData.hasOwnProperty(id)) {
        allRecords.push(progressData[id]);
      }
    }

    var result = {
      total: allRecords.length,
      newCards: 0,
      learning: 0,
      review: 0,
      mastered: 0,
      dueToday: 0,
      averageRetention: 0
    };

    var retentionSum = 0;
    var i = 0;
    while (i < allRecords.length) {
      var rec = allRecords[i];
      var status = getReviewStatus(rec);

      // 按状态分类计数
      if (status === "new") result.newCards++;
      else if (status === "learning") result.learning++;
      else if (status === "review") result.review++;
      else if (status === "mastered") result.mastered++;

      if (isDueForReview(rec)) {
        result.dueToday++;
      }

      retentionSum += (rec.memoryStrength || 100);
      i++;
    }

    // 平均保留率
    if (allRecords.length > 0) {
      result.averageRetention = Math.round(retentionSum / allRecords.length);
    }

    return result;
  }

  // 公开接口
  return {
    INTERVALS: REVIEW_GAPS,
    RETENTION_RATES: MEMORY_DECAY,
    calculateNextReview: computeNextReview,
    calculateRetentionRate: calcMemoryStrength,
    needsReview: isDueForReview,
    getReviewStatus: getReviewStatus,
    calculateCardWeight: calcCardWeight,
    formatNextReview: formatNextReview,
    getRetentionColor: getRetentionColor,
    generateStats: buildStudyStats
  };
})();

// 兼容Node.js环境（测试用）
if (typeof module !== "undefined" && module.exports) {
  module.exports = SpacedRepetition;
}
