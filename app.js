/**
 * 智能闪卡学习系统 - 主应用逻辑
 * 集成间隔重复、富文本、标签系统、搜索功能
 */

const STORAGE_KEY = "xg-enhanced-flashcard-progress-v1";
const SESSION_KEY = "xg-enhanced-flashcard-session-v1";
const SETTINGS_KEY = "xg-enhanced-flashcard-settings-v1";

const elements = {
  // 头部
  deckTitle: document.querySelector("#deckTitle"),
  installButton: document.querySelector("#installButton"),
  searchButton: document.querySelector("#searchButton"),

  // 模式选择
  subjectiveMode: document.querySelector("#subjectiveMode"),
  objectiveMode: document.querySelector("#objectiveMode"),
  subjectiveCount: document.querySelector("#subjectiveCount"),
  objectiveCount: document.querySelector("#objectiveCount"),

  // 标签筛选
  tagFilterButton: document.querySelector("#tagFilterButton"),
  activeTags: document.querySelector("#activeTags"),

  // 学习进度
  progressBar: document.querySelector("#progressBar"),
  studiedCount: document.querySelector("#studiedCount"),
  masteryPercent: document.querySelector("#masteryPercent"),
  todayCount: document.querySelector("#todayCount"),
  dueCount: document.querySelector("#dueCount"),

  // 间隔重复状态
  retentionRate: document.querySelector("#retentionRate"),
  nextReview: document.querySelector("#nextReview"),

  // 闪卡
  flashcard: document.querySelector("#flashcard"),
  cardChapter: document.querySelector("#cardChapter"),
  cardScore: document.querySelector("#cardScore"),
  cardTags: document.querySelector("#cardTags"),
  answerChapter: document.querySelector("#answerChapter"),
  answerScore: document.querySelector("#answerScore"),
  answerTags: document.querySelector("#answerTags"),
  questionText: document.querySelector("#questionText"),
  answerQuestionText: document.querySelector("#answerQuestionText"),
  answerText: document.querySelector("#answerText"),

  // 评分面板
  ratingPanel: document.querySelector("#ratingPanel"),
  ratingButtons: document.querySelector("#ratingButtons"),
  cutButton: document.querySelector("#cutButton"),
  undoCutButton: document.querySelector("#undoCutButton"),

  // 底部操作
  nextButton: document.querySelector("#nextButton"),
  resetButton: document.querySelector("#resetButton"),
  statsButton: document.querySelector("#statsButton"),

  // 面板
  searchPanel: document.querySelector("#searchPanel"),
  tagPanel: document.querySelector("#tagPanel"),
  statsPanel: document.querySelector("#statsPanel")
};

const deck = Array.isArray(window.FLASHCARD_DATA?.cards) ? window.FLASHCARD_DATA.cards : [];
let progress = loadProgress();
let session = loadSession();
let settings = loadSettings();
let activeMode = settings.mode || "subjective";
let selectedTags = settings.selectedTags || [];
let currentCard = null;
let isAnswerVisible = false;
let touchStartX = 0;
let touchStartY = 0;
let deferredInstallPrompt = null;

// 初始化
init();

function init() {
  // 初始化模块
  TagSystem.init(deck);
  SearchEngine.init();

  // 设置回调
  setupCallbacks();

  // 渲染界面
  renderModeButtons();
  renderTagFilter();

  // 绑定事件
  bindEvents();

  // 注册Service Worker
  registerServiceWorker();

  // 选择第一张卡片
  setCurrentCard(pickNextCard());

  // 渲染统计
  renderStats();
}

