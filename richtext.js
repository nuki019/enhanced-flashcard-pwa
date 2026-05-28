/**
 * 富文本渲染模块
 * 自己写的Markdown解析器，功能不多但够用
 * 没用第三方库，主要是想练练手
 */

var RichText = (function() {
  "use strict";

  // 支持的编程语言，用于代码高亮
  // 只做了几个常用的，够用了
  var SUPPORTED_LANGS = {
    "javascript": "JavaScript",
    "js": "JavaScript",
    "python": "Python",
    "py": "Python",
    "java": "Java",
    "cpp": "C++",
    "c": "C",
    "html": "HTML",
    "css": "CSS",
    "sql": "SQL",
    "bash": "Bash",
    "shell": "Shell",
    "json": "JSON",
    "xml": "XML",
    "md": "Markdown"
  };

  /**
   * 把Markdown文本转成HTML
   * 这个函数写得比较长，主要是正则替换
   * 有些边界情况没处理好，但一般够用
   */
  function markdownToHtml(text) {
    if (!text) return "";

    var html = text;

    // 先转义HTML特殊字符，防止XSS
    html = escapeHtmlChars(html);

    // 多行代码块 ```lang\n代码\n```
    // 这个正则试了好几次才调对
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function(match, lang, code) {
      var language = lang || "text";
      var highlighted = highlightCodeBlock(code.trim(), language);
      return '<pre class="code-block"><code class="language-' + language + '">' + highlighted + '</code></pre>';
    });

    // 行内代码 `code`
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // 标题 h1-h3
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

    // 粗体斜体，顺序很重要
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // 删除线
    html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

    // 链接 [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // 图片 ![alt](url)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="content-image" loading="lazy">');

    // 无序列表 - item
    html = html.replace(/^\s*[-*]\s+(.+)$/gm, "<li>$1</li>");
    // 把连续的li包在ul里
    html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");

    // 有序列表 1. item
    html = html.replace(/^\s*\d+\.\s+(.+)$/gm, "<li>$1</li>");

    // 表格
    html = convertMarkdownTables(html);

    // 引用块 > text
    html = html.replace(/^>\s+(.+)$/gm, "<blockquote>$1</blockquote>");

    // 水平线
    html = html.replace(/^---$/gm, "<hr>");

    // 段落 - 两个换行算一段
    html = html.replace(/\n\n+/g, "</p><p>");
    html = "<p>" + html + "</p>";

    // 清理一些不该在p标签里的东西
    // 这段写得比较ugly，但是能用
    html = html.replace(/<p>\s*<\/p>/g, "");
    html = html.replace(/<p>\s*(<h[1-6]>)/g, "$1");
    html = html.replace(/(<\/h[1-6]>)\s*<\/p>/g, "$1");
    html = html.replace(/<p>\s*(<pre)/g, "$1");
    html = html.replace(/(<\/pre>)\s*<\/p>/g, "$1");
    html = html.replace(/<p>\s*(<ul>)/g, "$1");
    html = html.replace(/(<\/ul>)\s*<\/p>/g, "$1");
    html = html.replace(/<p>\s*(<blockquote>)/g, "$1");
    html = html.replace(/(<\/blockquote>)\s*<\/p>/g, "$1");
    html = html.replace(/<p>\s*(<hr>)/g, "$1");
    html = html.replace(/(<hr>)\s*<\/p>/g, "$1");

    return html;
  }

  /**
   * 转换Markdown表格
   * 支持简单的表格语法
   */
  function convertMarkdownTables(text) {
    // 匹配表格：表头行 | 分隔行 | 数据行
    var tablePattern = /\|(.+)\|\n\|[-|\s]+\|\n((?:\|.+\|\n?)+)/g;

    return text.replace(tablePattern, function(match, headerLine, bodyLines) {
      // 解析表头
      var headers = headerLine.split("|");
      var cleanHeaders = [];
      var i = 0;
      while (i < headers.length) {
        var h = headers[i].trim();
        if (h) cleanHeaders.push(h);
        i++;
      }

      // 解析数据行
      var rows = [];
      var lines = bodyLines.trim().split("\n");
      var lineIdx = 0;
      while (lineIdx < lines.length) {
        var cells = lines[lineIdx].split("|");
        var cleanCells = [];
        var cellIdx = 0;
        while (cellIdx < cells.length) {
          var c = cells[cellIdx].trim();
          if (c) cleanCells.push(c);
          cellIdx++;
        }
        if (cleanCells.length > 0) rows.push(cleanCells);
        lineIdx++;
      }

      // 拼HTML表格
      var result = '<div class="table-container"><table>';

      // thead
      result += "<thead><tr>";
      var hi = 0;
      while (hi < cleanHeaders.length) {
        result += "<th>" + cleanHeaders[hi] + "</th>";
        hi++;
      }
      result += "</tr></thead>";

      // tbody
      result += "<tbody>";
      var ri = 0;
      while (ri < rows.length) {
        result += "<tr>";
        var ci = 0;
        while (ci < rows[ri].length) {
          result += "<td>" + rows[ri][ci] + "</td>";
          ci++;
        }
        result += "</tr>";
        ri++;
      }
      result += "</tbody></table></div>";

      return result;
    });
  }

  /**
   * 简单的代码高亮
   * 只处理关键字、字符串、数字、注释
   * 没用词法分析器，就是正则替换
   */
  function highlightCodeBlock(code, language) {
    var KEYWORDS_BY_LANG = {
      javascript: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "class", "import", "export", "from", "async", "await", "this", "new", "try", "catch", "throw"],
      python: ["def", "class", "if", "elif", "else", "for", "while", "import", "from", "return", "True", "False", "None", "try", "except", "raise", "with", "as"],
      java: ["public", "private", "protected", "class", "void", "int", "String", "if", "else", "for", "while", "return", "new", "try", "catch", "throws", "static", "final"],
      cpp: ["int", "void", "char", "float", "double", "if", "else", "for", "while", "class", "public", "private", "return", "new", "try", "catch", "throw", "include"]
    };

    var highlighted = code;

    // 先转义HTML
    highlighted = escapeHtmlChars(highlighted);

    // 高亮字符串（单引号和双引号）
    highlighted = highlighted.replace(/(["'])(?:(?!\1).)*\1/g, '<span class="string">$&</span>');

    // 高亮数字
    highlighted = highlighted.replace(/\b\d+\.?\d*\b/g, '<span class="number">$&</span>');

    // 高亮注释
    // 单行注释 // 和 #
    highlighted = highlighted.replace(/\/\/.*$/gm, '<span class="comment">$&</span>');
    highlighted = highlighted.replace(/#.*$/gm, '<span class="comment">$&</span>');

    // 高亮关键字
    var keywords = KEYWORDS_BY_LANG[language] || [];
    var kwIdx = 0;
    while (kwIdx < keywords.length) {
      var kw = keywords[kwIdx];
      var kwRegex = new RegExp("\\b" + kw + "\\b", "g");
      highlighted = highlighted.replace(kwRegex, '<span class="keyword">' + kw + "</span>");
      kwIdx++;
    }

    return highlighted;
  }

  /**
   * 转义HTML特殊字符
   * 防止XSS注入
   */
  function escapeHtmlChars(str) {
    // 用DOM API来转义，比手动replace靠谱
    var tempDiv = document.createElement("div");
    tempDiv.textContent = str;
    return tempDiv.innerHTML;
  }

  /**
   * 把内容渲染到指定DOM元素
   * 自动处理Markdown和HTML两种格式
   */
  function renderInto(element, content, isMarkdown) {
    if (!element) return;

    // 默认当Markdown处理
    if (isMarkdown === undefined) isMarkdown = true;

    if (isMarkdown) {
      element.innerHTML = markdownToHtml(content);
    } else {
      element.innerHTML = content;
    }

    // 给代码块加复制按钮
    addCopyButtonsToCode(element);

    // 图片懒加载
    setupLazyImages(element);
  }

  /**
   * 给代码块添加复制按钮
   * 这个功能挺实用的
   */
  function addCopyButtonsToCode(container) {
    var blocks = container.querySelectorAll(".code-block");
    var blockIdx = 0;
    while (blockIdx < blocks.length) {
      var block = blocks[blockIdx];

      // 创建复制按钮
      var btn = document.createElement("button");
      btn.className = "copy-button";
      btn.textContent = "复制";

      // 用闭包保存引用
      (function(codeBlock, copyBtn) {
        copyBtn.onclick = function() {
          var codeEl = codeBlock.querySelector("code");
          if (navigator.clipboard) {
            navigator.clipboard.writeText(codeEl.textContent).then(function() {
              copyBtn.textContent = "已复制!";
              setTimeout(function() {
                copyBtn.textContent = "复制";
              }, 2000);
            });
          }
        };
      })(block, btn);

      block.style.position = "relative";
      block.appendChild(btn);
      blockIdx++;
    }
  }

  /**
   * 图片懒加载
   * 用IntersectionObserver实现
   */
  function setupLazyImages(container) {
    var images = container.querySelectorAll("img[data-src]");

    // 不支持IntersectionObserver的浏览器直接加载
    if (!("IntersectionObserver" in window)) {
      var i = 0;
      while (i < images.length) {
        images[i].src = images[i].dataset.src;
        images[i].removeAttribute("data-src");
        i++;
      }
      return;
    }

    var observer = new IntersectionObserver(function(entries) {
      var j = 0;
      while (j < entries.length) {
        if (entries[j].isIntersecting) {
          var img = entries[j].target;
          img.src = img.dataset.src;
          img.removeAttribute("data-src");
          observer.unobserve(img);
        }
        j++;
      }
    });

    var k = 0;
    while (k < images.length) {
      observer.observe(images[k]);
      k++;
    }
  }

  /**
   * 搜索关键词高亮
   * 在文本中高亮显示搜索词
   */
  function highlightSearchTerm(text, keyword) {
    if (!keyword || !text) return text;

    // 转义正则特殊字符
    var escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var regex = new RegExp("(" + escaped + ")", "gi");
    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  /**
   * 截断文本
   * 超过maxLength就加省略号
   */
  function truncateText(text, maxLength) {
    if (!maxLength) maxLength = 100;
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }

  /**
   * 去掉Markdown标记，只留纯文本
   * 用于搜索和预览
   */
  function stripMarkdownFormatting(markdown) {
    if (!markdown) return "";

    var result = markdown;
    result = result.replace(/```[\s\S]*?```/g, ""); // 代码块
    result = result.replace(/`([^`]+)`/g, "$1");     // 行内代码
    result = result.replace(/!\[.*?\]\(.*?\)/g, "");  // 图片
    result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // 链接
    result = result.replace(/[#*_~>`\-|]/g, "");      // 标记符号
    result = result.replace(/\n+/g, " ");              // 换行变空格
    result = result.trim();
    return result;
  }

  // 公开接口
  return {
    LANGUAGES: SUPPORTED_LANGS,
    renderMarkdown: markdownToHtml,
    renderTables: convertMarkdownTables,
    highlightCode: highlightCodeBlock,
    escapeHtml: escapeHtmlChars,
    renderTo: renderInto,
    highlightSearch: highlightSearchTerm,
    truncate: truncateText,
    stripMarkdown: stripMarkdownFormatting
  };
})();

// 兼容Node.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = RichText;
}
