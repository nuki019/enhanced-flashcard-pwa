/**
 * 闪卡学习系统 - 主逻辑
 * 写这个的时候参考了一些间隔重复的资料，自己魔改了一版
 * 有些地方写得比较糙，能用就行
 */

// 存储相关的key，版本号加了v2，之前v1有点问题
const PROGRESS_STORE_KEY = "xg-card-progress-v2";
const SESSION_STORE_KEY = "xg-card-session-v2";
const USER_SETTINGS_KEY = "xg-card-settings-v2";

// DOM元素缓存，一次性拿完，省得后面反复查询
// 说实话这个写法有点啰嗦，但是看起来清楚
const domCache = {
  // 顶部区域
  titleEl: document.querySelector("#deckTitle"),
  installBtn: document.querySelector("#installButton"),
  searchBtn: document.querySelector("#searchButton"),

  // 题型切换那块
  subjBtn: document.querySelector("#subjectiveMode"),
  objBtn: document.querySelector("#objectiveMode"),
  subjCnt: document.querySelector("#subjectiveCount"),
  objCnt: document.querySelector("#objectiveCount"),

  // 标签筛选
  tagFilterBtn: document.querySelector("#tagFilterButton"),
  activeTagsEl: document.querySelector("#activeTags"),

  // 学习进度那几个数字
  progressFill: document.querySelector("#progressBar"),
  studiedNum: document.querySelector("#studiedCount"),
  masteryNum: document.querySelector("#masteryPercent"),
  todayNum: document.querySelector("#todayCount"),
  dueNum: document.querySelector("#dueCount"),

  // 间隔重复的状态显示
  retentionNum: document.querySelector("#retentionRate"),
  nextReviewEl: document.querySelector("#nextReview"),

  // 闪卡主体
  cardEl: document.querySelector("#flashcard"),
  questionMeta: document.querySelector("#cardChapter"),
  questionScore: document.querySelector("#cardScore"),
  questionTags: document.querySelector("#cardTags"),
  answerMeta: document.querySelector("#answerChapter"),
  answerScore: document.querySelector("#answerScore"),
  answerTags: document.querySelector("#answerTags"),
  questionBody: document.querySelector("#questionText"),
  answerQuestionBody: document.querySelector("#answerQuestionText"),
  answerBody: document.querySelector("#answerText"),

  // 评分区域
  ratingArea: document.querySelector("#ratingPanel"),
  ratingBtns: document.querySelector("#ratingButtons"),
  cutBtn: document.querySelector("#cutButton"),
  undoCutBtn: document.querySelector("#undoCutButton"),

  // 底部按钮
  nextBtn: document.querySelector("#nextButton"),
  resetBtn: document.querySelector("#resetButton"),
  statsBtn: document.querySelector("#statsButton"),

  // 弹出面板
  searchPanel: document.querySelector("#searchPanel"),
  tagPanel: document.querySelector("#tagPanel"),
  statsPanel: document.querySelector("#statsPanel")
};

// 题库数据，从全局变量拿
const allCards = Array.isArray(window.FLASHCARD_DATA?.cards) ? window.FLASHCARD_DATA.cards : [];

// 当前学习进度、会话状态、用户设置
let studyProgress = loadStudyProgress();
let currentSession = loadCurrentSession();
let userPrefs = loadUserPreferences();

// 当前选的题型和标签
let activeQuestionType = userPrefs.questionType || "subjective";
let pickedTags = userPrefs.pickedTags || [];

// 当前正在看的卡片
let viewingCard = null;
let showingAnswer = false;

// 触摸滑动用的
let swipeStartX = 0;
let swipeStartY = 0;

// PWA安装相关
let pwaInstallEvent = null;

// ==================== 初始化 ====================
// 页面加载完就跑这个
(function bootstrap() {
  // 先把标签和搜索模块初始化了
  TagSystem.init(allCards);
  SearchEngine.init();

  // 设置好各种回调
  wireUpCallbacks();

  // 渲染题型按钮和标签
  renderTypeButtons();
  renderTagBar();

  // 绑定各种事件
  attachAllEvents();

  // 注册service worker，离线用的
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function() {
      navigator.serviceWorker.register("sw.js").catch(function(err) {
        // 注册失败就算了，不影响使用
        console.log("SW注册失败:", err);
      });
    });
  }

  // 选一张卡片开始
  let firstCard = chooseNextCard(null);
  setViewingCard(firstCard);

  // 刷新统计数据
  refreshStatsDisplay();
})();

