import MarkdownIt from 'markdown-it'
import container from 'markdown-it-container'
import footnote from 'markdown-it-footnote'
import taskLists from 'markdown-it-task-lists'
import { full as emoji } from 'markdown-it-emoji'
import hljs from 'highlight.js'

/**
 * 创建并配置 markdown-it 渲染器实例
 * @param {Object} [options={}] - 可选的覆盖配置
 * @returns {MarkdownIt} 配置好的 markdown-it 实例
 */
function createMarkdownRenderer(options = {}) {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    // 代码块高亮：使用 highlight.js
    highlight(str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return (
            '<pre class="hljs"><code>' +
            hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
            '</code></pre>'
          )
        } catch (_) {
          // highlight.js 高亮失败时回退到纯文本
        }
      }
      // 未指定语言或语言不被支持时，尝试自动检测
      if (!lang) {
        try {
          const result = hljs.highlightAuto(str)
          if (result.language) {
            return (
              '<pre class="hljs"><code>' +
              result.value +
              '</code></pre>'
            )
          }
        } catch (_) {
          // 自动检测失败时回退
        }
      }
      // 最终回退：转义后包裹在 pre/code 标签中
      return (
        '<pre class="hljs"><code>' +
        md.utils.escapeHtml(str) +
        '</code></pre>'
      )
    },
    ...options
  })

  configurePlugins(md)

  return md
}

/**
 * 配置 markdown-it 扩展插件
 * @param {MarkdownIt} md - markdown-it 实例
 */
function configurePlugins(md) {
  // 自定义容器插件（提示框、警告框等）
  const containerTypes = [
    { name: 'tip', label: '提示', icon: '💡' },
    { name: 'warning', label: '警告', icon: '⚠️' },
    { name: 'danger', label: '危险', icon: '🔴' },
    { name: 'info', label: '信息', icon: 'ℹ️' },
    { name: 'note', label: '备注', icon: '📝' }
  ]

  containerTypes.forEach(({ name, label, icon }) => {
    md.use(container, name, {
      render(tokens, idx) {
        const token = tokens[idx]
        // 获取容器内附加标题（如 ::: tip 标题文字）
        const info = token.info.trim().slice(name.length).trim()
        const title = info || label

        if (token.nesting === 1) {
          // 开启标签
          return `<div class="custom-container custom-container-${name}">\n` +
            `<p class="custom-container-title">${icon} ${title}</p>\n`
        } else {
          // 关闭标签
          return '</div>\n'
        }
      }
    })
  })

  // 脚注插件
  md.use(footnote)

  // 任务列表插件
  md.use(taskLists)

  // 表情符号插件
  md.use(emoji)

  // 链接处理：外部链接新窗口打开
  configureLinkTarget(md)
}

/**
 * 配置链接渲染规则，使外部链接在新窗口中打开
 * @param {MarkdownIt} md - markdown-it 实例
 */
function configureLinkTarget(md) {
  // 保存原始的链接渲染规则
  const defaultRender =
    md.renderer.rules.link_open ||
    function (tokens, idx, options, _env, self) {
      return self.renderToken(tokens, idx, options)
    }

  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    const href = tokens[idx].attrGet('href')
    // 判断是否为外部链接（以 http:// 或 https:// 开头）
    if (href && /^https?:\/\//.test(href)) {
      tokens[idx].attrSet('target', '_blank')
      tokens[idx].attrSet('rel', 'noopener noreferrer')
    }
    return defaultRender(tokens, idx, options, env, self)
  }
}

// 创建默认的渲染器实例（单例模式，避免重复创建）
const md = createMarkdownRenderer()

/**
 * 渲染 Markdown 文本为 HTML
 * @param {string} source - Markdown 源文本
 * @param {Object} [env={}] - 渲染环境对象（可传递给插件）
 * @returns {string} 渲染后的 HTML 字符串
 */
export function renderMarkdown(source, env = {}) {
  if (!source || typeof source !== 'string') {
    return ''
  }
  return md.render(source, env)
}

/**
 * 渲染行内 Markdown 文本为 HTML（不包裹 <p> 标签）
 * @param {string} source - Markdown 行内源文本
 * @param {Object} [env={}] - 渲染环境对象
 * @returns {string} 渲染后的 HTML 字符串
 */
export function renderInline(source, env = {}) {
  if (!source || typeof source !== 'string') {
    return ''
  }
  return md.renderInline(source, env)
}

/**
 * 获取底层的 markdown-it 实例（用于高级自定义场景）
 * @returns {MarkdownIt} markdown-it 实例
 */
export function getMarkdownInstance() {
  return md
}

export default {
  renderMarkdown,
  renderInline,
  getMarkdownInstance
}
