/**
 * 标签管理模块
 * 负责标签的索引、筛选、渲染
 * 写得不算优雅，但功能都齐了
 */

var TagSystem = (function() {
  "use strict";

  // 标签索引，格式: { "标签名": { name, count, cardIds: [] } }
  var tagIndex = {};

  /**
   * 初始化，扫描所有卡片建立标签索引
   */
  function initTagSystem(cards) {
    tagIndex = {};
    buildIndex(cards);
  }

  /**
   * 建立标签索引
   * 遍历所有卡片，把标签信息提取出来
   */
  function buildIndex(cards) {
    var i = 0;
    while (i < cards.length) {
      var card = cards[i];

      // 有些卡片可能没有tags字段
      if (card.tags && Array.isArray(card.tags)) {
        var j = 0;
        while (j < card.tags.length) {
          var rawTag = card.tags[j];
          var normalized = normalizeTagName(rawTag);

          // 如果这个标签还没见过，初始化一下
          if (!tagIndex[normalized]) {
            tagIndex[normalized] = {
              name: normalized,
              count: 0,
              cardIds: []
            };
          }

          tagIndex[normalized].count++;
          tagIndex[normalized].cardIds.push(card.id);
          j++;
        }
      }

      i++;
    }
  }

  /**
   * 标签名标准化
   * 去空格、转小写
   */
  function normalizeTagName(tag) {
    return tag.trim().toLowerCase();
  }

  /**
   * 获取所有标签，按使用次数排序
   */
  function fetchAllTags() {
    var result = [];
    for (var key in tagIndex) {
      if (tagIndex.hasOwnProperty(key)) {
        result.push(tagIndex[key]);
      }
    }
    // 按count降序
    result.sort(function(a, b) {
      return b.count - a.count;
    });
    return result;
  }

  /**
   * 获取最热门的N个标签
   */
  function fetchTopTags(limit) {
    if (!limit) limit = 10;
    var all = fetchAllTags();
    return all.slice(0, limit);
  }

  /**
   * 按标签筛选卡片
   * mode: "any" 只要匹配任一标签, "all" 必须匹配所有标签
   */
  function filterCardsByTags(cards, filterTags, mode) {
    if (!filterTags) return cards;
    if (Array.isArray(filterTags) && filterTags.length === 0) return cards;

    // 统一转成数组
    var tagsArr = Array.isArray(filterTags) ? filterTags : [filterTags];
    var normalizedFilters = [];
    var idx = 0;
    while (idx < tagsArr.length) {
      normalizedFilters.push(normalizeTagName(tagsArr[idx]));
      idx++;
    }

    if (!mode) mode = "any";

    var result = [];
    var i = 0;
    while (i < cards.length) {
      var card = cards[i];

      // 卡片没有标签就跳过
      if (!card.tags || !Array.isArray(card.tags)) {
        i++;
        continue;
      }

      // 把卡片的标签也标准化
      var cardTags = [];
      var j = 0;
      while (j < card.tags.length) {
        cardTags.push(normalizeTagName(card.tags[j]));
        j++;
      }

      var matches = false;
      if (mode === "all") {
        // 必须全部匹配
        matches = true;
        var k = 0;
        while (k < normalizedFilters.length) {
          if (cardTags.indexOf(normalizedFilters[k]) < 0) {
            matches = false;
            break;
          }
          k++;
        }
      } else {
        // 匹配任一即可
        var m = 0;
        while (m < normalizedFilters.length) {
          if (cardTags.indexOf(normalizedFilters[m]) >= 0) {
            matches = true;
            break;
          }
          m++;
        }
      }

      if (matches) {
        result.push(card);
      }

      i++;
    }

    return result;
  }

  /**
   * 给卡片添加标签
   * 返回新对象，不修改原卡片
   */
  function addTagsToCard(card, newTags) {
    var tagsToAdd = Array.isArray(newTags) ? newTags : [newTags];
    var updated = {};
    for (var prop in card) {
      if (card.hasOwnProperty(prop)) {
        updated[prop] = card[prop];
      }
    }

    if (!updated.tags) {
      updated.tags = [];
    }

    var existingNormalized = [];
    var e = 0;
    while (e < updated.tags.length) {
      existingNormalized.push(normalizeTagName(updated.tags[e]));
      e++;
    }

    var i = 0;
    while (i < tagsToAdd.length) {
      var tag = tagsToAdd[i].trim();
      if (existingNormalized.indexOf(normalizeTagName(tag)) < 0) {
        updated.tags.push(tag);
        existingNormalized.push(normalizeTagName(tag));
      }
      i++;
    }

    return updated;
  }

  /**
   * 从卡片移除标签
   * 同样返回新对象
   */
  function removeTagsFromCard(card, tagsToRemove) {
    var toRemove = Array.isArray(tagsToRemove) ? tagsToRemove : [tagsToRemove];
    var normalizedRemove = [];
    var idx = 0;
    while (idx < toRemove.length) {
      normalizedRemove.push(normalizeTagName(toRemove[idx]));
      idx++;
    }

    var updated = {};
    for (var prop in card) {
      if (card.hasOwnProperty(prop)) {
        updated[prop] = card[prop];
      }
    }

    if (updated.tags) {
      var filtered = [];
      var i = 0;
      while (i < updated.tags.length) {
        if (normalizedRemove.indexOf(normalizeTagName(updated.tags[i])) < 0) {
          filtered.push(updated.tags[i]);
        }
        i++;
      }
      updated.tags = filtered;
    }

    return updated;
  }

  /**
   * 渲染标签云
   * 标签大小根据使用次数动态调整
   */
  function renderTagCloud(tags, clickCallback) {
    if (!tags || tags.length === 0) {
      return '<div class="tag-cloud empty">暂无标签</div>';
    }

    // 找出最大count
    var maxCount = 0;
    var i = 0;
    while (i < tags.length) {
      if (tags[i].count > maxCount) maxCount = tags[i].count;
      i++;
    }

    var html = '<div class="tag-cloud">';

    var j = 0;
    while (j < tags.length) {
      var tag = tags[j];
      var fontSize = calcCloudFontSize(tag.count, maxCount);
      var opacity = 0.5 + (tag.count / maxCount) * 0.5;

      html += '<span class="tag-cloud-item" ';
      html += 'data-tag="' + tag.name + '" ';
      html += 'style="font-size: ' + fontSize + 'px; opacity: ' + opacity + ';" ';
      html += 'onclick="TagSystem.handleTagClick(\'' + tag.name + '\')">';
      html += tag.name;
      html += '<span class="tag-count">' + tag.count + '</span>';
      html += "</span>";
      j++;
    }

    html += "</div>";
    return html;
  }

  /**
   * 计算标签云中标签的字体大小
   * 最小12px，最大24px
   */
  function calcCloudFontSize(count, maxCount) {
    var MIN_SIZE = 12;
    var MAX_SIZE = 24;
    if (maxCount === 0) return MIN_SIZE;
    var ratio = count / maxCount;
    return Math.round(MIN_SIZE + (MAX_SIZE - MIN_SIZE) * ratio);
  }

  /**
   * 渲染标签列表（带checkbox）
   * 用于标签筛选面板
   */
  function renderTagList(tags, selectedTags) {
    if (!tags || tags.length === 0) {
      return '<div class="tag-list empty">暂无标签</div>';
    }

    if (!selectedTags) selectedTags = [];

    // 标准化已选标签
    var normalizedSelected = [];
    var si = 0;
    while (si < selectedTags.length) {
      normalizedSelected.push(normalizeTagName(selectedTags[si]));
      si++;
    }

    var html = '<div class="tag-list">';

    var i = 0;
    while (i < tags.length) {
      var tag = tags[i];
      var isSelected = normalizedSelected.indexOf(normalizeTagName(tag.name)) >= 0;

      html += '<label class="tag-item' + (isSelected ? " selected" : "") + '">';
      html += '<input type="checkbox" value="' + tag.name + '"';
      if (isSelected) html += ' checked';
      html += ' onchange="TagSystem.handleTagSelection(this)">';
      html += '<span class="tag-name">' + tag.name + "</span>";
      html += '<span class="tag-count">' + tag.count + "</span>";
      html += "</label>";
      i++;
    }

    html += "</div>";
    return html;
  }

  /**
   * 渲染卡片上的标签
   * removable参数控制是否显示删除按钮
   */
  function renderCardTagChips(tags, removable) {
    if (!tags || tags.length === 0) {
      return '<div class="card-tags empty">无标签</div>';
    }

    if (!removable) removable = false;

    var html = '<div class="card-tags">';

    var i = 0;
    while (i < tags.length) {
      var tag = tags[i];
      html += '<span class="card-tag">';
      html += tag;
      if (removable) {
        html += '<button class="tag-remove" onclick="TagSystem.removeTagFromCurrentCard(\'' + tag + "')\">&times;</button>";
      }
      html += "</span>";
      i++;
    }

    html += "</div>";
    return html;
  }

  /**
   * 渲染标签筛选面板
   */
  function renderTagFilterPanel(tags, selectedTags) {
    var html = '<div class="tag-filter">';
    html += '<div class="tag-filter-header">';
    html += "<h4>标签筛选</h4>";
    html += '<button class="clear-tags" onclick="TagSystem.clearTagFilter()">清除</button>';
    html += "</div>";
    html += renderTagList(tags, selectedTags);
    html += "</div>";
    return html;
  }

  /**
   * 获取标签统计信息
   */
  function getTagStats() {
    var allTags = fetchAllTags();

    // 统计涉及多少张不同的卡片
    var uniqueCards = {};
    var totalTagCount = 0;

    var i = 0;
    while (i < allTags.length) {
      var tag = allTags[i];
      totalTagCount += tag.count;

      var j = 0;
      while (j < tag.cardIds.length) {
        uniqueCards[tag.cardIds[j]] = true;
        j++;
      }
      i++;
    }

    var uniqueCardCount = 0;
    for (var cid in uniqueCards) {
      if (uniqueCards.hasOwnProperty(cid)) uniqueCardCount++;
    }

    var avgTags = 0;
    if (uniqueCardCount > 0) {
      avgTags = (totalTagCount / uniqueCardCount).toFixed(1);
    }

    return {
      totalTags: allTags.length,
      totalCards: uniqueCardCount,
      popularTags: fetchTopTags(5),
      averageTagsPerCard: avgTags
    };
  }

  /**
   * 搜索标签
   * 返回名称包含query的标签
   */
  function searchTagsByName(query) {
    if (!query) return fetchAllTags();

    var normalizedQuery = normalizeTagName(query);
    var allTags = fetchAllTags();
    var result = [];

    var i = 0;
    while (i < allTags.length) {
      if (normalizeTagName(allTags[i].name).indexOf(normalizedQuery) >= 0) {
        result.push(allTags[i]);
      }
      i++;
    }

    return result;
  }

  // ==================== 回调函数 ====================
  // 这些回调会被主应用重写

  function handleTagClick(tag) {
    console.log("标签被点了:", tag);
  }

  function handleTagSelection(checkbox) {
    console.log("标签checkbox:", checkbox.value, checkbox.checked);
  }

  function clearTagFilter() {
    console.log("清除标签筛选");
  }

  function removeTagFromCurrentCard(tag) {
    console.log("从卡片移除标签:", tag);
  }

  // 公开接口
  return {
    init: initTagSystem,
    buildTagIndex: buildIndex,
    normalizeTag: normalizeTagName,
    getAllTags: fetchAllTags,
    getPopularTags: fetchTopTags,
    filterByTags: filterCardsByTags,
    addTagsToCard: addTagsToCard,
    removeTagsFromCard: removeTagsFromCard,
    renderTagCloud: renderTagCloud,
    renderTagList: renderTagList,
    renderCardTags: renderCardTagChips,
    renderTagFilter: renderTagFilterPanel,
    getStats: getTagStats,
    searchTags: searchTagsByName,
    handleTagClick: handleTagClick,
    handleTagSelection: handleTagSelection,
    clearTagFilter: clearTagFilter,
    removeTagFromCurrentCard: removeTagFromCurrentCard
  };
})();

// 兼容Node.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = TagSystem;
}