function setupCallbacks() {
  // 标签系统回调
  TagSystem.handleTagClick = (tag) => {
    toggleTagFilter(tag);
  };

  TagSystem.handleTagSelection = (checkbox) => {
    toggleTagFilter(checkbox.value);
  };

  TagSystem.clearTagFilter = () => {
    selectedTags = [];
    saveSettings();
    renderTagFilter();
    setCurrentCard(pickNextCard());
    renderStats();
  };

  TagSystem.removeTagFromCurrentCard = (tag) => {
    // 可以扩展：允许编辑卡片标签
    console.log('Remove tag:', tag);
  };

  // 搜索引擎回调
  SearchEngine.performSearch = (query) => {
    const results = SearchEngine.search(deck, query, {
      searchFields: ['question', 'answer', 'tags', 'chapter']
    });

    const resultsContainer = document.getElementById('searchResults');
    if (resultsContainer) {
      resultsContainer.innerHTML = SearchEngine.renderResults(results, query);
    }
  };

  SearchEngine.selectResult = (cardId) => {
    const card = deck.find(c => c.id === cardId);
    if (card) {
      setCurrentCard(card);
      SearchEngine.closeSearchPanel();
    }
  };
}

function bindEvents() {
  // 闪卡事件
  elements.flashcard.addEventListener("click", toggleAnswer);
  elements.flashcard.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleAnswer();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      nextCard();
    }
  });

  // 触摸事件
  elements.flashcard.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }, { passive: true });

  elements.flashcard.addEventListener("touchend", (event) => {
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      nextCard();
    }
  }, { passive: true });

  // 评分按钮
  elements.ratingButtons.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-score]");
    if (!button || !currentCard) return;
    rateCurrent(Number(button.dataset.score));
  });

  // 模式切换
  elements.subjectiveMode.addEventListener("click", () => switchMode("subjective"));
  elements.objectiveMode.addEventListener("click", () => switchMode("objective"));

  // 标签筛选
  elements.tagFilterButton.addEventListener("click", toggleTagPanel);

  // 操作按钮
  elements.cutButton.addEventListener("click", cutCurrentCard);
  elements.undoCutButton.addEventListener("click", undoLastCut);
  elements.nextButton.addEventListener("click", nextCard);
  elements.resetButton.addEventListener("click", resetProgress);
  elements.statsButton.addEventListener("click", toggleStatsPanel);
  elements.searchButton.addEventListener("click", () => SearchEngine.toggleSearchPanel());

  // PWA安装
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    elements.installButton.hidden = false;
  });

  elements.installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    elements.installButton.hidden = true;
  });
}

// ==================== 数据管理 ====================

function loadProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function loadSession() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "{}");
    if (parsed && Array.isArray(parsed.recentIds)) {
      return parsed;
    }
  } catch {}
  return { recentIds: [] };
}

