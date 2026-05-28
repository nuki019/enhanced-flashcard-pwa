// 示例题库数据
// 支持富文本（Markdown格式）和标签

window.FLASHCARD_DATA = {
  cards: [
    {
      id: "demo-001",
      number: "D001",
      chapter: "JavaScript基础",
      kind: "概念题",
      mode: "subjective",
      tags: ["JavaScript", "基础", "变量"],
      question: "## 什么是变量提升（Hoisting）？\n\n请解释JavaScript中的变量提升现象。",
      answer: "变量提升是JavaScript的一种机制，指**变量和函数声明**在代码执行前被移动到其作用域顶部。\n\n### 示例：\n```javascript\nconsole.log(name); // 输出: undefined\nvar name = 'John';\nconsole.log(name); // 输出: 'John'\n```\n\n### 注意事项：\n- `var` 声明会被提升，但赋值不会\n- `let` 和 `const` 不会提升（暂时性死区）\n- 函数声明会被完整提升"
    },
    {
      id: "demo-002",
      number: "D002",
      chapter: "JavaScript基础",
      kind: "代码题",
      mode: "subjective",
      tags: ["JavaScript", "闭包", "高级"],
      question: "## 什么是闭包（Closure）？\n\n请解释闭包的概念，并给出一个实际应用示例。",
      answer: "闭包是指一个**函数能够访问其外部函数作用域中的变量**，即使外部函数已经执行完毕。\n\n### 示例：\n```javascript\nfunction createCounter() {\n  let count = 0;\n  return {\n    increment: function() {\n      count++;\n      return count;\n    },\n    getCount: function() {\n      return count;\n    }\n  };\n}\n\nconst counter = createCounter();\nconsole.log(counter.increment()); // 1\nconsole.log(counter.increment()); // 2\nconsole.log(counter.getCount()); // 2\n```\n\n### 应用场景：\n- 数据封装和私有变量\n- 函数工厂\n- 回调函数\n- 模块模式"
    },
    {
      id: "demo-003",
      number: "D003",
      chapter: "CSS布局",
      kind: "概念题",
      mode: "subjective",
      tags: ["CSS", "Flexbox", "布局"],
      question: "## Flexbox布局\n\n解释Flexbox的主要属性和使用场景。",
      answer: "Flexbox是CSS3中的一种**一维布局模型**，用于在容器中对齐和分布元素。\n\n### 容器属性：\n```css\n.container {\n  display: flex;\n  flex-direction: row | column;\n  justify-content: flex-start | center | space-between;\n  align-items: stretch | center | flex-start;\n  flex-wrap: nowrap | wrap;\n}\n```\n\n### 项目属性：\n```css\n.item {\n  flex-grow: 1;\n  flex-shrink: 0;\n  flex-basis: auto;\n  order: 0;\n  align-self: auto;\n}\n```\n\n### 使用场景：\n- 导航栏\n- 卡片布局\n- 居中对齐\n- 等高布局\n- 响应式设计"
    },
    {
      id: "demo-004",
      number: "D004",
      chapter: "JavaScript基础",
      kind: "选择题",
      mode: "objective",
      tags: ["JavaScript", "类型", "基础"],
      question: "`typeof null` 的返回值是什么？\n\nA. 'null'\nB. 'undefined'\nC. 'object'\nD. 'boolean'",
      answer: "**答案：C. 'object'**\n\n这是JavaScript的一个历史遗留bug。`null` 被错误地判断为对象类型。\n\n```javascript\nconsole.log(typeof null); // 'object'\nconsole.log(null === null); // true\nconsole.log(typeof undefined); // 'undefined'\n```\n\n### 注意：\n在ES6中，曾提议修改此行为，但为了向后兼容被拒绝。"
    },
    {
      id: "demo-005",
      number: "D005",
      chapter: "Python基础",
      kind: "概念题",
      mode: "subjective",
      tags: ["Python", "装饰器", "高级"],
      question: "## Python装饰器\n\n解释Python装饰器的概念和工作原理。",
      answer: "装饰器是一种**设计模式**，用于在不修改原函数代码的情况下扩展函数功能。\n\n### 基本语法：\n```python\ndef my_decorator(func):\n    def wrapper(*args, **kwargs):\n        print('函数执行前')\n        result = func(*args, **kwargs)\n        print('函数执行后')\n        return result\n    return wrapper\n\n@my_decorator\ndef say_hello():\n    print('Hello!')\n\nsay_hello()\n```\n\n### 带参数的装饰器：\n```python\ndef repeat(times):\n    def decorator(func):\n        def wrapper(*args, **kwargs):\n            for _ in range(times):\n                result = func(*args, **kwargs)\n            return result\n        return wrapper\n    return decorator\n\n@repeat(times=3)\ndef greet():\n    print('Hi!')\n```\n\n### 应用场景：\n- 日志记录\n- 权限验证\n- 性能测量\n- 缓存"
    },
    {
      id: "demo-006",
      number: "D006",
      chapter: "数据库",
      kind: "概念题",
      mode: "subjective",
      tags: ["SQL", "数据库", "索引"],
      question: "## 数据库索引\n\n解释数据库索引的作用和类型。",
      answer: "索引是用于**加速数据库查询**的数据结构。\n\n### 类型：\n| 类型 | 描述 | 适用场景 |\n|------|------|----------|\n| B-Tree | 平衡树结构 | 等值查询、范围查询 |\n| Hash | 哈希表 | 等值查询 |\n| Full-Text | 全文索引 | 文本搜索 |\n| Spatial | 空间索引 | 地理位置查询 |\n\n### 创建索引：\n```sql\n-- 单列索引\nCREATE INDEX idx_name ON users(name);\n\n-- 复合索引\nCREATE INDEX idx_name_age ON users(name, age);\n\n-- 唯一索引\nCREATE UNIQUE INDEX idx_email ON users(email);\n```\n\n### 注意事项：\n- 索引会占用存储空间\n- 过多索引会降低写入性能\n- 选择合适的索引列很重要"
    },
    {
      id: "demo-007",
      number: "D007",
      chapter: "网络",
      kind: "选择题",
      mode: "objective",
      tags: ["HTTP", "网络", "状态码"],
      question: "HTTP状态码 `404` 表示什么？\n\nA. 服务器错误\nB. 未授权\nC. 资源未找到\nD. 请求成功",
      answer: "**答案：C. 资源未找到**\n\nHTTP 404状态码表示服务器无法找到请求的资源。\n\n### 常见HTTP状态码：\n- `200` OK - 请求成功\n- `301` Moved Permanently - 永久重定向\n- `400` Bad Request - 请求错误\n- `401` Unauthorized - 未授权\n- `403` Forbidden - 禁止访问\n- `404` Not Found - 未找到\n- `500` Internal Server Error - 服务器错误"
    },
    {
      id: "demo-008",
      number: "D008",
      chapter: "算法",
      kind: "代码题",
      mode: "subjective",
      tags: ["算法", "排序", "JavaScript"],
      question: "## 快速排序\n\n实现快速排序算法，并解释其时间复杂度。",
      answer: "快速排序是一种**分治算法**，通过选择基准元素将数组分为两部分。\n\n### JavaScript实现：\n```javascript\nfunction quickSort(arr) {\n  if (arr.length <= 1) return arr;\n\n  const pivot = arr[Math.floor(arr.length / 2)];\n  const left = arr.filter(x => x < pivot);\n  const middle = arr.filter(x => x === pivot);\n  const right = arr.filter(x => x > pivot);\n\n  return [...quickSort(left), ...middle, ...quickSort(right)];\n}\n\nconsole.log(quickSort([3, 6, 8, 10, 1, 2, 1]));\n// 输出: [1, 1, 2, 3, 6, 8, 10]\n```\n\n### 时间复杂度：\n| 情况 | 复杂度 |\n|------|--------|\n| 最佳 | O(n log n) |\n| 平均 | O(n log n) |\n| 最差 | O(n²) |\n\n### 空间复杂度：O(log n)"
    }
  ]
};
