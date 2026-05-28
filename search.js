/**
 * 搜索引擎模块
 * 支持全文搜索、搜索历史、结果高亮
 * 写得比较朴素，没用什么高级算法
 */

var SearchEngine = (function() {
  "use strict";

  // 搜索历史的localStorage key
  var HISTORY_STORE_KEY = "xg-flashcard-search-history";

  // 最多保存多少条搜索历史
  var MAX_HISTORY_ITEMS = 20;

  // 搜索历史列表
  var searchHistory = [];

  // 当前搜索词和结果
  var lastQuery = "";
  var lastResults = [];

  // 防抖定时器
  var debounceTimer = null;

  /**
   * 初始化，加载搜索历史
   */
  function initSearchEngine() {
    loadSearchHistory();
  }

  /**
   * 从localStorage加载搜索历史
   */
  function loadSearchHistory() {
    try {
      var saved = localStorage.getItem(HISTORY_STORE_KEY);
      searchHistory = saved ? JSON.parse(saved) : [];
    } catch (e) {
      // 解析失败就清空
      console.warn("搜索历史加载失败:", e);
      searchHistory = [];
    }
  }

  /**
   * 保存搜索历史到localStorage
   */
  function saveSearchHistory() {
    try {
      localStorage.setItem(HISTORY_STORE_KEY, JSON.stringify(searchHistory));
    } catch (e) {
      console.error("搜索历史保存失败:", e);
    }
  }

  /**
   * 添加一条搜索历史
   * 会去重，最新的放最前面
   */
  function addHistoryItem(query) {
    if (!query || query.trim().length === 0) return;

    var cleaned = query.trim();

    // 去掉重复的
    var filtered = [];
    var i = 0;
    while (i < searchHistory.length) {
      if (searchHistory[i] !== cleaned) {
        filtered.push(searchHistory[i]);
      }
      i++;
    }

    // 新的放最前面
    filtered.unshift(cleaned);

    // 超过上限就截断
    if (filtered.length > MAX_HISTORY_ITEMS) {
      filtered = filtered.slice(0, MAX_HISTORY_ITEMS);
    }

    searchHistory = filtered;
    saveSearchHistory();
  }

  /**
   * 清空搜索历史
   */
  function clearSearchHistory() {
    searchHistory = [];
    saveSearchHistory();
  }

  /**
   * 获取搜索历史副本
   */
  function getSearchHistory() {
    // 返回副本，别直接返回引用
    var copy = [];
    var i = 0;
    while (i < searchHistory.length) {
      copy.push(searchHistory[i]);
      i++;
    }
    return copy;
  }

  /**
   * 全文搜索
   * 在指定字段中查找包含query的卡片
   *
   * @param {Array} cards - 卡片数组
   * @param {string} query - 搜索词
   * @param {Object} options - 搜索选项
   * @returns {Array} 搜索结果，按匹配度排序
   */
  function searchCards(cards, query, options) {
    if (!query || query.trim().length === 0) {
      lastQuery = "";
      lastResults = [];
      return [];
    }

    var normalizedQuery = query.trim().toLowerCase();
    lastQuery = normalizedQuery;

    // 默认搜索字段
    if (!options) options = {};
    var fields = options.searchFields || ["question", "answer", "tags", "chapter"];
    var caseSensitive = options.caseSensitive || false;
    var exactMatch = options.exactMatch || false;

    // 遍历所有卡片，计算匹配度
    var results = [];
    var cardIdx = 0;
    while (cardIdx < cards.length) {
      var card = cards[cardIdx];
      var matchResult = scoreCardMatch(card, normalizedQuery, fields, caseSensitive, exactMatch);

      if (matchResult.totalScore > 0) {
        results.push({
          card: card,
          score: matchResult.totalScore,
          matches: matchResult.matchedFields,
          hasMatch: true
        });
      }

      cardIdx++;
    }

    // 按分数降序排
    results.sort(function(a, b) {
      return b.score - a.score;
    });

    lastResults = results;

    // 有结果才记录搜索历史
    if (results.length > 0) {
      addHistoryItem(query);
    }

    return results;
  }

  /**
   * 计算单张卡片的匹配分数
   * 不同字段权重不同
   */
  function scoreCardMatch(card, query, fields, caseSensitive, exactMatch) {
    var totalScore = 0;
    var matchedFields = [];

    // 字段权重配置
    var FIELD_WEIGHTS = {
      question: 10,
      answer: 5,
      tags: 8,
      chapter: 3,
      number: 2
    };

    var fieldIdx = 0;
    while (fieldIdx < fields.length) {
      var fieldName = fields[fieldIdx];
      var fieldValue = getNestedValue(card, fieldName);

      if (!fieldValue) {
        fieldIdx++;
        continue;
      }

      // 数组类型拼成字符串
      var strValue = Array.isArray(fieldValue) ? fieldValue.join(" ") : String(fieldValue);
      var compareValue = caseSensitive ? strValue : strValue.toLowerCase();
      var compareQuery = caseSensitive ? query : query.toLowerCase();

      var isMatch = false;
      if (exactMatch) {
        isMatch = (compareValue === compareQuery);
      } else {
        isMatch = (compareValue.indexOf(compareQuery) >= 0);
      }

      if (isMatch) {
        var fieldScore = calcFieldScore(fieldName, strValue, query, FIELD_WEIGHTS);
        totalScore += fieldScore;

        matchedFields.push({
          field: fieldName,
          value: strValue,
          positions: findMatchPositions(strValue, query, caseSensitive)
        });
      }

      fieldIdx++;
    }

    return {
      totalScore: totalScore,
      matchedFields: matchedFields
    };
  }

  /**
   * 计算某个字段的匹配分数
   * 完全匹配 > 开头匹配 > 包含匹配
   */
  function calcFieldScore(fieldName, fieldValue, query, weights) {
    var score = 0;
    var weight = weights[fieldName] || 1;

    var lowerValue = fieldValue.toLowerCase();
    var lowerQuery = query.toLowerCase();

    // 完全匹配最高分
    if (lowerValue === lowerQuery) {
      score += 100 * weight;
    }
    // 开头匹配
    else if (lowerValue.substring(0, lowerQuery.length) === lowerQuery) {
      score += 50 * weight;
    }
    // 单词开头匹配（前面是空格）
    else if (lowerValue.indexOf(" " + lowerQuery) >= 0) {
      score += 30 * weight;
    }
    // 包含匹配
    else {
      score += 10 * weight;
    }

    // 统计出现次数，每次加2分
    var occurrences = 0;
    var searchFrom = 0;
    while (true) {
      var pos = lowerValue.indexOf(lowerQuery, searchFrom);
      if (pos < 0) break;
      occurrences++;
      searchFrom = pos + 1;
    }
    score += occurrences * 2 * weight;

    return score;
  }

  /**
   * 获取嵌套对象的值
   * 支持 "a.b.c" 这种路径
   */
  function getNestedValue(obj, path) {
    var parts = path.split(".");
    var current = obj;
    var i = 0;
    while (i < parts.length) {
      if (!current) return null;
      current = current[parts[i]];
      i++;
    }
    return current;
  }

  /**
   * 查找匹配位置
   * 返回所有匹配的起止位置
   */
  function findMatchPositions(text, query, caseSensitive) {
    var positions = [];
    var searchText = caseSensitive ? text : text.toLowerCase();
    var searchQuery = caseSensitive ? query : query.toLowerCase();

    var startFrom = 0;
    while (startFrom < searchText.length) {
      var foundIdx = searchText.indexOf(searchQuery, startFrom);
      if (foundIdx < 0) break;

      positions.push({
        start: foundIdx,
        end: foundIdx + searchQuery.length
      });

      // 下次从这个位置的下一个字符开始找
      startFrom = foundIdx + 1;
    }

    return positions;
  }

  /**
   * 高亮搜索结果中的关键词
   * 会截断过长的文本
   */
  function highlightTextWithQuery(text, query, maxLen) {
    if (!text || !query) return text;
    if (!maxLen) maxLen = 200;

    var displayText = text;

    // 如果文本太长，截取包含关键词的片段
    if (text.length > maxLen) {
      var matchIdx = text.toLowerCase().indexOf(query.toLowerCase());
      if (matchIdx > maxLen / 2) {
        // 关键词在后面，截取包含关键词的部分
        var start = Math.max(0, matchIdx - Math.floor(maxLen / 3));
        displayText = "..." + text.substring(start, start + maxLen) + "...";
      } else {
        // 关键词在前面或没找到，从头截取
        displayText = text.substring(0, maxLen) + "...";
      }
    }

    // 正则替换高亮
    var escapedQuery = escapeRegexChars(query);
    var regex = new RegExp("(" + escapedQuery + ")", "gi");
    return displayText.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  /**
   * 转义正则特殊字符
   */
  function escapeRegexChars(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * 渲染搜索结果列表
   */
  function renderSearchResults(results, query) {
    if (!results || results.length === 0) {
      return '<div class="search-results empty">未找到匹配的卡片</div>';
    }

    var html = '<div class="search-results">';
    html += '<div class="search-results-header">找到 ' + results.length + " 个结果</div>";

    var i = 0;
    while (i < results.length) {
      var result = results[i];
      var card = result.card;
      var preview = highlightTextWithQuery(card.question, query, 100);

      html += '<div class="search-result-item" data-card-id="' + card.id + '"';
      html += ' onclick="SearchEngine.selectResult(\'' + card.id + "')\">";

      // 序号
      html += '<div class="result-index">' + (i + 1) + "</div>";

      // 内容
      html += '<div class="result-content">';
      html += '<div class="result-question">' + preview + "</div>";
      html += '<div class="result-meta">';

      if (card.number) {
        html += '<span class="result-number">' + card.number + "</span>";
      }
      if (card.chapter) {
        html += '<span class="result-chapter">' + card.chapter + "</span>";
      }
      if (card.tags) {
        var t = 0;
        while (t < card.tags.length) {
          html += '<span class="result-tag">' + card.tags[t] + "</span>";
          t++;
        }
      }

      html += "</div>";
      html += '<div class="result-score">匹配度: ' + Math.round(result.score) + "</div>";
      html += "</div>";

      html += "</div>";
      i++;
    }

    html += "</div>";
    return html;
  }

  /**
   * 渲染搜索历史
   */
  function renderSearchHistoryPanel() {
    if (searchHistory.length === 0) {
      return '<div class="search-history empty">暂无搜索历史</div>';
    }

    var html = '<div class="search-history">';
    html += '<div class="history-header">';
    html += "<h4>搜索历史</h4>";
    html += '<button class="clear-history" onclick="SearchEngine.clearHistory(); SearchEngine.renderSearchPanel();">清除</button>';
    html += "</div>";
    html += '<div class="history-list">';

    var i = 0;
    while (i < searchHistory.length) {
      var query = searchHistory[i];
      html += '<div class="history-item" onclick="SearchEngine.selectHistory(\'' + escapeForHtml(query) + "')\">";
      html += '<span class="history-icon">🔍</span>';
      html += '<span class="history-text">' + escapeForHtml(query) + "</span>";
      html += '<button class="history-remove" onclick="event.stopPropagation(); SearchEngine.removeFromHistory(\'' + escapeForHtml(query) + "')\">&times;</button>";
      html += "</div>";
      i++;
    }

    html += "</div></div>";
    return html;
  }

  /**
   * 转义HTML属性中的特殊字符
   */
  function escapeForHtml(str) {
    return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /**
   * 渲染搜索面板
   */
  function renderSearchPanelContent() {
    var panel = document.getElementById("searchPanel");
    if (!panel) return;

    var html = "";
    html += '<div class="search-input-wrapper">';
    html += '<input type="text" id="searchInput" class="search-input" ';
    html += 'placeholder="搜索卡片..." ';
    html += 'value="' + escapeForHtml(lastQuery) + '" ';
    html += 'oninput="SearchEngine.handleInput(this.value)" ';
    html += 'onkeydown="SearchEngine.handleKeydown(event)">';
    html += '<button class="search-clear" onclick="SearchEngine.clearSearch()"';
    if (!lastQuery) html += ' style="display:none"';
    html += ">&times;</button>";
    html += "</div>";
    html += '<div id="searchResults" class="search-results-container">';

    if (lastQuery) {
      html += renderSearchResults(lastResults, lastQuery);
    } else {
      html += renderSearchHistoryPanel();
    }

    html += "</div>";
    panel.innerHTML = html;
  }

  /**
   * 处理搜索输入
   * 带300ms防抖
   */
  function handleSearchInput(value) {
    lastQuery = value;

    // 显示/隐藏清除按钮
    var clearBtn = document.querySelector(".search-clear");
    if (clearBtn) {
      clearBtn.style.display = value ? "block" : "none";
    }

    // 防抖处理
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(function() {
      doPerformSearch(value);
    }, 300);
  }

  /**
   * 处理键盘事件
   * ESC关闭，Enter立即搜索
   */
  function handleKeydownEvent(event) {
    if (event.key === "Escape") {
      closeSearchPanel();
    } else if (event.key === "Enter") {
      doPerformSearch(lastQuery);
    }
  }

  /**
   * 执行搜索（会被主应用重写）
   */
  function doPerformSearch(query) {
    console.log("执行搜索:", query);
  }

  /**
   * 选择搜索结果（会被主应用重写）
   */
  function selectSearchResult(cardId) {
    console.log("选中结果:", cardId);
  }

  /**
   * 选择历史搜索词
   */
  function selectHistoryItem(query) {
    lastQuery = query;
    var input = document.getElementById("searchInput");
    if (input) {
      input.value = query;
    }
    doPerformSearch(query);
  }

  /**
   * 从历史中移除一条
   */
  function removeHistoryItem(query) {
    var filtered = [];
    var i = 0;
    while (i < searchHistory.length) {
      if (searchHistory[i] !== query) {
        filtered.push(searchHistory[i]);
      }
      i++;
    }
    searchHistory = filtered;
    saveSearchHistory();
    renderSearchPanelContent();
  }

  /**
   * 清空搜索框
   */
  function clearSearchInput() {
    lastQuery = "";
    lastResults = [];
    var input = document.getElementById("searchInput");
    if (input) {
      input.value = "";
      input.focus();
    }
    renderSearchPanelContent();
  }

  /**
   * 打开搜索面板
   */
  function openSearchPanel() {
    var panel = document.getElementById("searchPanel");
    if (panel) {
      panel.classList.add("active");
      renderSearchPanelContent();

      // 延迟聚焦，等DOM更新完
      setTimeout(function() {
        var input = document.getElementById("searchInput");
        if (input) input.focus();
      }, 100);
    }
  }

  /**
   * 关闭搜索面板
   */
  function closeSearchPanel() {
    var panel = document.getElementById("searchPanel");
    if (panel) {
      panel.classList.remove("active");
    }
  }

  /**
   * 切换搜索面板显示/隐藏
   */
  function toggleSearchPanel() {
    var panel = document.getElementById("searchPanel");
    if (!panel) return;

    if (panel.classList.contains("active")) {
      closeSearchPanel();
    } else {
      openSearchPanel();
    }
  }

  // 公开接口
  return {
    HISTORY_KEY: HISTORY_STORE_KEY,
    MAX_HISTORY: MAX_HISTORY_ITEMS,
    history: searchHistory,
    currentQuery: lastQuery,
    currentResults: lastResults,
    init: initSearchEngine,
    loadHistory: loadSearchHistory,
    saveHistory: saveSearchHistory,
    addToHistory: addHistoryItem,
    clearHistory: clearSearchHistory,
    getHistory: getSearchHistory,
    search: searchCards,
    calculateFieldScore: calcFieldScore,
    findMatchPositions: findMatchPositions,
    getNestedValue: getNestedValue,
    highlightText: highlightTextWithQuery,
    escapeRegex: escapeRegexChars,
    renderResults: renderSearchResults,
    renderHistory: renderSearchHistoryPanel,
    renderSearchPanel: renderSearchPanelContent,
    handleInput: handleSearchInput,
    handleKeydown: handleKeydownEvent,
    performSearch: doPerformSearch,
    selectResult: selectSearchResult,
    selectHistory: selectHistoryItem,
    removeFromHistory: removeHistoryItem,
    clearSearch: clearSearchInput,
    openSearchPanel: openSearchPanel,
    closeSearchPanel: closeSearchPanel,
    toggleSearchPanel: toggleSearchPanel
  };
})();

// 兼容Node.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = SearchEngine;
}