function saveSession() {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveSettings() {
  settings.mode = activeMode;
  settings.selectedTags = selectedTags;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function getRecord(cardId) {
  return progress[cardId] || {
    score: 0,
    seen: 0,
    lastReviewed: 0,
    nextReview: 0,
    interval: 0,
    repetitions: 0,
    easeFactor: 2.5,
    retentionRate: 100,
    cut: false
  };
}

function recordAppearance(cardId) {
  if (!cardId) return;
  const record = getRecord(cardId);
  progress[cardId] = {
    ...record,
    seen: (record.seen || 0) + 1,
  };
  saveProgress();
}

function formatScore(record) {
  if (record.cut) return "已会";
  if (!record.score) return "未学习";

  const status = SpacedRepetition.getReviewStatus(record);
  const statusText = {
    new: '新',
    learning: '学习中',
    review: '待复习',
    mastered: '已掌握'
  }[status] || '';

  return `${record.score}分 · ${statusText}`;
}

// ==================== 卡片选择 ====================

function currentDeck(includeCut = false) {
  return deck.filter((card) => {
    if (card.mode !== activeMode) return false;
    if (!includeCut && getRecord(card.id).cut) return false;
    if (selectedTags.length > 0) {
      const cardTags = (card.tags || []).map(t => t.toLowerCase());
      const hasTag = selectedTags.some(tag => cardTags.includes(tag.toLowerCase()));
      if (!hasTag) return false;
    }
    return true;
  });
}

function pickNextCard(previousId) {
  const availableDeck = currentDeck();
  if (!availableDeck.length) return null;

  // 优先选择需要复习的卡片
  const priority = findPriorityCard(previousId);
  if (priority) return priority;

  // 使用间隔重复算法计算权重
  const candidates = availableDeck.filter((card) => card.id !== previousId);
  const pool = candidates.length ? candidates : availableDeck;

  const weighted = pool.map((card) => {
    const record = getRecord(card.id);
    return {
      card,
      weight: SpacedRepetition.calculateCardWeight(record)
    };
  });

  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let target = Math.random() * total;

  for (const item of weighted) {
    target -= item.weight;
    if (target <= 0) return item.card;
  }

  return weighted[weighted.length - 1].card;
}

function findPriorityCard(previousId) {
  const now = Date.now();
  let best = null;
  let bestPriority = -1;

  for (const card of currentDeck()) {
    if (card.id === previousId) continue;

    const record = getRecord(card.id);

    // 新卡片优先级高
    if (!record.lastReviewed) {
      const priority = 100;
      if (priority > bestPriority) {
        best = card;
        bestPriority = priority;
      }
      continue;
    }

    // 需要复习的卡片
    if (SpacedRepetition.needsReview(record)) {
      const daysOverdue = (now - record.nextReview) / (24 * 60 * 60 * 1000);
      const priority = 50 + Math.min(daysOverdue, 30);

      if (priority > bestPriority) {
        best = card;
        bestPriority = priority;
      }
    }
  }

  return best;
}

// ==================== 卡片渲染 ====================

function renderCard(answerVisible) {
  if (!currentCard) {
    renderEmptyCard();
    return;
  }

  const record = getRecord(currentCard.id);
  isAnswerVisible = answerVisible;

  // 元信息
  const meta = `${currentCard.number || ""} · ${currentCard.chapter} · ${currentCard.kind}`;
  elements.cardChapter.textContent = meta;
  elements.cardScore.textContent = formatScore(record);
  elements.answerChapter.textContent = meta;
  elements.answerScore.textContent = formatScore(record);

  // 标签
  elements.cardTags.innerHTML = TagSystem.renderCardTags(currentCard.tags, false);
  elements.answerTags.innerHTML = TagSystem.renderCardTags(currentCard.tags, false);

  // 内容（使用富文本渲染）
  RichText.renderTo(elements.questionText, currentCard.question, true);
  RichText.renderTo(elements.answerQuestionText, currentCard.question, true);
  RichText.renderTo(elements.answerText, currentCard.answer, true);

  // 间隔重复信息
  renderSpacedRepetitionInfo(record);

  // 卡片状态
  elements.flashcard.classList.toggle("is-flipped", answerVisible);
  elements.ratingPanel.hidden = !answerVisible;
  elements.cutButton.hidden = activeMode !== "objective";
  elements.undoCutButton.hidden = activeMode !== "objective" || !session.lastCutId;

  // 标记选中的评分
  markSelectedScore(record.score || 0);
}

function renderEmptyCard() {
  isAnswerVisible = false;
  const modeName = activeMode === "objective" ? "客观题" : "主观题";

  elements.cardChapter.textContent = modeName;
  elements.cardScore.textContent = "";
  elements.cardTags.innerHTML = "";
  elements.answerChapter.textContent = modeName;
  elements.answerScore.textContent = "";
  elements.answerTags.innerHTML = "";

  const emptyMessage = selectedTags.length > 0
    ? `没有匹配当前标签的${modeName}`
    : `${modeName}已全部标会`;

  elements.questionText.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
  elements.answerQuestionText.innerHTML = "";
  elements.answerText.innerHTML = activeMode === "objective"
    ? '<div class="empty-state">可点击撤销上一次标会，或重置进度。</div>'
    : "";

  elements.flashcard.classList.remove("is-flipped");
  elements.ratingPanel.hidden = activeMode !== "objective";
  elements.cutButton.hidden = true;
  elements.undoCutButton.hidden = activeMode !== "objective" || !session.lastCutId;

  // 清空间隔重复信息
  if (elements.retentionRate) elements.retentionRate.textContent = "--";
  if (elements.nextReview) elements.nextReview.textContent = "--";
}

function renderSpacedRepetitionInfo(record) {
  if (!elements.retentionRate || !elements.nextReview) return;

  if (record.lastReviewed) {
    elements.retentionRate.textContent = `${record.retentionRate || 0}%`;
    elements.retentionRate.style.color = SpacedRepetition.getRetentionColor(record.retentionRate || 0);
    elements.nextReview.textContent = SpacedRepetition.formatNextReview(record.nextReview);
  } else {
    elements.retentionRate.textContent = "新卡片";
    elements.retentionRate.style.color = "#2196f3";
    elements.nextReview.textContent = "待学习";
  }
}

function markSelectedScore(score) {
  for (const button of elements.ratingButtons.querySelectorAll("button[data-score]")) {
    button.classList.toggle("selected", Number(button.dataset.score) === score);
  }
}

// ==================== 用户交互 ====================

function toggleAnswer() {
  if (!currentCard) return;
  renderCard(!isAnswerVisible);
}

function rateCurrent(score) {
  if (!currentCard) return;

  const record = getRecord(currentCard.id);

  // 使用间隔重复算法计算下次复习
  const updatedRecord = SpacedRepetition.calculateNextReview(record, score);

  progress[currentCard.id] = {
    ...updatedRecord,
    score,
    lastReviewed: Date.now(),
  };

  saveProgress();
  rememberRecent(currentCard.id);
  renderStats();
  nextCard();
}

function nextCard() {
  setCurrentCard(pickNextCard(currentCard?.id));
}

function setCurrentCard(card) {
  currentCard = card;
  if (card) recordAppearance(card.id);

  elements.flashcard.classList.remove("is-entering");
  void elements.flashcard.offsetWidth;
  elements.flashcard.classList.add("is-entering");

  renderCard(false);
}

function rememberRecent(cardId) {
  session.recentIds = [cardId, ...(session.recentIds || []).filter((id) => id !== cardId)].slice(0, 16);
  saveSession();
}

// ==================== 标签系统 ====================

function toggleTagPanel() {
  const panel = elements.tagPanel;
  if (!panel) return;

  if (panel.classList.contains('active')) {
    panel.classList.remove('active');
  } else {
    panel.classList.add('active');
    renderTagFilter();
  }
}

function renderTagFilter() {
  const allTags = TagSystem.getAllTags();
  const container = document.getElementById('tagFilterContent');

  if (container) {
    container.innerHTML = TagSystem.renderTagFilter(allTags, selectedTags);
  }

  // 更新活跃标签显示
  renderActiveTags();
}

function renderActiveTags() {
  if (!elements.activeTags) return;

  if (selectedTags.length === 0) {
    elements.activeTags.innerHTML = '';
    return;
  }

  let html = '<div class="active-tags">';
  selectedTags.forEach(tag => {
    html += `<span class="active-tag">
      ${tag}
      <button onclick="toggleTagFilter('${tag}')">&times;</button>
    </span>`;
  });
  html += '</div>';

  elements.activeTags.innerHTML = html;
}

function toggleTagFilter(tag) {
  const normalizedTag = tag.toLowerCase();
  const index = selectedTags.findIndex(t => t.toLowerCase() === normalizedTag);

  if (index >= 0) {
    selectedTags.splice(index, 1);
  } else {
    selectedTags.push(tag);
  }

  saveSettings();
  renderTagFilter();
  setCurrentCard(pickNextCard());
  renderStats();
}

// ==================== 搜索功能 ====================

// 搜索功能由SearchEngine模块处理

// ==================== 统计和进度 ====================

function renderStats() {
  const activeDeck = currentDeck(true);
  const total = activeDeck.length || 1;
  const visibleDeck = currentDeck();
  const records = activeDeck.map((card) => getRecord(card.id));

  const studied = records.filter((record) => record.score > 0).length;
  const scoreSum = records.reduce((sum, record) => sum + Number(record.score || 0), 0);
  const mastery = Math.round((scoreSum / (total * 5)) * 100);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const today = records.filter((record) => (record.lastReviewed || 0) >= todayStart.getTime()).length;

  // 需要复习的数量
  const dueToday = records.filter((record) =>
    record.lastReviewed && SpacedRepetition.needsReview(record)
  ).length;

  elements.studiedCount.textContent = `${studied}/${activeDeck.length}`;
  elements.masteryPercent.textContent = `${mastery}%`;
  elements.todayCount.textContent = String(today);
  elements.progressBar.style.width = `${Math.round((studied / total) * 100)}%`;

  if (elements.dueCount) {
    elements.dueCount.textContent = String(dueToday);
  }

  const modeName = activeMode === "subjective" ? "主观题" : "客观题";
  elements.deckTitle.textContent = `${modeName} · ${visibleDeck.length}/${activeDeck.length} 张`;
}

function toggleStatsPanel() {
  const panel = elements.statsPanel;
  if (!panel) return;

  if (panel.classList.contains('active')) {
    panel.classList.remove('active');
  } else {
    panel.classList.add('active');
    renderStatsPanel();
  }
}

function renderStatsPanel() {
  const container = document.getElementById('statsContent');
  if (!container) return;

  const stats = SpacedRepetition.generateStats(progress);
  const tagStats = TagSystem.getStats();

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <h4>学习进度</h4>
        <div class="stat-items">
          <div class="stat-item">
            <span class="stat-value">${stats.total}</span>
            <span class="stat-label">总卡片</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${stats.newCards}</span>
            <span class="stat-label">新卡片</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${stats.learning}</span>
            <span class="stat-label">学习中</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${stats.mastered}</span>
            <span class="stat-label">已掌握</span>
          </div>
        </div>
      </div>

      <div class="stat-card">
        <h4>复习状态</h4>
        <div class="stat-items">
          <div class="stat-item">
            <span class="stat-value">${stats.dueToday}</span>
            <span class="stat-label">待复习</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${stats.averageRetention}%</span>
            <span class="stat-label">平均保留率</span>
          </div>
        </div>
      </div>

      <div class="stat-card">
        <h4>标签统计</h4>
        <div class="stat-items">
          <div class="stat-item">
            <span class="stat-value">${tagStats.totalTags}</span>
            <span class="stat-label">标签数</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${tagStats.averageTagsPerCard}</span>
            <span class="stat-label">平均标签/卡</span>
          </div>
        </div>
        <div class="popular-tags">
          <h5>热门标签</h5>
          ${tagStats.popularTags.map(tag =>
            `<span class="popular-tag">${tag.name} (${tag.count})</span>`
          ).join('')}
        </div>
      </div>
    </div>
  `;
}

// ==================== 模式切换 ====================

function renderModeButtons() {
  const subjectiveTotal = deck.filter((card) => card.mode === "subjective").length;
  const objectiveTotal = deck.filter((card) => card.mode === "objective").length;

  elements.subjectiveCount.textContent = `${subjectiveTotal} 张`;
  elements.objectiveCount.textContent = `${objectiveTotal} 张`;
  elements.subjectiveMode.classList.toggle("selected", activeMode === "subjective");
  elements.objectiveMode.classList.toggle("selected", activeMode === "objective");
}

function switchMode(mode) {
  if (activeMode === mode) return;
  activeMode = mode;
  saveSettings();
  renderModeButtons();
  setCurrentCard(pickNextCard());
  renderStats();
}

// ==================== 卡片操作 ====================

function cutCurrentCard(event) {
  event?.stopPropagation();
  if (!currentCard || activeMode !== "objective") return;

  const record = getRecord(currentCard.id);
  progress[currentCard.id] = {
    ...record,
    cut: true,
    lastReviewed: Date.now(),
  };

  session.lastCutId = currentCard.id;
  saveProgress();
  saveSession();
  nextCard();
  renderStats();
}

function undoLastCut(event) {
  event?.stopPropagation();
  if (!session.lastCutId) return;

  const record = getRecord(session.lastCutId);
  progress[session.lastCutId] = {
    ...record,
    cut: false,
  };

  session.lastCutId = null;
  saveProgress();
  saveSession();
  renderStats();

  if (!currentCard) setCurrentCard(pickNextCard());
  renderCard(isAnswerVisible);
}

function resetProgress() {
  const ok = window.confirm("确认清空本机学习记录？题库不会删除。");
  if (!ok) return;

  progress = {};
  session = { recentIds: [], lastCutId: null };
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(SESSION_KEY);

  setCurrentCard(pickNextCard());
  renderStats();
}

// ==================== Service Worker ====================

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