// ==================== 回调设置 ====================
// 把各个模块的回调串起来
function wireUpCallbacks() {
  // 标签点击
  TagSystem.handleTagClick = function(tagName) {
    flipTagSelection(tagName);
  };

  // 标签checkbox选择
  TagSystem.handleTagSelection = function(checkboxEl) {
    flipTagSelection(checkboxEl.value);
  };

  // 清除所有标签筛选
  TagSystem.clearTagFilter = function() {
    pickedTags = [];
    persistUserPrefs();
    renderTagBar();
    setViewingCard(chooseNextCard(null));
    refreshStatsDisplay();
  };

  // 从当前卡片移除标签（暂时没实现编辑功能）
  TagSystem.removeTagFromCurrentCard = function(tagName) {
    // TODO: 后面再做编辑卡片标签的功能
    console.log("想删标签:", tagName, "但是还没做这个功能");
  };

  // 搜索执行
  SearchEngine.performSearch = function(queryText) {
    let searchResults = SearchEngine.search(allCards, queryText, {
      searchFields: ["question", "answer", "tags", "chapter"]
    });

    let container = document.getElementById("searchResults");
    if (container) {
      container.innerHTML = SearchEngine.renderResults(searchResults, queryText);
    }
  };

  // 搜索结果点击
  SearchEngine.selectResult = function(cardId) {
    let matched = allCards.find(function(c) { return c.id === cardId; });
    if (matched) {
      setViewingCard(matched);
      SearchEngine.closeSearchPanel();
    }
  };
}

// ==================== 事件绑定 ====================
function attachAllEvents() {
  // 卡片点击翻转
  domCache.cardEl.addEventListener("click", flipCard);

  // 键盘操作
  domCache.cardEl.addEventListener("keydown", function(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      flipCard();
    }
    // 右箭头下一张
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goToNextCard();
    }
  });

  // 触摸滑动 - 左滑下一张
  // 这个阈值56是试出来的，感觉差不多
  domCache.cardEl.addEventListener("touchstart", function(e) {
    let t = e.changedTouches[0];
    swipeStartX = t.clientX;
    swipeStartY = t.clientY;
  }, { passive: true });

  domCache.cardEl.addEventListener("touchend", function(e) {
    let t = e.changedTouches[0];
    let deltaX = t.clientX - swipeStartX;
    let deltaY = t.clientY - swipeStartY;
    // 水平滑动距离大于56且大于垂直距离的1.2倍
    if (Math.abs(deltaX) > 56 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      goToNextCard();
    }
  }, { passive: true });

  // 评分按钮点击
  domCache.ratingBtns.addEventListener("click", function(e) {
    let btn = e.target.closest("button[data-score]");
    if (!btn || !viewingCard) return;
    submitRating(Number(btn.dataset.score));
  });

  // 题型切换
  domCache.subjBtn.addEventListener("click", function() { changeQuestionType("subjective"); });
  domCache.objBtn.addEventListener("click", function() { changeQuestionType("objective"); });

  // 标签筛选面板
  domCache.tagFilterBtn.addEventListener("click", toggleTagPanelVisibility);

  // 各种操作按钮
  domCache.cutBtn.addEventListener("click", markCardAsKnown);
  domCache.undoCutBtn.addEventListener("click", undoMarkAsKnown);
  domCache.nextBtn.addEventListener("click", goToNextCard);
  domCache.resetBtn.addEventListener("click", clearAllProgress);
  domCache.statsBtn.addEventListener("click", toggleStatsPanelVisibility);
  domCache.searchBtn.addEventListener("click", function() { SearchEngine.toggleSearchPanel(); });

  // PWA安装提示
  window.addEventListener("beforeinstallprompt", function(e) {
    e.preventDefault();
    pwaInstallEvent = e;
    domCache.installBtn.hidden = false;
  });

  domCache.installBtn.addEventListener("click", function() {
    if (!pwaInstallEvent) return;
    pwaInstallEvent.prompt();
    pwaInstallEvent.userChoice.then(function() {
      pwaInstallEvent = null;
      domCache.installBtn.hidden = true;
    });
  });
}

