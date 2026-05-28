/**
 * 富文本处理模块
 * 支持Markdown渲染、代码高亮、图片、表格等
 */

const RichText = {
  // 代码语言映射
  LANGUAGES: {
    'javascript': 'JavaScript',
    'python': 'Python',
    'java': 'Java',
    'cpp': 'C++',
    'c': 'C',
    'html': 'HTML',
    'css': 'CSS',
    'sql': 'SQL',
    'bash': 'Bash',
    'json': 'JSON',
    'xml': 'XML',
    'markdown': 'Markdown'
  },

  /**
   * 渲染Markdown内容为HTML
   * @param {string} text - Markdown文本
   * @returns {string} HTML字符串
   */
  renderMarkdown(text) {
    if (!text) return '';

    let html = text;

    // 转义HTML特殊字符
    html = this.escapeHtml(html);

    // 代码块（多行）
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const language = lang || 'text';
      const highlighted = this.highlightCode(code.trim(), language);
      return `<pre class="code-block"><code class="language-${language}">${highlighted}</code></pre>`;
    });

    // 行内代码
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // 标题
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // 粗体和斜体
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // 删除线
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

    // 链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // 图片
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="content-image" loading="lazy">');

    // 无序列表
    html = html.replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // 有序列表
    html = html.replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>');

    // 表格
    html = this.renderTables(html);

    // 引用块
    html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');

    // 水平线
    html = html.replace(/^---$/gm, '<hr>');

    // 段落（连续两个换行）
    html = html.replace(/\n\n+/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // 清理空段落
    html = html.replace(/<p>\s*<\/p>/g, '');
    html = html.replace(/<p>\s*(<h[1-6]>)/g, '$1');
    html = html.replace(/(<\/h[1-6]>)\s*<\/p>/g, '$1');
    html = html.replace(/<p>\s*(<pre)/g, '$1');
    html = html.replace(/(<\/pre>)\s*<\/p>/g, '$1');
    html = html.replace(/<p>\s*(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)\s*<\/p>/g, '$1');
    html = html.replace(/<p>\s*(<blockquote>)/g, '$1');
    html = html.replace(/(<\/blockquote>)\s*<\/p>/g, '$1');
    html = html.replace(/<p>\s*(<hr>)/g, '$1');
    html = html.replace(/(<hr>)\s*<\/p>/g, '$1');

    return html;
  },

  /**
   * 渲染Markdown表格
   * @param {string} text - 包含表格的文本
   * @returns {string} 包含HTML表格的文本
   */
  renderTables(text) {
    const tableRegex = /\|(.+)\|\n\|[-|\s]+\|\n((?:\|.+\|\n?)+)/g;

    return text.replace(tableRegex, (match, header, body) => {
      const headers = header.split('|').map(h => h.trim()).filter(h => h);
      const rows = body.trim().split('\n').map(row =>
        row.split('|').map(cell => cell.trim()).filter(cell => cell)
      );

      let table = '<div class="table-container"><table>';
      table += '<thead><tr>';
      headers.forEach(h => {
        table += `<th>${h}</th>`;
      });
      table += '</tr></thead>';

      table += '<tbody>';
      rows.forEach(row => {
        table += '<tr>';
        row.forEach(cell => {
          table += `<td>${cell}</td>`;
        });
        table += '</tr>';
      });
      table += '</tbody></table></div>';

      return table;
    });
  },

  /**
   * 代码高亮（简化版本）
   * @param {string} code - 代码内容
   * @param {string} language - 编程语言
   * @returns {string} 高亮后的HTML
   */
  highlightCode(code, language) {
    // 简单的关键字高亮
    const keywords = {
      javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'async', 'await'],
      python: ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'import', 'from', 'return', 'True', 'False', 'None'],
      java: ['public', 'private', 'protected', 'class', 'void', 'int', 'String', 'if', 'else', 'for', 'while', 'return'],
      cpp: ['int', 'void', 'char', 'float', 'double', 'if', 'else', 'for', 'while', 'class', 'public', 'private'],
    };

    let highlighted = code;

    // 转义HTML
    highlighted = this.escapeHtml(highlighted);

    // 高亮字符串
    highlighted = highlighted.replace(/(["'])(?:(?!\1).)*\1/g, '<span class="string">$&</span>');

    // 高亮数字
    highlighted = highlighted.replace(/\b\d+\.?\d*\b/g, '<span class="number">$&</span>');

    // 高亮注释
    highlighted = highlighted.replace(/\/\/.*$/gm, '<span class="comment">$&</span>');
    highlighted = highlighted.replace(/#.*$/gm, '<span class="comment">$&</span>');

    // 高亮关键字
    const langKeywords = keywords[language] || [];
    langKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      highlighted = highlighted.replace(regex, `<span class="keyword">${keyword}</span>`);
    });

    return highlighted;
  },

  /**
   * 转义HTML特殊字符
   * @param {string} text - 原始文本
   * @returns {string} 转义后的文本
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * 渲染富文本内容到指定元素
   * @param {HTMLElement} element - 目标元素
   * @param {string} content - 内容（Markdown或HTML）
   * @param {boolean} isMarkdown - 是否是Markdown格式
   */
  renderTo(element, content, isMarkdown = true) {
    if (!element) return;

    if (isMarkdown) {
      element.innerHTML = this.renderMarkdown(content);
    } else {
      element.innerHTML = content;
    }

    // 为代码块添加复制按钮
    this.addCopyButtons(element);

    // 懒加载图片
    this.lazyLoadImages(element);
  },

  /**
   * 为代码块添加复制按钮
   * @param {HTMLElement} container - 容器元素
   */
  addCopyButtons(container) {
    const codeBlocks = container.querySelectorAll('.code-block');

    codeBlocks.forEach(block => {
      const button = document.createElement('button');
      button.className = 'copy-button';
      button.textContent = '复制';
      button.onclick = () => {
        const code = block.querySelector('code');
        navigator.clipboard.writeText(code.textContent).then(() => {
          button.textContent = '已复制';
          setTimeout(() => {
            button.textContent = '复制';
          }, 2000);
        });
      };
      block.style.position = 'relative';
      block.appendChild(button);
    });
  },

  /**
   * 图片懒加载
   * @param {HTMLElement} container - 容器元素
   */
  lazyLoadImages(container) {
    const images = container.querySelectorAll('img[data-src]');

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            observer.unobserve(img);
          }
        });
      });

      images.forEach(img => observer.observe(img));
    } else {
      // 降级处理
      images.forEach(img => {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      });
    }
  },

  /**
   * 搜索高亮
   * @param {string} text - 原始文本
   * @param {string} keyword - 搜索关键词
   * @returns {string} 高亮后的HTML
   */
  highlightSearch(text, keyword) {
    if (!keyword) return text;

    const regex = new RegExp(`(${this.escapeRegex(keyword)})`, 'gi');
    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
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
   * 截断文本
   * @param {string} text - 原始文本
   * @param {number} maxLength - 最大长度
   * @returns {string} 截断后的文本
   */
  truncate(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },

  /**
   * 提取纯文本（去除Markdown标记）
   * @param {string} markdown - Markdown文本
   * @returns {string} 纯文本
   */
  stripMarkdown(markdown) {
    if (!markdown) return '';

    return markdown
      .replace(/```[\s\S]*?```/g, '') // 代码块
      .replace(/`([^`]+)`/g, '$1') // 行内代码
      .replace(/!\[.*?\]\(.*?\)/g, '') // 图片
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 链接
      .replace(/[#*_~>`\-|]/g, '') // 标记符号
      .replace(/\n+/g, ' ') // 换行
      .trim();
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RichText;
}
