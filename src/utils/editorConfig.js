/**
 * CodeMirror 编辑器配置模块
 * 定义编辑器扩展、快捷键绑定和主题配置
 */

import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, highlightActiveLine, rectangularSelection, crosshairCursor } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import { syntaxHighlighting, indentOnInput, bracketMatching, foldGutter, foldKeymap, defaultHighlightStyle, LanguageSupport } from '@codemirror/language'
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { linter, lintKeymap } from '@codemirror/lint'

/**
 * 搜索功能快捷键映射
 * 注意：@codemirror/search 包需要单独安装
 * 安装后可取消注释以下导入和配置
 */
const searchKeymap = []
// 安装 @codemirror/search 后取消注释：
// import { searchKeymap as cmSearchKeymap, highlightSelectionMatches } from '@codemirror/search'
// const searchKeymap = cmSearchKeymap
// baseExtensions 中添加 highlightSelectionMatches()

/**
 * Markdown 格式化快捷键定义
 * 支持 Ctrl+B 加粗、Ctrl+I 斜体、Ctrl+K 插入链接等
 */
const markdownKeymap = keymap.of([
  // Ctrl+B - 加粗
  keymap.of([{
    key: 'Mod-b',
    run: (view) => {
      return wrapSelection(view, '**', '**')
    },
    preventDefault: true
  }]),

  // Ctrl+I - 斜体
  keymap.of([{
    key: 'Mod-i',
    run: (view) => {
      return wrapSelection(view, '*', '*')
    },
    preventDefault: true
  }]),

  // Ctrl+K - 插入链接
  keymap.of([{
    key: 'Mod-k',
    run: (view) => {
      return insertLink(view)
    },
    preventDefault: true
  }]),

  // Ctrl+Shift+K - 插入代码块
  keymap.of([{
    key: 'Mod-Shift-k',
    run: (view) => {
      return wrapSelection(view, '`', '`')
    },
    preventDefault: true
  }]),

  // Ctrl+Shift+M - 插入多行代码块
  keymap.of([{
    key: 'Mod-Shift-m',
    run: (view) => {
      return insertCodeBlock(view)
    },
    preventDefault: true
  }]),

  // Ctrl+H - 插入标题
  keymap.of([{
    key: 'Mod-h',
    run: (view) => {
      return insertHeading(view)
    },
    preventDefault: true
  }]),

  // Ctrl+Shift+H - 插入二级标题
  keymap.of([{
    key: 'Mod-Shift-h',
    run: (view) => {
      return insertHeading(view, 2)
    },
    preventDefault: true
  }]),

  // Ctrl+L - 插入无序列表
  keymap.of([{
    key: 'Mod-l',
    run: (view) => {
      return prependLine(view, '- ')
    },
    preventDefault: true
  }]),

  // Ctrl+Shift+L - 插入有序列表
  keymap.of([{
    key: 'Mod-Shift-l',
    run: (view) => {
      return prependLine(view, '1. ')
    },
    preventDefault: true
  }]),

  // Ctrl+Shift+C - 插入任务列表
  keymap.of([{
    key: 'Mod-Shift-c',
    run: (view) => {
      return prependLine(view, '- [ ] ')
    },
    preventDefault: true
  }]),

  // Ctrl+/ - 插入分割线
  keymap.of([{
    key: 'Mod-/',
    run: (view) => {
      return insertHorizontalRule(view)
    },
    preventDefault: true
  }]),

  // Ctrl+Shift+Q - 引用块
  keymap.of([{
    key: 'Mod-Shift-q',
    run: (view) => {
      return prependLine(view, '> ')
    },
    preventDefault: true
  }]),

  // Ctrl+Shift+T - 插入表格
  keymap.of([{
    key: 'Mod-Shift-t',
    run: (view) => {
      return insertTable(view)
    },
    preventDefault: true
  }])
].flat())

/**
 * 包裹选中文本 - 在选中文本前后添加指定字符
 * @param {EditorView} view - 编辑器视图实例
 * @param {string} before - 前缀字符串
 * @param {string} after - 后缀字符串
 * @returns {boolean} 是否成功执行
 */
function wrapSelection(view, before, after) {
  const { state } = view
  const { selection } = state

  if (selection.ranges.some(r => r.empty)) {
    // 没有选中文本时，插入前后缀并将光标放在中间
    const pos = selection.main.head
    const transaction = state.update({
      changes: {
        from: pos,
        to: pos,
        insert: before + after
      },
      selection: {
        anchor: pos + before.length,
        head: pos + before.length
      }
    })
    view.dispatch(transaction)
    return true
  }

  // 有选中文本时，包裹选中内容
  const transaction = state.changeByRange(range => {
    const text = state.sliceDoc(range.from, range.to)
    // 检查是否已经包裹了相同的前后缀（切换效果）
    const beforeText = state.sliceDoc(range.from - before.length, range.from)
    const afterText = state.sliceDoc(range.to, range.to + after.length)

    if (beforeText === before && afterText === after) {
      // 移除包裹
      return {
        changes: [
          { from: range.from - before.length, to: range.from, insert: '' },
          { from: range.to, to: range.to + after.length, insert: '' }
        ],
        range: { anchor: range.from - before.length, head: range.to - before.length }
      }
    }

    return {
      changes: [
        { from: range.from, to: range.from, insert: before },
        { from: range.to, to: range.to, insert: after }
      ],
      range: { anchor: range.from, head: range.to + before.length + after.length }
    }
  })

  view.dispatch(transaction)
  return true
}