// ==================== 数据持久化 ====================
// 从localStorage读学习进度
function loadStudyProgress() {
  try {
    let raw = localStorage.getItem(PROGRESS_STORE_KEY);
    let parsed = JSON.parse(raw || "{}");
    return (parsed && typeof parsed === "object") ? parsed : {};
  } catch(e) {
    // 解析失败就返回空，可能是数据损坏了
    console.warn("进度数据读取失败，重置为空", e);
    return {};
  }
}

// 保存学习进度
function persistStudyProgress() {
  try {
    localStorage.setItem(PROGRESS_STORE_KEY, JSON.stringify(studyProgress));
  } catch(e) {
    console.error("保存进度失败:", e);
  }
}

// 读会话状态
function loadCurrentSession() {
  try {
    let raw = sessionStorage.getItem(SESSION_STORE_KEY);
    let parsed = JSON.parse(raw || "{}");
    if (parsed && Array.isArray(parsed.viewedIds)) {
      return parsed;
    }
  } catch(e) {
    // ignore
  }
  return { viewedIds: [] };
}

// 保存会话
function persistSession() {
  sessionStorage.setItem(SESSION_STORE_KEY, JSON.stringify(currentSession));
}

// 读用户偏好设置
function loadUserPreferences() {
  try {
    let raw = localStorage.getItem(USER_SETTINGS_KEY);
    let parsed = JSON.parse(raw || "{}");
    return (parsed && typeof parsed === "object") ? parsed : {};
  } catch(e) {
    return {};
  }
}

// 保存用户偏好
function persistUserPrefs() {
  userPrefs.questionType = activeQuestionType;
  userPrefs.pickedTags = pickedTags;
  localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(userPrefs));
}

// 获取某张卡片的学习记录，没有就返回默认值
function getCardRecord(cardId) {
  let rec = studyProgress[cardId];
  if (rec) return rec;

  // 默认记录
  return {
    score: 0,
    viewCount: 0,
    lastStudied: 0,
    scheduledFor: 0,
    gapDays: 0,
    repeatCount: 0,
    difficulty: 2.5,
    memoryStrength: 100,
    isKnown: false
  };
}

// 记录卡片出现（增加查看次数）
function logCardAppearance(cardId) {
  if (!cardId) return;
  let rec = getCardRecord(cardId);
  studyProgress[cardId] = Object.assign({}, rec, {
    viewCount: (rec.viewCount || 0) + 1
  });
  persistStudyProgress();
}

// 格式化显示分数状态
function formatCardStatus(record) {
  if (record.isKnown) return "已会";
  if (!record.score) return "未学习";

  let status = SpacedRepetition.getReviewStatus(record);
  let labelMap = {
    "new": "新",
    "learning": "学习中",
    "review": "待复习",
    "mastered": "已掌握"
  };

  let label = labelMap[status] || "";
  return record.score + "分 · " + label;
}

// ==================== 卡片选择逻辑 ====================
// 获取当前题型下可用的卡片列表
function getActiveCardPool(includeKnown) {
  let result = [];
  let i = 0;
  while (i < allCards.length) {
    let card = allCards[i];
    let skip = false;

    // 题型过滤
    if (card.mode !== activeQuestionType) {
      skip = true;
    }

    // 已会的卡片要不要包含
    if (!skip && !includeKnown) {
      let rec = getCardRecord(card.id);
      if (rec.isKnown) {
        skip = true;
      }
    }

    // 标签过滤
    if (!skip && pickedTags.length > 0) {
      let cardTagList = (card.tags || []).map(function(t) { return t.toLowerCase(); });
      let hasMatchingTag = false;
      let j = 0;
      while (j < pickedTags.length) {
        if (cardTagList.indexOf(pickedTags[j].toLowerCase()) >= 0) {
          hasMatchingTag = true;
          break;
        }
        j++;
      }
      if (!hasMatchingTag) skip = true;
    }

    if (!skip) {
      result.push(card);
    }
    i++;
  }
  return result;
}

