# 安装和使用指南

## 怎么跑起来

### 最简单的方式

下载整个文件夹，双击打开 `index.html` 就行。

不过有个问题：直接打开文件的话，Service Worker 那套离线功能可能用不了。想要完整体验的话，建议用下面的方法。

### 本地服务器（推荐）

用Python起个本地服务器：

```bash
cd enhanced-flashcard-pwa
python -m http.server 8000
```

然后浏览器访问 `http://localhost:8000`

### 部署到GitHub Pages

1. 建个GitHub仓库
2. 把文件都传上去
3. 仓库设置里开启GitHub Pages
4. 访问 `https://你的用户名.github.io/仓库名/`

## 加到手机主屏幕

### iPhone/iPad

1. 用Safari打开
2. 点底部的分享按钮（方框带箭头那个）
3. 往下翻，找到"添加到主屏幕"
4. 点"添加"

### Android

1. 用Chrome打开
2. 点右上角三个点
3. 选"添加到主屏幕"或"安装应用"
4. 按提示来就行

## 功能介绍

### 评分和复习

每张卡片可以打1-5分：

- 1-2分：说明没记住，很快会再出现
- 3分：马马虎虎，保持当前间隔
- 4-5分：记住了，下次复习间隔拉长

系统会根据你的评分自动算出最佳复习时间，还会显示一个"保留率"指标，大概是预测你还记得多少。

### Markdown支持

卡片内容支持Markdown，常用的语法都能用：

- **粗体** 和 *斜体*
- `行内代码` 和代码块
- 表格
- 图片（通过URL）
- 列表（有序和无序）

### 标签

给卡片打标签，方便分类复习。比如可以把所有"算法"相关的卡片都打上"算法"标签，然后单独筛出来复习。

### 搜索

搜题目、答案、标签、章节都行。有搜索历史，重复搜同样的词不用重新打。

## 自定义题库

编辑 `data/cards.js` 文件，格式大概这样：

```javascript
window.FLASHCARD_DATA = {
  cards: [
    {
      id: "001",                    // 唯一ID
      number: "1",                  // 题号
      chapter: "第一章",            // 章节
      kind: "概念题",               // 题型
      mode: "subjective",           // subjective=主观, objective=客观
      tags: ["基础", "概念"],       // 标签
      question: "## 这是题目\n\n题目内容",
      answer: "## 这是答案\n\n答案内容"
    }
    // 继续加...
  ]
};
```

### 从CSV导入

如果你有CSV格式的题库，可以在浏览器控制台跑这个脚本转换：

```javascript
function csvToCards(csvText) {
  var lines = csvText.split("\n");
  var headers = lines[0].split(",");
  var cards = [];

  for (var i = 1; i < lines.length; i++) {
    var values = lines[i].split(",");
    if (values.length >= 3) {
      cards.push({
        id: "card-" + i,
        number: values[0] || "",
        chapter: values[1] || "",
        kind: "概念题",
        mode: "subjective",
        tags: values[4] ? values[4].split(";") : [],
        question: values[2] || "",
        answer: values[3] || ""
      });
    }
  }

  return { cards: cards };
}
```

## 数据存在哪

学习数据都存在浏览器的localStorage里：

- `xg-card-progress-v2`：学习进度
- `xg-card-session-v2`：当前会话
- `xg-card-settings-v2`：用户设置
- `xg-flashcard-search-history`：搜索历史

### 导出备份

在控制台跑这段代码：

```javascript
var data = {
  progress: JSON.parse(localStorage.getItem("xg-card-progress-v2")),
  settings: JSON.parse(localStorage.getItem("xg-card-settings-v2"))
};

var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
var url = URL.createObjectURL(blob);
var a = document.createElement("a");
a.href = url;
a.download = "flashcard-backup.json";
a.click();
```

### 恢复备份

```javascript
// 假设你有备份内容
var backup = { /* ... */ };
localStorage.setItem("xg-card-progress-v2", JSON.stringify(backup.progress));
localStorage.setItem("xg-card-settings-v2", JSON.stringify(backup.settings));
location.reload();
```

## 键盘操作

- 空格/回车：翻卡片
- 右箭头：下一张
- 1-5：评分
- Esc：关面板

## 浏览器要求

现代浏览器都行：

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## 常见问题

### 离线用不了

确保通过HTTPS或localhost访问。如果是直接打开文件，离线功能不支持。

### 进度丢了

别清浏览器数据。建议定期导出备份。

### Markdown没渲染

检查语法对不对，代码块要用三个反引号。实在不行刷新试试。

## 项目结构

```text
enhanced-flashcard-pwa/
├── index.html          # 入口
├── app.js              # 主逻辑
├── spaced-repetition.js # 算法
├── richtext.js         # Markdown渲染
├── tags.js             # 标签
├── search.js           # 搜索
├── styles.css          # 样式
├── sw.js               # Service Worker
├── manifest.webmanifest # PWA配置
├── data/
│   └── cards.js        # 题库
└── assets/
    └── icon.svg        # 图标
```

## 技术栈

纯原生HTML/CSS/JavaScript，没用任何框架。数据存在localStorage，支持PWA离线使用。

---

MIT License
