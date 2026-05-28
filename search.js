/**
 * 搜索功能模块
 * 支持全文搜索、实时搜索、搜索高亮、搜索历史
 */

const SearchEngine = {
  // 搜索历史存储键
  HISTORY_KEY: 'xg-flashcard-search-history',

  // 最大历史记录数
  MAX_HISTORY: 20,

  // 搜索历史
  history: [],

  // 当前搜索状态
  currentQuery: '',
  currentResults: [],

  /**
   * 初始化搜索引擎
   */
  init() {
    this.loadHistory();
  },

  /**
   * 加载搜索历史
   */
  loadHistory() {
    try {
      const saved = localStorage.getItem(this.HISTORY_KEY);
      this.history = saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load search history:', e);
      this.history = [];
    }
  },

  /**
   * 保存搜索历史
   */
  saveHistory() {
    try {
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(this.history));
    } catch (e) {
      console.error('Failed to save search history:', e);
    }
  },

  /**
   * 添加到搜索历史
   * @param {string} query - 搜索词
   */
  addToHistory(query) {
    if (!query || query.trim().length === 0) return;

    const normalizedQuery = query.trim();

    // 移除重复项
    this.history = this.history.filter(item => item !== normalizedQuery);

    // 添加到开头
    this.history.unshift(normalizedQuery);

    // 限制数量
    if (this.history.length > this.MAX_HISTORY) {
      this.history = this.history.slice(0, this.MAX_HISTORY);
    }

    this.saveHistory();
  },

  /**
   * 清除搜索历史
   */
  clearHistory() {
    this.history = [];
    this.saveHistory();
  },

  /**
   * 获取搜索历史
   * @returns {Array} 搜索历史数组
   */
  getHistory() {
    return [...this.history];
  },

  /**
   * 全文搜索
   * @param {Array} cards - 卡片数组
   * @param {string} query - 搜索词
   * @param {Object} options - 搜索选项
   * @returns {Array} 搜索结果
   */
  search(cards, query, options = {}) {
    if (!query || query.trim().length === 0) {
      this.currentQuery = '';
      this.currentResults = [];
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    this.currentQuery = normalizedQuery;

    const {
      searchFields = ['question', 'answer', 'tags', 'chapter'],
      caseSensitive = false,
      exactMatch = false,
      highlightResults = true
    } = options;

    const results = cards.map(card => {
      let score = 0;
      const matches = [];

      searchFields.forEach(field => {
        const value = this.getNestedValue(card, field);
        if (!value) return;

        const stringValue = Array.isArray(value) ? value.join(' ') : String(value);
        const normalizedValue = caseSensitive ? stringValue : stringValue.toLowerCase();
        const queryToUse = caseSensitive ? normalizedQuery : normalizedQuery.toLowerCase();

        let isMatch = false;

        if (exactMatch) {
          isMatch = normalizedValue === queryToUse;
        } else {
          isMatch = normalizedValue.includes(queryToUse);
        }

        if (isMatch) {
          // 计算匹配分数
          const fieldScore = this.calculateFieldScore(field, stringValue, normalizedQuery);
          score += fieldScore;

          // 记录匹配位置
          matches.push({
            field,
            value: stringValue,
            positions: this.findMatchPositions(stringValue, normalizedQuery, caseSensitive)
          });
        }
      });

      return {
        card,
        score,
        matches,
        hasMatch: score > 0
      };
    }).filter(result => result.hasMatch);

    // 按分数排序
    results.sort((a, b) => b.score - a.score);

    this.currentResults = results;

    // 添加到搜索历史
    if (results.length > 0) {
      this.addToHistory(query);
    }

    return results;
  },

  /**
   * 计算字段匹配分数
   * @param {string} field - 字段名
   * @param {string} value - 字段值
   * @param {string} query - 搜索词
   * @returns {number} 分数
   */
  calculateFieldScore(field, value, query) {
    let score = 0;
    const normalizedValue = value.toLowerCase();
    const normalizedQuery = query.toLowerCase();

    // 字段权重
    const fieldWeights = {
      question: 10,
      answer: 5,
      tags: 8,
      chapter: 3,
      number: 2
    };

    const weight = fieldWeights[field] || 1;

    // 完全匹配
    if (normalizedValue === normalizedQuery) {
      score += 100 * weight;
    }
    // 开头匹配
    else if (normalizedValue.startsWith(normalizedQuery)) {
      score += 50 * weight;
    }
    // 单词开头匹配
    else if (normalizedValue.includes(' ' + normalizedQuery)) {
      score += 30 * weight;
    }
    // 包含匹配
    else if (normalizedValue.includes(normalizedQuery)) {
      score += 10 * weight;
    }

    // 匹配词数
    const matchCount = (normalizedValue.match(new RegExp(normalizedQuery, 'g')) || []).length;
    score += matchCount * 2 * weight;

    return score;
  },

  /**
   * 查找匹配位置
   * @param {string} text - 文本
   * @param {string} query - 搜索词
   * @param {boolean} caseSensitive - 是否区分大小写
   * @returns {Array} 匹配位置数组
   */
  findMatchPositions(text, query, caseSensitive = false) {
    const positions = [];
    const searchText = caseSensitive ? text : text.toLowerCase();
    const searchQuery = caseSensitive ? query : query.toLowerCase();

    let startIndex = 0;
    while (startIndex < searchText.length) {
      const index = searchText.indexOf(searchQuery, startIndex);
      if (index === -1) break;

      positions.push({
        start: index,
        end: index + searchQuery.length
      });

      startIndex = index + 1;
    }

    return positions;
  },

  /**
   * 获取嵌套对象的值
   * @param {Object} obj - 对象
   * @param {string} path - 属性路径
   * @returns {*} 值
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current ? current[key] : null;
    }, obj);
  },

  /**
   * 高亮搜索结果
   * @param {string} text - 原始文本
   * @param {string} query - 搜索词
   * @param {number} maxLength - 最大显示长度
   * @returns {string} 高亮后的HTML
   */
  highlightText(text, query, maxLength = 200) {
    if (!text || !query) return text;

    // 截断文本
    let displayText = text;
    if (maxLength && text.length > maxLength) {
      // 找到匹配位置，截取包含匹配的片段
      const matchIndex = text.toLowerCase().indexOf(query.toLowerCase());
      if (matchIndex > maxLength / 2) {
        const start = Math.max(0, matchIndex - maxLength / 3);
        displayText = '...' + text.substring(start, start + maxLength) + '...';
      } else {
        displayText = text.substring(0, maxLength) + '...';
      }
    }

    // 高亮匹配文本
    const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
    return displayText.replace(regex, '<mark class="search-highlight">$1</mark>');
  },

  /**
   * 转义正则表达式特殊字符
   * @param {string} string - 原始字符串
   * @returns {string} 转义后的字符串
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  /**
   * 渲染搜索结果
   * @param {Array} results - 搜索结果数组
   * @param {string} query - 搜索词
   * @returns {string} HTML字符串
   */
  renderResults(results, query) {
    if (!results || results.length === 0) {
      return '<div class="search-results empty">未找到匹配的卡片</div>';
    }

    let html = `<div class="search-results">`;
    html += `<div class="search-results-header">找到 ${results.length} 个结果</div>`;

    results.forEach((result, index) => {
      const card = result.card;
      const preview = this.highlightText(card.question, query, 100);

      html += `<div class="search-result-item" data-card-id="${card.id}" onclick="SearchEngine.selectResult('${card.id}')">
                <div class="result-index">${index + 1}</div>
                <div class="result-content">
                  <div class="result-question">${preview}</div>
                  <div class="result-meta">
                    ${card.number ? `<span class="result-number">${card.number}</span>` : ''}
                    ${card.chapter ? `<span class="result-chapter">${card.chapter}</span>` : ''}
                    ${card.tags ? card.tags.map(tag => `<span class="result-tag">${tag}</span>`).join('') : ''}
                  </div>
                  <div class="result-score">匹配度: ${Math.round(result.score)}</div>
                </div>
               </div>`;
    });

    html += '</div>';
    return html;
  },

  /**
   * 渲染搜索历史
   * @returns {string} HTML字符串
   */
  renderHistory() {
    if (this.history.length === 0) {
      return '<div class="search-history empty">暂无搜索历史</div>';
    }

    let html = '<div class="search-history">';
    html += '<div class="history-header">';
    html += '<h4>搜索历史</h4>';
    html += '<button class="clear-history" onclick="SearchEngine.clearHistory(); SearchEngine.renderSearchPanel();">清除</button>';
    html += '</div>';
    html += '<div class="history-list">';

    this.history.forEach(query => {
      html += `<div class="history-item" onclick="SearchEngine.selectHistory('${query}')">
                <span class="history-icon">🔍</span>
                <span class="history-text">${query}</span>
                <button class="history-remove" onclick="event.stopPropagation(); SearchEngine.removeFromHistory('${query}')">&times;</button>
               </div>`;
    });

    html += '</div></div>';
    return html;
  },

  /**
   * 渲染搜索面板
   */
  renderSearchPanel() {
    const panel = document.getElementById('searchPanel');
    if (!panel) return;

    panel.innerHTML = `
      <div class="search-input-wrapper">
        <input type="text"
               id="searchInput"
               class="search-input"
               placeholder="搜索卡片..."
               value="${this.currentQuery}"
               oninput="SearchEngine.handleInput(this.value)"
               onkeydown="SearchEngine.handleKeydown(event)">
        <button class="search-clear" onclick="SearchEngine.clearSearch()" ${!this.currentQuery ? 'style="display:none"' : ''}>&times;</button>
      </div>
      <div id="searchResults" class="search-results-container">
        ${this.currentQuery ? this.renderResults(this.currentResults, this.currentQuery) : this.renderHistory()}
      </div>
    `;
  },

  /**
   * 处理输入事件
   * @param {string} value - 输入值
   */
  handleInput(value) {
    this.currentQuery = value;

    // 清除按钮显示
    const clearBtn = document.querySelector('.search-clear');
    if (clearBtn) {
      clearBtn.style.display = value ? 'block' : 'none';
    }

    // 实时搜索（防抖）
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    this.searchTimeout = setTimeout(() => {
      this.performSearch(value);
    }, 300);
  },

  /**
   * 处理键盘事件
   * @param {KeyboardEvent} event - 键盘事件
   */
  handleKeydown(event) {
    if (event.key === 'Escape') {
      this.closeSearchPanel();
    } else if (event.key === 'Enter') {
      this.performSearch(this.currentQuery);
    }
  },

  /**
   * 执行搜索
   * @param {string} query - 搜索词
   */
  performSearch(query) {
    // 这个方法会被主应用重写
    console.log('Perform search:', query);
  },

  /**
   * 选择搜索结果
   * @param {string} cardId - 卡片ID
   */
  selectResult(cardId) {
    // 这个方法会被主应用重写
    console.log('Select result:', cardId);
  },

  /**
   * 选择历史搜索
   * @param {string} query - 搜索词
   */
  selectHistory(query) {
    this.currentQuery = query;
    const input = document.getElementById('searchInput');
    if (input) {
      input.value = query;
    }
    this.performSearch(query);
  },

  /**
   * 从历史中移除
   * @param {string} query - 搜索词
   */
  removeFromHistory(query) {
    this.history = this.history.filter(item => item !== query);
    this.saveHistory();
    this.renderSearchPanel();
  },

  /**
   * 清除搜索
   */
  clearSearch() {
    this.currentQuery = '';
    this.currentResults = [];
    const input = document.getElementById('searchInput');
    if (input) {
      input.value = '';
      input.focus();
    }
    this.renderSearchPanel();
  },

  /**
   * 打开搜索面板
   */
  openSearchPanel() {
    const panel = document.getElementById('searchPanel');
    if (panel) {
      panel.classList.add('active');
      this.renderSearchPanel();

      // 自动聚焦输入框
      setTimeout(() => {
        const input = document.getElementById('searchInput');
        if (input) input.focus();
      }, 100);
    }
  },

  /**
   * 关闭搜索面板
   */
  closeSearchPanel() {
    const panel = document.getElementById('searchPanel');
    if (panel) {
      panel.classList.remove('active');
    }
  },

  /**
   * 切换搜索面板
   */
  toggleSearchPanel() {
    const panel = document.getElementById('searchPanel');
    if (panel) {
      if (panel.classList.contains('active')) {
        this.closeSearchPanel();
      } else {
        this.openSearchPanel();
      }
    }
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SearchEngine;
}