// 选下一张卡片
// 这个逻辑有点复杂，优先选需要复习的，然后按权重随机
function chooseNextCard(prevCardId) {
  let pool = getActiveCardPool(false);
  if (pool.length === 0) return null;

  // 先找优先要复习的卡片
  let urgentCard = findUrgentCard(prevCardId);
  if (urgentCard) return urgentCard;

  // 过滤掉上一张
  let candidates = pool.filter(function(c) { return c.id !== prevCardId; });
  if (candidates.length === 0) candidates = pool;

  // 计算每张卡片的权重
  let weighted = [];
  let idx = 0;
  while (idx < candidates.length) {
    let card = candidates[idx];
    let rec = getCardRecord(card.id);
    let w = SpacedRepetition.calculateCardWeight(rec);
    weighted.push({ card: card, weight: w });
    idx++;
  }

  // 按权重随机选择
  let totalWeight = 0;
  let k = 0;
  while (k < weighted.length) {
    totalWeight += weighted[k].weight;
    k++;
  }

  let rand = Math.random() * totalWeight;
  let accumulated = 0;
  let m = 0;
  while (m < weighted.length) {
    accumulated += weighted[m].weight;
    if (rand <= accumulated) {
      return weighted[m].card;
    }
    m++;
  }

  // 兜底返回最后一张
  return weighted[weighted.length - 1].card;
}

// 找最紧急需要复习的卡片
function findUrgentCard(skipId) {
  let now = Date.now();
  let bestCard = null;
  let bestUrgency = -1;

  let cards = getActiveCardPool(false);
  let i = 0;
  while (i < cards.length) {
    let card = cards[i];
    if (card.id === skipId) {
      i++;
      continue;
    }

    let rec = getCardRecord(card.id);

    // 新卡片优先级最高
    if (!rec.lastStudied) {
      if (100 > bestUrgency) {
        bestCard = card;
        bestUrgency = 100;
      }
      i++;
      continue;
    }

    // 需要复习的卡片
    if (SpacedRepetition.needsReview(rec)) {
      let overdueDays = (now - rec.scheduledFor) / (24 * 60 * 60 * 1000);
      let urgency = 50 + Math.min(overdueDays, 30);
      if (urgency > bestUrgency) {
        bestCard = card;
        bestUrgency = urgency;
      }
    }

    i++;
  }

  return bestCard;
}

// ==================== 卡片渲染 ====================
function renderCurrentCard(showAns) {
  if (!viewingCard) {
    renderEmptyState();
    return;
  }

  let rec = getCardRecord(viewingCard.id);
  showingAnswer = showAns;

  // 元信息：题号 · 章节 · 题型
  let metaText = (viewingCard.number || "") + " · " + viewingCard.chapter + " · " + viewingCard.kind;
  domCache.questionMeta.textContent = metaText;
  domCache.questionScore.textContent = formatCardStatus(rec);
  domCache.answerMeta.textContent = metaText;
  domCache.answerScore.textContent = formatCardStatus(rec);

  // 标签
  domCache.questionTags.innerHTML = TagSystem.renderCardTags(viewingCard.tags, false);
  domCache.answerTags.innerHTML = TagSystem.renderCardTags(viewingCard.tags, false);

  // 渲染题目和答案内容
  RichText.renderTo(domCache.questionBody, viewingCard.question, true);
  RichText.renderTo(domCache.answerQuestionBody, viewingCard.question, true);
  RichText.renderTo(domCache.answerBody, viewingCard.answer, true);

  // 间隔重复信息
  updateSpacedRepetitionDisplay(rec);

  // 翻转状态
  domCache.cardEl.classList.toggle("is-flipped", showAns);
  domCache.ratingArea.hidden = !showAns;

  // 客观题才显示"已会"按钮
  domCache.cutBtn.hidden = (activeQuestionType !== "objective");
  domCache.undoCutBtn.hidden = (activeQuestionType !== "objective" || !currentSession.lastCutId);

  // 标记当前评分
  highlightSelectedRating(rec.score || 0);
}

