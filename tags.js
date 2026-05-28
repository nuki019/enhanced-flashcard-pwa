/**
 * 标签系统模块
 * 支持标签管理、筛选、标签云等功能
 */

const TagSystem = {
  // 所有标签及其计数
  tags: {},

  /**
   * 初始化标签系统
   * @param {Array} cards - 卡片数组
   */
  init(cards) {
    this.tags = {};
    this.buildTagIndex(cards);
  },

  /**
   * 构建标签索引
   * @param {Array} cards - 卡片数组
   */
  buildTagIndex(cards) {
    cards.forEach(card => {
      if (card.tags && Array.isArray(card.tags)) {
        card.tags.forEach(tag => {
          const normalizedTag = this.normalizeTag(tag);
          if (!this.tags[normalizedTag]) {
            this.tags[normalizedTag] = {
              name: normalizedTag,
              count: 0,
              cards: []
            };
          }
          this.tags[normalizedTag].count++;
          this.tags[normalizedTag].cards.push(card.id);
        });
      }
    });
  },

  /**
   * 标准化标签名称
   * @param {string} tag - 原始标签
   * @returns {string} 标准化后的标签
   */
  normalizeTag(tag) {
    return tag.trim().toLowerCase();
  },

  /**
   * 获取所有标签
   * @returns {Array} 标签数组
   */
  getAllTags() {
    return Object.values(this.tags).sort((a, b) => b.count - a.count);
  },

  /**
   * 获取热门标签
   * @param {number} limit - 数量限制
   * @returns {Array} 热门标签数组
   */
  getPopularTags(limit = 10) {
    return this.getAllTags().slice(0, limit);
  },

  /**
   * 按标签筛选卡片
   * @param {Array} cards - 卡片数组
   * @param {string|Array} filterTags - 要筛选的标签
   * @param {string} mode - 筛选模式：'any'（任一匹配）或'all'（全部匹配）
   * @returns {Array} 筛选后的卡片
   */
  filterByTags(cards, filterTags, mode = 'any') {
    if (!filterTags || (Array.isArray(filterTags) && filterTags.length === 0)) {
      return cards;
    }

    const tagsToFilter = Array.isArray(filterTags) ? filterTags : [filterTags];
    const normalizedFilterTags = tagsToFilter.map(tag => this.normalizeTag(tag));

    return cards.filter(card => {
      if (!card.tags || !Array.isArray(card.tags)) return false;

      const cardTags = card.tags.map(tag => this.normalizeTag(tag));

      if (mode === 'all') {
        // 所有标签都要匹配
        return normalizedFilterTags.every(filterTag => cardTags.includes(filterTag));
      } else {
        // 任一标签匹配即可
        return normalizedFilterTags.some(filterTag => cardTags.includes(filterTag));
      }
    });
  },

  /**
   * 为卡片添加标签
   * @param {Object} card - 卡片对象
   * @param {string|Array} newTags - 新标签
   * @returns {Object} 更新后的卡片
   */
  addTagsToCard(card, newTags) {
    const tagsToAdd = Array.isArray(newTags) ? newTags : [newTags];
    const updatedCard = { ...card };

    if (!updatedCard.tags) {
      updatedCard.tags = [];
    }

    tagsToAdd.forEach(tag => {
      const normalizedTag = this.normalizeTag(tag);
      if (!updatedCard.tags.map(t => this.normalizeTag(t)).includes(normalizedTag)) {
        updatedCard.tags.push(tag.trim());
      }
    });

    return updatedCard;
  },

  /**
   * 从卡片移除标签
   * @param {Object} card - 卡片对象
   * @param {string|Array} tagsToRemove - 要移除的标签
   * @returns {Object} 更新后的卡片
   */
  removeTagsFromCard(card, tagsToRemove) {
    const tags = Array.isArray(tagsToRemove) ? tagsToRemove : [tagsToRemove];
    const normalizedTagsToRemove = tags.map(tag => this.normalizeTag(tag));

    const updatedCard = { ...card };
    if (updatedCard.tags) {
      updatedCard.tags = updatedCard.tags.filter(
        tag => !normalizedTagsToRemove.includes(this.normalizeTag(tag))
      );
    }

    return updatedCard;
  },

  /**
   * 生成标签云HTML
   * @param {Array} tags - 标签数组
   * @param {Function} onClickCallback - 点击回调
   * @returns {string} HTML字符串
   */
  renderTagCloud(tags, onClickCallback) {
    if (!tags || tags.length === 0) {
      return '<div class="tag-cloud empty">暂无标签</div>';
    }

    const maxCount = Math.max(...tags.map(tag => tag.count));

    let html = '<div class="tag-cloud">';

    tags.forEach(tag => {
      const size = this.calculateTagSize(tag.count, maxCount);
      const opacity = 0.5 + (tag.count / maxCount) * 0.5;

      html += `<span class="tag-cloud-item"
                     data-tag="${tag.name}"
                     style="font-size: ${size}px; opacity: ${opacity};"
                     onclick="TagSystem.handleTagClick('${tag.name}')">
                ${tag.name}
                <span class="tag-count">${tag.count}</span>
               </span>`;
    });

    html += '</div>';
    return html;
  },

  /**
   * 计算标签大小
   * @param {number} count - 标签计数
   * @param {number} maxCount - 最大计数
   * @returns {number} 字体大小
   */
  calculateTagSize(count, maxCount) {
    const minSize = 12;
    const maxSize = 24;
    const ratio = count / maxCount;
    return Math.round(minSize + (maxSize - minSize) * ratio);
  },

  /**
   * 渲染标签列表
   * @param {Array} tags - 标签数组
   * @param {Array} selectedTags - 已选中的标签
   * @returns {string} HTML字符串
   */
  renderTagList(tags, selectedTags = []) {
    if (!tags || tags.length === 0) {
      return '<div class="tag-list empty">暂无标签</div>';
    }

    const normalizedSelected = selectedTags.map(tag => this.normalizeTag(tag));

    let html = '<div class="tag-list">';

    tags.forEach(tag => {
      const isSelected = normalizedSelected.includes(this.normalizeTag(tag.name));
      html += `<label class="tag-item ${isSelected ? 'selected' : ''}">
                <input type="checkbox"
                       value="${tag.name}"
                       ${isSelected ? 'checked' : ''}
                       onchange="TagSystem.handleTagSelection(this)">
                <span class="tag-name">${tag.name}</span>
                <span class="tag-count">${tag.count}</span>
               </label>`;
    });

    html += '</div>';
    return html;
  },

  /**
   * 渲染卡片标签
   * @param {Array} tags - 标签数组
   * @param {boolean} removable - 是否可移除
   * @returns {string} HTML字符串
   */
  renderCardTags(tags, removable = false) {
    if (!tags || tags.length === 0) {
      return '<div class="card-tags empty">无标签</div>';
    }

    let html = '<div class="card-tags">';

    tags.forEach(tag => {
      html += `<span class="card-tag">
                ${tag}
                ${removable ? `<button class="tag-remove" onclick="TagSystem.removeTagFromCurrentCard('${tag}')">&times;</button>` : ''}
               </span>`;
    });

    html += '</div>';
    return html;
  },

  /**
   * 渲染标签筛选器
   * @param {Array} tags - 所有标签
   * @param {Array} selectedTags - 已选中的标签
   * @returns {string} HTML字符串
   */
  renderTagFilter(tags, selectedTags = []) {
    let html = '<div class="tag-filter">';
    html += '<div class="tag-filter-header">';
    html += '<h4>标签筛选</h4>';
    html += '<button class="clear-tags" onclick="TagSystem.clearTagFilter()">清除</button>';
    html += '</div>';
    html += this.renderTagList(tags, selectedTags);
    html += '</div>';
    return html;
  },

  /**
   * 获取标签统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const allTags = this.getAllTags();
    return {
      totalTags: allTags.length,
      totalCards: Object.values(this.tags).reduce((sum, tag) => sum + tag.cards.length, 0),
      popularTags: this.getPopularTags(5),
      averageTagsPerCard: this.calculateAverageTagsPerCard()
    };
  },

  /**
   * 计算每张卡片的平均标签数
   * @returns {number} 平均标签数
   */
  calculateAverageTagsPerCard() {
    const allCards = new Set();
    Object.values(this.tags).forEach(tag => {
      tag.cards.forEach(cardId => allCards.add(cardId));
    });

    if (allCards.size === 0) return 0;

    const totalTags = Object.values(this.tags).reduce((sum, tag) => sum + tag.count, 0);
    return (totalTags / allCards.size).toFixed(1);
  },

  /**
   * 搜索标签
   * @param {string} query - 搜索关键词
   * @returns {Array} 匹配的标签
   */
  searchTags(query) {
    if (!query) return this.getAllTags();

    const normalizedQuery = this.normalizeTag(query);
    return this.getAllTags().filter(tag =>
      this.normalizeTag(tag.name).includes(normalizedQuery)
    );
  },

  /**
   * 处理标签点击事件
   * @param {string} tag - 标签名称
   */
  handleTagClick(tag) {
    // 这个方法会被主应用重写
    console.log('Tag clicked:', tag);
  },

  /**
   * 处理标签选择事件
   * @param {HTMLInputElement} checkbox - 复选框元素
   */
  handleTagSelection(checkbox) {
    // 这个方法会被主应用重写
    console.log('Tag selection:', checkbox.value, checkbox.checked);
  },

  /**
   * 清除标签筛选
   */
  clearTagFilter() {
    // 这个方法会被主应用重写
    console.log('Clear tag filter');
  },

  /**
   * 从当前卡片移除标签
   * @param {string} tag - 标签名称
   */
  removeTagFromCurrentCard(tag) {
    // 这个方法会被主应用重写
    console.log('Remove tag from current card:', tag);
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TagSystem;
}