/**
 * 插入链接 - 将选中文本转为链接格式
 * @param {EditorView} view - 编辑器视图实例
 * @returns {boolean} 是否成功执行
 */
function insertLink(view) {
  const { state } = view
  const { selection } = state
  const range = selection.main

  if (range.empty) {
    // 没有选中文本，插入链接模板
    const pos = range.head
    const template = '[链接文本](url)'
    view.dispatch(state.update({
      changes: { from: pos, to: pos, insert: template },
      selection: { anchor: pos + 1, head: pos + 5 } // 选中"链接文本"
    }))
  } else {
    // 有选中文本，将选中文本作为链接文本
    const text = state.sliceDoc(range.from, range.to)
    const newText = `[${text}](url)`
    view.dispatch(state.update({
      changes: { from: range.from, to: range.to, insert: newText },
      selection: { anchor: range.from + text.length + 3, head: range.from + text.length + 6 } // 选中"url"
    }))
  }
  return true
}

/**
 * 插入代码块
 * @param {EditorView} view - 编辑器视图实例
 * @returns {boolean} 是否成功执行
 */
function insertCodeBlock(view) {
  const { state } = view
  const pos = state.selection.main.head
  const line = state.doc.lineAt(pos)
  const insertText = '\n```\n\n```\n'
  const insertPos = line.to

  view.dispatch(state.update({
    changes: { from: insertPos, to: insertPos, insert: insertText },
    selection: { anchor: insertPos + 5, head: insertPos + 5 } // 光标放在代码块中间
  }))
  return true
}

/**
 * 插入标题
 * @param {EditorView} view - 编辑器视图实例
 * @param {number} level - 标题级别 (1-6)
 * @returns {boolean} 是否成功执行
 */