function renderEmptyState() {
  showingAnswer = false;
  let typeName = (activeQuestionType === "objective") ? "客观题" : "主观题";

  domCache.questionMeta.textContent = typeName;
  domCache.questionScore.textContent = "";
  domCache.questionTags.innerHTML = "";
  domCache.answerMeta.textContent = typeName;
  domCache.answerScore.textContent = "";
  domCache.answerTags.innerHTML = "";

  let emptyMsg;
  if (pickedTags.length > 0) {
    emptyMsg = "没有匹配当前标签的" + typeName;
  } else {
    emptyMsg = typeName + "已全部标会";
  }

  domCache.questionBody.innerHTML = '<div class="empty-state">' + emptyMsg + '</div>';
  domCache.answerQuestionBody.innerHTML = "";

  if (activeQuestionType === "objective") {
    domCache.answerBody.innerHTML = '<div class="empty-state">可点击撤销上一次标会，或重置进度。</div>';
  } else {
    domCache.answerBody.innerHTML = "";
  }

  domCache.cardEl.classList.remove("is-flipped");
  domCache.ratingArea.hidden = (activeQuestionType !== "objective");
  domCache.cutBtn.hidden = true;
  domCache.undoCutBtn.hidden = (activeQuestionType !== "objective" || !currentSession.lastCutId);

  if (domCache.retentionNum) domCache.retentionNum.textContent = "--";
  if (domCache.nextReviewEl) domCache.nextReviewEl.textContent = "--";
}

// 更新间隔重复信息显示
function updateSpacedRepetitionDisplay(record) {
  if (!domCache.retentionNum || !domCache.nextReviewEl) return;

  if (record.lastStudied) {
    let rate = record.memoryStrength || 0;
    domCache.retentionNum.textContent = rate + "%";
    domCache.retentionNum.style.color = SpacedRepetition.getRetentionColor(rate);
    domCache.nextReviewEl.textContent = SpacedRepetition.formatNextReview(record.scheduledFor);
  } else {
    domCache.retentionNum.textContent = "新卡片";
    domCache.retentionNum.style.color = "#2196f3";
    domCache.nextReviewEl.textContent = "待学习";
  }
}

// 高亮选中的评分按钮
function highlightSelectedRating(score) {
  let buttons = domCache.ratingBtns.querySelectorAll("button[data-score]");
  let i = 0;
  while (i < buttons.length) {
    let btn = buttons[i];
    let btnScore = Number(btn.dataset.score);
    if (btnScore === score) {
      btn.classList.add("selected");
    } else {
      btn.classList.remove("selected");
    }
    i++;
  }
}

// ==================== 用户操作 ====================
function flipCard() {
  if (!viewingCard) return;
  renderCurrentCard(!showingAnswer);
}

function submitRating(score) {
  if (!viewingCard) return;

  let rec = getCardRecord(viewingCard.id);

  // 用间隔重复算法算下次复习时间
  let updatedRec = SpacedRepetition.calculateNextReview(rec, score);

  studyProgress[viewingCard.id] = Object.assign({}, updatedRec, {
    score: score,
    lastStudied: Date.now()
  });

  persistStudyProgress();
  trackRecentCard(viewingCard.id);
  refreshStatsDisplay();
  goToNextCard();
}

function goToNextCard() {
  let nextCard = chooseNextCard(viewingCard ? viewingCard.id : null);
  setViewingCard(nextCard);
}

function setViewingCard(card) {
  viewingCard = card;
  if (card) logCardAppearance(card.id);

  // 触发进入动画
  domCache.cardEl.classList.remove("is-entering");
  // 强制reflow让动画重新播放
  void domCache.cardEl.offsetWidth;
  domCache.cardEl.classList.add("is-entering");

  renderCurrentCard(false);
}

// 记录最近看过的卡片
function trackRecentCard(cardId) {
  let ids = currentSession.viewedIds || [];
  // 去重
  ids = ids.filter(function(id) { return id !== cardId; });
  ids.unshift(cardId);
  // 最多记16个
  if (ids.length > 16) ids = ids.slice(0, 16);
  currentSession.viewedIds = ids;
  persistSession();
}

// ==================== 标签相关 ====================
function toggleTagPanelVisibility() {
  let panel = domCache.tagPanel;
  if (!panel) return;

  if (panel.classList.contains("active")) {
    panel.classList.remove("active");
  } else {
    panel.classList.add("active");
    renderTagBar();
  }
}

