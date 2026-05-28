# 智能闪卡学习系统

基于艾宾浩斯遗忘曲线的智能闪卡学习应用，支持间隔重复、富文本内容、标签管理和全文搜索。

## 核心功能

### 1. 间隔重复算法
- 实现艾宾浩斯遗忘曲线算法
- 根据用户掌握情况自动安排复习时间
- 智能调度：掌握度低的内容更频繁出现
- 复习提醒：标记需要复习的卡片

### 2. 富文本支持
- 支持Markdown格式内容
- 代码高亮显示
- 图片展示（URL方式）
- 表格支持
- 数学公式支持

### 3. 标签系统
- 为卡片添加自定义标签
- 按标签筛选卡片
- 标签云展示
- 多标签组合筛选

### 4. 搜索功能
- 全文搜索（题目+答案）
- 实时搜索结果
- 搜索关键词高亮
- 搜索历史记录

## 技术特点

- **PWA支持**: 离线使用，可安装到桌面
- **本地存储**: 学习数据保存在本地，保护隐私
- **响应式设计**: 完美适配手机和桌面
- **轻量级**: 无框架依赖，加载快速

## 文件结构

```
enhanced-flashcard-pwa/
├── index.html          # 应用入口
├── app.js              # 核心应用逻辑
├── spaced-repetition.js # 间隔重复算法
├── richtext.js         # 富文本处理
├── tags.js             # 标签系统
├── search.js           # 搜索功能
├── styles.css          # 样式文件
├── manifest.webmanifest # PWA配置
├── sw.js               # Service Worker
├── data/
│   └── cards.js        # 题库数据
└── assets/
    └── icon-*.png      # 应用图标
```

## 使用方法

1. 直接打开 `index.html` 即可使用
2. 添加到手机主屏幕获得最佳体验
3. 支持离线使用

## 题库格式

```javascript
{
  id: "unique-id",
  question: "问题内容（支持Markdown）",
  answer: "答案内容（支持Markdown）",
  mode: "subjective" | "objective",
  tags: ["标签1", "标签2"],
  chapter: "章节",
  number: "题号"
}
```

## 间隔重复算法

采用改进的SM-2算法：
- 评分1-2分：重新学习
- 评分3分：保持间隔
- 评分4-5分：增加间隔
- 间隔时间：1天 → 2天 → 4天 → 8天 → 16天 → 32天...

## License

MIT License

---

基于 [xg-flashcards-pwa](https://github.com/nuki019/xg-flashcards-pwa) 增强开发
