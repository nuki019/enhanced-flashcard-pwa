# 智能闪卡学习系统 - 安装和使用指南

## 快速开始

### 方法一：直接打开使用

1. 下载整个 `enhanced-flashcard-pwa` 文件夹
2. 用浏览器打开 `index.html` 文件
3. 开始使用！

**注意**：直接打开文件时，Service Worker 功能可能不可用（离线功能）。建议使用方法二获得完整体验。

### 方法二：本地服务器运行（推荐）

使用 Python 启动本地服务器：

```bash
cd enhanced-flashcard-pwa
python -m http.server 8000
```

然后在浏览器中访问：`http://localhost:8000`

### 方法三：部署到 GitHub Pages

1. 创建 GitHub 仓库
2. 上传所有文件
3. 在仓库设置中启用 GitHub Pages
4. 访问 `https://yourusername.github.io/repository-name/`

## 添加到主屏幕

### iPhone/iPad (Safari)

1. 用 Safari 打开应用
2. 点击底部的"分享"按钮（方框+箭头图标）
3. 滚动找到"添加到主屏幕"
4. 点击"添加"

### Android (Chrome)

1. 用 Chrome 打开应用
2. 点击右上角的三个点菜单
3. 选择"添加到主屏幕"或"安装应用"
4. 按照提示完成安装

## 功能说明

### 1. 间隔重复算法

应用采用基于艾宾浩斯遗忘曲线的智能复习算法：

- **评分 1-2 分**：重新学习，短时间内再次出现
- **评分 3 分**：保持当前间隔
- **评分 4-5 分**：增加复习间隔

系统会自动计算：
- 保留率：预测你对内容的记忆程度
- 下次复习时间：智能安排最佳复习时机

### 2. 富文本支持

卡片内容支持 Markdown 格式：

```markdown
# 标题
## 二级标题

**粗体文本**
*斜体文本*

- 列表项1
- 列表项2

1. 有序列表1
2. 有序列表2

`行内代码`

```javascript
// 代码块
function hello() {
  console.log('Hello!');
}
```

| 表头1 | 表头2 |
|-------|-------|
| 内容1 | 内容2 |

![图片描述](https://example.com/image.jpg)
```

### 3. 标签系统

- 为卡片添加多个标签
- 按标签筛选卡片
- 查看标签云
- 多标签组合筛选

### 4. 搜索功能

- 全文搜索（题目、答案、标签、章节）
- 实时搜索结果
- 搜索历史记录
- 搜索结果高亮

## 自定义题库

### 题库格式

编辑 `data/cards.js` 文件，格式如下：

```javascript
window.FLASHCARD_DATA = {
  cards: [
    {
      id: "unique-id",           // 唯一标识符
      number: "001",             // 题号（可选）
      chapter: "第一章",          // 章节
      kind: "概念题",             // 题目类型
      mode: "subjective",        // subjective(主观) 或 objective(客观)
      tags: ["标签1", "标签2"],  // 标签数组
      question: "## 问题标题\n\n问题内容（支持Markdown）",
      answer: "## 答案\n\n答案内容（支持Markdown）"
    },
    // 更多卡片...
  ]
};
```

### 从 CSV 导入

如果你有 CSV 格式的题库，可以使用以下脚本转换：

```javascript
// 在浏览器控制台运行
function csvToCards(csvText) {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',');
  const cards = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length >= 3) {
      cards.push({
        id: `card-${i}`,
        number: values[0] || '',
        chapter: values[1] || '',
        kind: '概念题',
        mode: 'subjective',
        tags: values[4] ? values[4].split(';') : [],
        question: values[2] || '',
        answer: values[3] || ''
      });
    }
  }

  return { cards };
}
```

## 数据存储

所有学习数据都保存在浏览器的 localStorage 中：

- `xg-enhanced-flashcard-progress-v1`: 学习进度和间隔重复数据
- `xg-enhanced-flashcard-session-v1`: 当前会话数据
- `xg-enhanced-flashcard-settings-v1`: 用户设置
- `xg-flashcard-search-history`: 搜索历史

### 导出数据

在浏览器控制台运行：

```javascript
const data = {
  progress: JSON.parse(localStorage.getItem('xg-enhanced-flashcard-progress-v1')),
  settings: JSON.parse(localStorage.getItem('xg-enhanced-flashcard-settings-v1'))
};

const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'flashcard-backup.json';
a.click();
```

### 导入数据

```javascript
// 假设你有备份文件的内容
const backup = { /* ... */ };
localStorage.setItem('xg-enhanced-flashcard-progress-v1', JSON.stringify(backup.progress));
localStorage.setItem('xg-enhanced-flashcard-settings-v1', JSON.stringify(backup.settings));
location.reload();
```

## 键盘快捷键

- **空格/回车**: 翻转卡片
- **右箭头**: 下一张卡片
- **1-5**: 评分
- **Esc**: 关闭面板

## 浏览器兼容性

支持所有现代浏览器：
- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## 故障排除

### 问题：应用无法离线使用

**解决方案**：
- 确保通过 HTTPS 或 localhost 访问
- 清除浏览器缓存后重新加载
- 检查 Service Worker 是否注册成功（开发者工具 -> Application -> Service Workers）

### 问题：学习进度丢失

**解决方案**：
- 不要清除浏览器数据
- 定期导出备份
- 使用同一浏览器访问

### 问题：Markdown 不渲染

**解决方案**：
- 检查 Markdown 语法是否正确
- 确保代码块使用三个反引号
- 刷新页面重试

## 开发说明

### 项目结构

```
enhanced-flashcard-pwa/
├── index.html              # 应用入口
├── app.js                  # 主应用逻辑
├── spaced-repetition.js    # 间隔重复算法
├── richtext.js            # 富文本处理
├── tags.js                # 标签系统
├── search.js              # 搜索功能
├── styles.css             # 样式文件
├── sw.js                  # Service Worker
├── manifest.webmanifest   # PWA 配置
├── data/
│   └── cards.js           # 题库数据
├── assets/
│   └── icon.svg           # 应用图标
├── README.md              # 项目说明
├── SETUP.md               # 安装指南（本文件）
└── LICENSE                # 开源协议
```

### 技术栈

- 纯原生 HTML/CSS/JavaScript
- 无框架依赖
- PWA 技术
- LocalStorage 数据存储

### 扩展开发

如需添加新功能，可以：

1. 创建新的模块文件
2. 在 `index.html` 中引入
3. 在 `app.js` 中集成

## 软件著作权申请说明

本项目可作为软件著作权申请的材料，包含：

1. **源代码**：所有 `.js` 文件
2. **用户文档**：README.md 和 SETUP.md
3. **设计文档**：代码中的注释和文档
4. **功能说明**：见 README.md

### 建议的软著名称

- 智能闪卡学习系统
- 基于遗忘曲线的自适应学习平台
- 间隔重复闪卡复习软件

### 主要功能特点

1. 基于艾宾浩斯遗忘曲线的智能复习调度
2. 支持 Markdown 的富文本内容展示
3. 灵活的标签分类和筛选系统
4. 高效的全文搜索功能
5. PWA 支持，可离线使用

## 许可证

MIT License - 可自由使用和修改

## 致谢

基于 [xg-flashcards-pwa](https://github.com/nuki019/xg-flashcards-pwa) 增强开发

---

如有问题或建议，欢迎提 Issue 或 PR！