function renderTagBar() {
  let allTags = TagSystem.getAllTags();
  let container = document.getElementById("tagFilterContent");
  if (container) {
    container.innerHTML = TagSystem.renderTagFilter(allTags, pickedTags);
  }
  renderActiveTagChips();
}

function renderActiveTagChips() {
  if (!domCache.activeTagsEl) return;

  if (pickedTags.length === 0) {
    domCache.activeTagsEl.innerHTML = "";
    return;
  }

  let html = '<div class="active-tags">';
  let i = 0;
  while (i < pickedTags.length) {
    let tag = pickedTags[i];
    html += '<span class="active-tag">' + tag +
            '<button onclick="flipTagSelection(\'' + tag + '\')">&times;</button></span>';
    i++;
  }
  html += "</div>";
  domCache.activeTagsEl.innerHTML = html;
}

function flipTagSelection(tagName) {
  let normalized = tagName.toLowerCase();
  let foundIdx = -1;
  let i = 0;
  while (i < pickedTags.length) {
    if (pickedTags[i].toLowerCase() === normalized) {
      foundIdx = i;
      break;
    }
    i++;
  }

  if (foundIdx >= 0) {
    pickedTags.splice(foundIdx, 1);
  } else {
    pickedTags.push(tagName);
  }

  persistUserPrefs();
  renderTagBar();
  setViewingCard(chooseNextCard(null));
  refreshStatsDisplay();
}

// ==================== 统计数据 ====================
function refreshStatsDisplay() {
  let fullPool = getActiveCardPool(true);
  let total = fullPool.length || 1;
  let visiblePool = getActiveCardPool(false);

  // 收集所有记录
  let records = [];
  let i = 0;
  while (i < fullPool.length) {
    records.push(getCardRecord(fullPool[i].id));
    i++;
  }

  // 学习过的卡片数
  let studiedCount = 0;
  let scoreTotal = 0;
  let j = 0;
  while (j < records.length) {
    if (records[j].score > 0) studiedCount++;
    scoreTotal += Number(records[j].score || 0);
    j++;
  }

  let masteryPercent = Math.round((scoreTotal / (total * 5)) * 100);

  // 今天学了多少
  let todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  let todayTimestamp = todayStart.getTime();

  let todayCount = 0;
  let dueCount = 0;
  let k = 0;
  while (k < records.length) {
    let rec = records[k];
    if ((rec.lastStudied || 0) >= todayTimestamp) todayCount++;
    if (rec.lastStudied && SpacedRepetition.needsReview(rec)) dueCount++;
    k++;
  }

  domCache.studiedNum.textContent = studiedCount + "/" + fullPool.length;
  domCache.masteryNum.textContent = masteryPercent + "%";
  domCache.todayNum.textContent = String(todayCount);
  domCache.progressFill.style.width = Math.round((studiedCount / total) * 100) + "%";

  if (domCache.dueNum) {
    domCache.dueNum.textContent = String(dueCount);
  }

  let typeName = (activeQuestionType === "subjective") ? "主观题" : "客观题";
  domCache.titleEl.textContent = typeName + " · " + visiblePool.length + "/" + fullPool.length + " 张";
}

function toggleStatsPanelVisibility() {
  let panel = domCache.statsPanel;
  if (!panel) return;

  if (panel.classList.contains("active")) {
    panel.classList.remove("active");
  } else {
    panel.classList.add("active");
    buildStatsPanelContent();
  }
}