function insertHeading(view, level = 1) {
  const { state } = view
  const pos = state.selection.main.head
  const line = state.doc.lineAt(pos)
  const lineText = state.sliceDoc(line.from, line.to)

  // 检查当前行是否已经是标题
  const headingMatch = lineText.match(/^(#{1,6})\s/)
  if (headingMatch) {
    // 替换现有标题级别
    const newPrefix = '#'.repeat(level) + ' '
    view.dispatch(state.update({
      changes: { from: line.from, to: line.from + headingMatch[0].length, insert: newPrefix },
      selection: { anchor: line.from + newPrefix.length, head: line.from + newPrefix.length }
    }))
  } else {
    // 在行首插入标题
    const prefix = '#'.repeat(level) + ' '
    view.dispatch(state.update({
      changes: { from: line.from, to: line.from, insert: prefix },
      selection: { anchor: line.from + prefix.length, head: line.from + prefix.length }
    }))
  }
  return true
}

/**
 * 在行首添加前缀
 * @param {EditorView} view - 编辑器视图实例
 * @param {string} prefix - 要添加的前缀
 * @returns {boolean} 是否成功执行
 */
function prependLine(view, prefix) {
  const { state } = view
  const range = state.selection.main

  // 如果有选中文本，为每一行添加前缀
  if (!range.empty) {
    const changes = []
    const fromLine = state.doc.lineAt(range.from)
    const toLine = state.doc.lineAt(range.to)

    for (let i = fromLine.number; i <= toLine.number; i++) {
      const line = state.doc.line(i)
      const lineText = state.sliceDoc(line.from, line.to)

      // 检查是否已经有相同前缀（切换效果）
      if (lineText.startsWith(prefix)) {
        changes.push({ from: line.from, to: line.from + prefix.length, insert: '' })
      } else {
        changes.push({ from: line.from, to: line.from, insert: prefix })
      }
    }

    view.dispatch(state.update({ changes }))
    return true
  }

  // 没有选中文本，在当前行添加前缀
  const line = state.doc.lineAt(range.head)
  const lineText = state.sliceDoc(line.from, line.to)

  if (lineText.startsWith(prefix)) {
    view.dispatch(state.update({
      changes: { from: line.from, to: line.from + prefix.length, insert: '' }
    }))
  } else {
    view.dispatch(state.update({
      changes: { from: line.from, to: line.from, insert: prefix },
      selection: { anchor: line.from + prefix.length, head: line.from + prefix.length }
    }))
  }
  return true
}

/**
 * 插入水平分割线
 * @param {EditorView} view - 编辑器视图实例
 * @returns {boolean} 是否成功执行
 */
function insertHorizontalRule(view) {
  const { state } = view
  const pos = state.selection.main.head
  const line = state.doc.lineAt(pos)
  const insertText = '\n---\n'

  view.dispatch(state.update({
    changes: { from: line.to, to: line.to, insert: insertText },
    selection: { anchor: line.to + insertText.length, head: line.to + insertText.length }
  }))
  return true
}

/**
 * 插入 Markdown 表格模板
 * @param {EditorView} view - 编辑器视图实例
 * @returns {boolean} 是否成功执行
 */
function insertTable(view) {
  const { state } = view
  const pos = state.selection.main.head
  const line = state.doc.lineAt(pos)
  const table = [
    '',
    '| 列1 | 列2 | 列3 |',
    '| --- | --- | --- |',
    '| 内容 | 内容 | 内容 |',
    ''
  ].join('\n')

  view.dispatch(state.update({
    changes: { from: line.to, to: line.to, insert: table },
    selection: { anchor: line.to + 3, head: line.to + 5 } // 选中"列1"
  }))
  return true
}

/**
 * 基础编辑器扩展配置
 * 包含行号、高亮、选区、缩进等基础功能
 */
const baseExtensions = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  foldGutter(),
  drawSelection(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  autocompletion()
]

/**
 * Markdown 语言支持配置
 * 包含 Markdown 语法和代码块语言支持
 */
const markdownSupport = markdown({
  base: markdownLanguage,
  codeLanguages: languages
})

/**
 * 快捷键配置
 * 合并默认快捷键、历史记录快捷键、折叠快捷键、自动补全快捷键和 Markdown 格式化快捷键
 */
const keyBindings = [
  markdownKeymap,
  ...closeBracketsKeymap,
  ...defaultKeymap,
  ...searchKeymap,
  ...historyKeymap,
  ...foldKeymap,
  ...completionKeymap,
  ...lintKeymap,
  keymap.of([indentWithTab])
]

/**
 * 创建编辑器扩展列表
 * @param {Object} options - 配置选项
 * @param {boolean} [options.darkMode=false] - 是否使用暗色主题
 * @param {number} [options.fontSize=14] - 编辑器字体大小
 * @param {string} [options.fontFamily="'Fira Code', 'Consolas', monospace"] - 编辑器字体族
 * @param {boolean} [options.lineWrapping=true] - 是否启用自动换行
 * @param {Function} [options.onChange] - 内容变化回调函数
 * @returns {Array} 编辑器扩展列表
 */
export function createExtensions(options = {}) {
  const {
    darkMode = false,
    fontSize = 14,
    fontFamily = "'Fira Code', 'Consolas', monospace",
    lineWrapping = true,
    onChange = null
  } = options

  const extensions = [
    ...baseExtensions,
    markdownSupport,
    ...keyBindings,
    EditorView.theme({
      '&': {
        height: '100%',
        fontSize: `${fontSize}px`
      },
      '.cm-content': {
        fontFamily: fontFamily,
        padding: '8px 0'
      },
      '.cm-gutters': {
        backgroundColor: darkMode ? '#1e1e1e' : '#f5f5f5',
        color: darkMode ? '#858585' : '#999',
        border: 'none'
      },
      '.cm-activeLineGutter': {
        backgroundColor: darkMode ? '#2a2a2a' : '#e8e8e8'
      },
      '.cm-activeLine': {
        backgroundColor: darkMode ? '#2a2a2a40' : '#e8e8e840'
      },
      '.cm-cursor': {
        borderLeftColor: darkMode ? '#aeafad' : '#000000'
      },
      '.cm-selectionBackground': {
        backgroundColor: darkMode ? '#3e4451' : '#add6ff'
      },
      '&.cm-focused .cm-selectionBackground': {
        backgroundColor: darkMode ? '#3e4451' : '#add6ff'
      },
      '.cm-scroller': {
        overflow: 'auto'
      }
    })
  ]

  // 暗色主题
  if (darkMode) {
    extensions.push(oneDark)
  }

  // 自动换行
  if (lineWrapping) {
    extensions.push(EditorView.lineWrapping)
  }

  // 内容变化监听
  if (onChange && typeof onChange === 'function') {
    extensions.push(EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString(), update)
      }
    }))
  }

  return extensions
}

/**
 * 默认编辑器配置
 * 可作为 createExtensions 的默认参数使用
 */
export const defaultEditorOptions = {
  darkMode: false,
  fontSize: 14,
  fontFamily: "'Fira Code', 'Consolas', monospace",
  lineWrapping: true,
  onChange: null
}

/**
 * 编辑器主题预设 - 浅色主题
 */
export const lightTheme = EditorView.theme({
  '&': {
    backgroundColor: '#ffffff',
    color: '#333333'
  }
})

/**
 * 编辑器主题预设 - 暗色主题
 */
export const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4'
  }
})

/**
 * 获取编辑器状态配置
 * @param {string} content - 初始内容
 * @param {Object} options - 编辑器配置选项
 * @returns {Object} EditorState.create 的参数
 */
export function getEditorStateConfig(content = '', options = {}) {
  return {
    doc: content,
    extensions: createExtensions(options)
  }
}