function buildStatsPanelContent() {
  let container = document.getElementById("statsContent");
  if (!container) return;

  let stats = SpacedRepetition.generateStats(studyProgress);
  let tagStats = TagSystem.getStats();

  // 拼HTML，这个写法是有点啰嗦，但是好改
  let html = "";
  html += '<div class="stats-grid">';

  // 学习进度卡片
  html += '<div class="stat-card">';
  html += "<h4>学习进度</h4>";
  html += '<div class="stat-items">';
  html += '<div class="stat-item"><span class="stat-value">' + stats.total + '</span><span class="stat-label">总卡片</span></div>';
  html += '<div class="stat-item"><span class="stat-value">' + stats.newCards + '</span><span class="stat-label">新卡片</span></div>';
  html += '<div class="stat-item"><span class="stat-value">' + stats.learning + '</span><span class="stat-label">学习中</span></div>';
  html += '<div class="stat-item"><span class="stat-value">' + stats.mastered + '</span><span class="stat-label">已掌握</span></div>';
  html += "</div></div>";

  // 复习状态卡片
  html += '<div class="stat-card">';
  html += "<h4>复习状态</h4>";
  html += '<div class="stat-items">';
  html += '<div class="stat-item"><span class="stat-value">' + stats.dueToday + '</span><span class="stat-label">待复习</span></div>';
  html += '<div class="stat-item"><span class="stat-value">' + stats.averageRetention + '%</span><span class="stat-label">平均保留率</span></div>';
  html += "</div></div>";

  // 标签统计
  html += '<div class="stat-card">';
  html += "<h4>标签统计</h4>";
  html += '<div class="stat-items">';
  html += '<div class="stat-item"><span class="stat-value">' + tagStats.totalTags + '</span><span class="stat-label">标签数</span></div>';
  html += '<div class="stat-item"><span class="stat-value">' + tagStats.averageTagsPerCard + '</span><span class="stat-label">平均标签/卡</span></div>';
  html += "</div>";

  // 热门标签列表
  html += '<div class="popular-tags"><h5>热门标签</h5>';
  let t = 0;
  while (t < tagStats.popularTags.length) {
    let tag = tagStats.popularTags[t];
    html += '<span class="popular-tag">' + tag.name + " (" + tag.count + ")</span>";
    t++;
  }
  html += "</div>";
  html += "</div>";

  html += "</div>";
  container.innerHTML = html;
}

// ==================== 题型切换 ====================
function renderTypeButtons() {
  let subjTotal = 0;
  let objTotal = 0;
  let i = 0;
  while (i < allCards.length) {
    if (allCards[i].mode === "subjective") subjTotal++;
    if (allCards[i].mode === "objective") objTotal++;
    i++;
  }

  domCache.subjCnt.textContent = subjTotal + " 张";
  domCache.objCnt.textContent = objTotal + " 张";

  if (activeQuestionType === "subjective") {
    domCache.subjBtn.classList.add("selected");
    domCache.objBtn.classList.remove("selected");
  } else {
    domCache.subjBtn.classList.remove("selected");
    domCache.objBtn.classList.add("selected");
  }
}

function changeQuestionType(newType) {
  if (activeQuestionType === newType) return;
  activeQuestionType = newType;
  persistUserPrefs();
  renderTypeButtons();
  setViewingCard(chooseNextCard(null));
  refreshStatsDisplay();
}

// ==================== 卡片操作 ====================
// 标记为已会（客观题专用）
function markCardAsKnown(e) {
  if (e) e.stopPropagation();
  if (!viewingCard || activeQuestionType !== "objective") return;

  let rec = getCardRecord(viewingCard.id);
  studyProgress[viewingCard.id] = Object.assign({}, rec, {
    isKnown: true,
    lastStudied: Date.now()
  });

  currentSession.lastCutId = viewingCard.id;
  persistStudyProgress();
  persistSession();
  goToNextCard();
  refreshStatsDisplay();
}

// 撤销标会
function undoMarkAsKnown(e) {
  if (e) e.stopPropagation();
  if (!currentSession.lastCutId) return;

  let rec = getCardRecord(currentSession.lastCutId);
  studyProgress[currentSession.lastCutId] = Object.assign({}, rec, {
    isKnown: false
  });

  currentSession.lastCutId = null;
  persistStudyProgress();
  persistSession();
  refreshStatsDisplay();

  if (!viewingCard) setViewingCard(chooseNextCard(null));
  renderCurrentCard(showingAnswer);
}

// 重置所有进度
function clearAllProgress() {
  let confirmed = window.confirm("确认清空本机学习记录？题库不会删除。");
  if (!confirmed) return;

  studyProgress = {};
  currentSession = { viewedIds: [], lastCutId: null };
  localStorage.removeItem(PROGRESS_STORE_KEY);
  sessionStorage.removeItem(SESSION_STORE_KEY);

  setViewingCard(chooseNextCard(null));
  refreshStatsDisplay();
}
