<template>
  <div class="markdown-editor" :class="{ dark: theme === 'dark' }">
    <!-- 顶部工具栏 -->
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <!-- 目录切换按钮 -->
        <v-btn
          size="small"
          variant="text"
          :color="tocVisible ? 'primary' : (theme === 'dark' ? 'white' : 'default')"
          :class="{ 'toc-btn-active': tocVisible }"
          @click="tocVisible = !tocVisible"
          title="文档目录"
        >
          <v-icon size="18">mdi-format-list-bulleted-type</v-icon>
          <span class="btn-label">目录</span>
          <span v-if="headings.length > 0" class="toc-count">{{ headings.length }}</span>
        </v-btn>
      </div>
    </div>

    <!-- 编辑器内容区域 -->
    <div ref="editorContentRef" class="editor-content">
      <!-- 表格编辑浮动工具条（光标位于表格内时，悬浮于表格上方） -->
      <div
        v-if="tableToolbar.visible"
        class="table-toolbar"
        :style="{ left: tableToolbar.x + 'px', top: tableToolbar.y + 'px' }"
      >
        <v-tooltip text="在上方插入行" location="bottom">
          <template #activator="{ props: tipProps }">
            <v-btn
              icon
              size="x-small"
              variant="text"
              v-bind="tipProps"
              :disabled="tableToolbar.inHead"
              @mousedown.prevent
              @click="tableInsertRow(true)"
            >
              <v-icon size="16">mdi-table-row-plus-before</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="在下方插入行" location="bottom">
          <template #activator="{ props: tipProps }">
            <v-btn
              icon
              size="x-small"
              variant="text"
              v-bind="tipProps"
              @mousedown.prevent
              @click="tableInsertRow(false)"
            >
              <v-icon size="16">mdi-table-row-plus-after</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="在左侧插入列" location="bottom">
          <template #activator="{ props: tipProps }">
            <v-btn
              icon
              size="x-small"
              variant="text"
              v-bind="tipProps"
              @mousedown.prevent
              @click="tableInsertCol(true)"
            >
              <v-icon size="16">mdi-table-column-plus-before</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="在右侧插入列" location="bottom">
          <template #activator="{ props: tipProps }">
            <v-btn
              icon
              size="x-small"
              variant="text"
              v-bind="tipProps"
              @mousedown.prevent
              @click="tableInsertCol(false)"
            >
              <v-icon size="16">mdi-table-column-plus-after</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="删除当前行" location="bottom">
          <template #activator="{ props: tipProps }">
            <v-btn
              icon
              size="x-small"
              variant="text"
              v-bind="tipProps"
              :disabled="tableToolbar.inHead"
              @mousedown.prevent
              @click="tableDeleteRow"
            >
              <v-icon size="16">mdi-table-row-remove</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="删除当前列" location="bottom">
          <template #activator="{ props: tipProps }">
            <v-btn
              icon
              size="x-small"
              variant="text"
              v-bind="tipProps"
              :disabled="tableToolbar.colCount <= 1"
              @mousedown.prevent
              @click="tableDeleteCol"
            >
              <v-icon size="16">mdi-table-column-remove</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
      </div>
      <!-- TOC 目录面板 -->
      <TocPanel
        :key="fileKey"
        v-if="tocVisible && content"
        :headings="headings"
        :active-id="tocActiveId"
        :theme="theme"
        :width="tocWidth"
        @close="tocVisible = false"
        @navigate="handleTocNavigate"
        @update:width="tocWidth = $event"
      />
      <!-- Vditor IR 即时渲染编辑区 -->
      <div
        ref="vditorRef"
        class="vditor-container"
        :style="{ '--ir-font-size': irFontSize + 'px' }"
      ></div>
    </div>

    <!-- 插入表格行列数对话框 -->
    <TableSizeDialog v-model="tableDialogVisible" @confirm="handleInsertTable" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import TocPanel from './TocPanel.vue'
import TableSizeDialog from './TableSizeDialog.vue'
import { extractHeadings } from '@/utils/toc'
import { useSettingsStore } from '@/stores/settingsStore'

// ============ Props / Emits ============

const props = defineProps({
  /** Markdown 内容（v-model:content） */
  content: {
    type: String,
    default: ''
  },
  /** 主题模式 ('light' | 'dark') */
  theme: {
    type: String,
    default: 'light',
    validator: (value) => ['light', 'dark'].includes(value)
  },
  /** 基础字号（像素） */
  fontSize: {
    type: Number,
    default: 14
  },
  /** 缩放比例（50-200，百分比） */
  zoomLevel: {
    type: Number,
    default: 100
  },
  /** 是否有未保存修改 */
  modified: {
    type: Boolean,
    default: false
  },
  /** 当前文件路径（用于 TocPanel 按文件强制重建，避免残留状态） */
  fileKey: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:content', 'save', 'reload'])

const settingsStore = useSettingsStore()

// ============ 状态 ============

/** Vditor 挂载容器 */
const vditorRef = ref(null)

/** TOC 面板可见性 */
const tocVisible = ref(false)

/** TOC 面板宽度 */
const tocWidth = ref(240)

/** 当前高亮的标题 ID */
const tocActiveId = ref('')

/** 标题列表（由 toc.js 从源文本提取） */
const headings = ref([])

/** 标记外部内容注入（setValue），避免 input 回调回环 */
let isExternalUpdate = false

/** Vditor 实例 */
let vditorInstance = null

/** 输入防抖定时器 */
let inputTimer = null

/** 插入表格对话框可见性 */
const tableDialogVisible = ref(false)

/** 编辑器内容区容器（表格工具条定位基准） */
const editorContentRef = ref(null)

/** 表格工具条状态与位置 */
const tableToolbar = ref({ visible: false, x: 0, y: 0, inHead: false, colCount: 3 })

/** selectionchange 防抖帧 ID 与监听器引用 */
let tableToolbarRaf = 0
let selectionChangeListener = null
let editorScrollListener = null

/** 代码块语言下拉精选列表：常见编程语言 / 运维脚本 / 图表语言（渲染为图形） */
const CODE_BLOCK_LANGS = [
  // 图表类（Vditor 渲染为可视化图形）
  'mermaid', 'flowchart', 'plantuml', 'echarts', 'mindmap', 'graphviz', 'wavedrom', 'abc',
  // 编程语言
  'java', 'python', 'c', 'cpp', 'csharp', 'go', 'rust', 'php', 'ruby',
  'kotlin', 'swift', 'scala', 'groovy', 'dart', 'lua', 'perl',
  // 前端 / 标记 / 数据
  'javascript', 'typescript', 'html', 'css', 'scss', 'less', 'json', 'xml', 'yaml', 'markdown', 'sql',
  // 运维 / Shell / 配置
  'bash', 'shell', 'powershell', 'bat', 'dos', 'dockerfile', 'nginx', 'ini', 'toml', 'makefile', 'diff', 'plaintext'
]

/** 代码块折叠阈值：超过该行数才显示折叠按钮 */
const CODE_FOLD_THRESHOLD = 20

/** 折叠后可见高度（约 3 行） */
const CODE_FOLD_COLLAPSED_HEIGHT = '5.5em'

/** 代码块折叠按钮同步观察器 */
let codeFoldObserver = null
let codeFoldRaf = 0

/** 语言提示面板搜索框观察器 */
let hintSearchObserver = null

/** 语言按钮点击提示处理函数引用（卸载时移除） */
let languageClickHandler = null

/** 快捷键监听器引用（卸载时移除） */
let shortcutHandler = null

/** IR 编辑区实际字号 = 基础字号 × 缩放比例 */
const irFontSize = computed(() => Math.round(props.fontSize * props.zoomLevel / 100))

// ============ 方法 ============

/**
 * 初始化 Vditor（IR 即时渲染模式）
 * IR 模式下编辑区即渲染区：Lute 引擎实时将 Markdown 转换为富文本 DOM
 */
function initVditor() {
  vditorInstance = new Vditor(vditorRef.value, {
    mode: 'ir',
    lang: 'zh_CN',
    // 关键：指向随应用打包的本地静态资源（vite-plugin-static-copy 复制到 vditor/dist/），
    // 避免 Vditor 运行时从 unpkg.com CDN 拉取 i18n/Lute/图标等资源导致离线空白
    cdn: './vditor',
    height: '100%',
    cache: { enable: false },
    value: props.content || '',
    counter: { enable: false },
    typewriterMode: false,
    // 关键：IR 内容区宽度不限制（默认 800px 居中，两侧留白随窗口增大，
    // 全屏时每侧空白可达 400px+）。调大后仅保留 35px 最小边距
    preview: { maxWidth: 100000, hljs: { langs: CODE_BLOCK_LANGS } },
    toolbarConfig: { pin: true },
    // 精简工具栏：只保留高频操作，不放源码/分屏模式切换按钮，保持纯 IR
    toolbar: [
      'headings', 'bold', 'italic', 'strike', '|',
      'list', 'ordered-list', 'check', 'outdent', 'indent', '|',
      'quote', 'line', 'code', 'inline-code', 'insert-before', 'insert-after', '|',
      'link', {
        // 自定义表格按钮：弹出对话框输入行列数后生成表格（原生按钮固定 3×3）
        name: 'rn-table',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 3h18v18H3V3zm2 2v4h6V5H5zm8 0v4h6V5h-6zM5 11v4h6v-4H5zm8 0v4h6v-4h-6zM5 17v4h6v-4H5zm8 0v4h6v-4h-6z"/></svg>',
        tip: '插入表格（自定义行列数）',
        click: () => { tableDialogVisible.value = true }
      }, '|', 'undo', 'redo', '|', 'fullscreen', 'export'
    ],
    input: (value) => {
      // IR 模式下每次编辑触发；防抖 150ms 同步给父组件，避免逐键触发 fileStore 更新
      if (inputTimer) clearTimeout(inputTimer)
      inputTimer = setTimeout(() => {
        refreshHeadings(value)
        if (!isExternalUpdate) {
          emit('update:content', value)
        }
      }, 150)
    },
    after: () => {
      // 实例就绪后应用主题与字号
      applyTheme(props.theme)
      refreshHeadings(props.content)
      bindEditorShortcuts()
      bindCodeFoldObserver()
      patchHintGenHTML()
      bindHintSearch()
      bindLanguageClickHint()
      bindTableToolbar()
    }
  })
}

/**
 * 外部内容变更（切换文件/从磁盘重载）时注入编辑器
 * setValue 会重置光标，仅在内容确实不同时调用
 */
function setContentFromOutside(value) {
  if (!vditorInstance) return
  isExternalUpdate = true
  vditorInstance.setValue(value || '')
  isExternalUpdate = false
  refreshHeadings(value)
}

/**
 * 从 Markdown 源文本提取标题（toc.js 正则方案，与渲染器解耦）
 * @param {string} content
 */
function refreshHeadings(content) {
  headings.value = extractHeadings(content)
}

/**
 * TOC 点击导航：按索引定位 IR 区渲染后的标题元素并滚动
 * @param {{id: string, text: string, level: number, line: number}} heading
 */
function handleTocNavigate(heading) {
  tocActiveId.value = heading.id
  const irElement = vditorInstance?.vditor?.ir?.element
    || document.querySelector('.vditor-ir .vditor-reset')
  if (!irElement) return
  const rendered = irElement.querySelectorAll('h1, h2, h3, h4, h5, h6')
  const index = headings.value.findIndex(h => h.id === heading.id)
  const target = rendered[index]
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    target.classList.add('toc-flash')
    setTimeout(() => target.classList.remove('toc-flash'), 1200)
  }
}

/**
 * 应用明暗主题
 * Vditor 暗色通过容器 vditor--dark 类 + setTheme 双通道生效
 */
function applyTheme(theme) {
  const dark = theme === 'dark'
  const container = vditorRef.value
  if (!container) return
  container.classList.toggle('vditor--dark', dark)
  try {
    vditorInstance?.vditor?.setTheme?.(dark ? 'dark' : 'light')
  } catch (e) {
    // setTheme 在部分版本仅支持 WYSIWYG/SV，IR 下由 vditor--dark 类兜底
  }
}

function handleSave() {
  emit('save')
}

// ============ 表格增强 ============

/**
 * 按指定行列数在光标处插入表格
 * 采用 DOM 直插（同标题快捷键方案）：构造 table 元素替换光标所在块，
 * 触发 input 后由 Lute 反序列化为 markdown；不走 insertValue 文本插入，
 * 避免 Vditor 对表格末尾的自动补行导致行数不可控
 * @param {number} rows - 总行数（含表头行）
 * @param {number} cols - 列数
 */
function handleInsertTable(rows, cols) {
  if (!vditorInstance) return
  const irEl = vditorInstance.vditor?.ir?.element
  const sel = window.getSelection()
  if (!irEl || !sel.rangeCount) return

  // 找到光标所在块级元素
  let node = sel.getRangeAt(0).startContainer
  if (node.nodeType !== 1) node = node.parentElement
  let block = null
  while (node && node !== irEl) {
    if (node.nodeType === 1 && node.getAttribute('data-block') === '0') {
      block = node
      break
    }
    node = node.parentNode
  }
  if (!block) return

  const table = document.createElement('table')
  table.setAttribute('data-block', '0')
  const thead = document.createElement('thead')
  const headTr = document.createElement('tr')
  for (let c = 0; c < cols; c++) {
    const th = document.createElement('th')
    th.textContent = 'col' + (c + 1)
    headTr.appendChild(th)
  }
  thead.appendChild(headTr)
  table.appendChild(thead)

  if (rows > 1) {
    const tbody = document.createElement('tbody')
    for (let r = 1; r < rows; r++) {
      const tr = document.createElement('tr')
      for (let c = 0; c < cols; c++) {
        const td = document.createElement('td')
        td.textContent = ' '
        tr.appendChild(td)
      }
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)
  }

  block.replaceWith(table)
  triggerTableInput()
  focusTableCell(0, 0)
}

/**
 * 表格 DOM 操作后恢复光标到指定单元格。
 * 注意：不能用 <wbr> 方案——Lute 序列化表格时会丢失含 wbr 的单元格文本；
 * 改为 input 重渲染完成后按行列索引手动定位（rAF 等待块重建）
 * @param {number} rowIndex - 目标行号
 * @param {number} colIndex - 目标列号
 */
function focusTableCell(rowIndex, colIndex) {
  requestAnimationFrame(() => {
    const irEl = vditorInstance?.vditor?.ir?.element
    const table = irEl && irEl.querySelector('table')
    const cell = table && table.rows[rowIndex] && table.rows[rowIndex].children[colIndex]
    if (!cell) return
    const range = document.createRange()
    range.selectNodeContents(cell)
    range.collapse(false)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
  })
}

/**
 * 获取光标所在表格单元格上下文
 * @returns {{table, tr, cell, colIndex, rowIndex, colCount, inHead} | null}
 */
function getCellContext() {
  const sel = window.getSelection()
  if (!sel.rangeCount) return null
  let node = sel.getRangeAt(0).startContainer
  if (node.nodeType !== 1) node = node.parentElement
  if (!node || !node.closest) return null
  const cell = node.closest('td, th')
  const table = cell ? cell.closest('table') : null
  const irEl = vditorInstance?.vditor?.ir?.element
  if (!cell || !table || !irEl || !irEl.contains(table)) return null
  const tr = cell.parentElement
  const colIndex = Array.from(tr.children).indexOf(cell)
  const rowIndex = Array.from(table.rows).indexOf(tr)
  const colCount = table.rows[0] ? table.rows[0].children.length : 0
  return {
    table,
    tr,
    cell,
    colIndex,
    rowIndex,
    colCount,
    inHead: tr.parentElement.tagName === 'THEAD'
  }
}

/** 光标变化后同步表格工具条显隐与位置（rAF 防抖） */
function scheduleUpdateTableToolbar() {
  if (tableToolbarRaf) cancelAnimationFrame(tableToolbarRaf)
  tableToolbarRaf = requestAnimationFrame(() => {
    tableToolbarRaf = 0
    updateTableToolbar()
  })
}

function updateTableToolbar() {
  const ctx = getCellContext()
  const container = editorContentRef.value
  if (!ctx || !container) {
    if (tableToolbar.value.visible) tableToolbar.value = { ...tableToolbar.value, visible: false }
    return
  }
  const tableRect = ctx.table.getBoundingClientRect()
  const baseRect = container.getBoundingClientRect()
  const TOOLBAR_WIDTH = 216
  const TOOLBAR_HEIGHT = 28
  // 定位在表格正上方，与表格左边缘对齐
  const x = Math.min(
    Math.max(4, tableRect.left - baseRect.left),
    baseRect.width - TOOLBAR_WIDTH - 8
  )
  const y = Math.max(4, tableRect.top - baseRect.top - TOOLBAR_HEIGHT - 2)
  tableToolbar.value = {
    visible: true,
    x,
    y,
    inHead: ctx.inHead,
    colCount: ctx.colCount
  }
}

/** 触发 Vditor IR 重新解析表格块（wbr 已在目标单元格内，用于恢复光标） */
function triggerTableInput() {
  const irEl = vditorInstance?.vditor?.ir?.element
  if (irEl) irEl.dispatchEvent(new InputEvent('input', { bubbles: true }))
}

/**
 * 在光标所在行上方/下方插入一行
 * @param {boolean} before - true 上方插入；false 下方插入
 * 表头行不支持上方插入（按钮禁用）；表头行的下方插入进表体首行
 */
function tableInsertRow(before) {
  const ctx = getCellContext()
  if (!ctx) return
  if (before && ctx.inHead) return
  const colCount = ctx.colCount
  const newTr = document.createElement('tr')
  for (let i = 0; i < colCount; i++) {
    const td = document.createElement('td')
    td.textContent = ' '
    newTr.appendChild(td)
  }
  if (ctx.inHead) {
    // 表头行的下方 → 表体首行
    let tbody = ctx.table.tBodies[0]
    if (!tbody) {
      tbody = document.createElement('tbody')
      ctx.table.appendChild(tbody)
    }
    tbody.insertBefore(newTr, tbody.firstElementChild)
  } else if (before) {
    ctx.tr.before(newTr)
  } else {
    ctx.tr.after(newTr)
  }
  triggerTableInput()
  focusTableCell(ctx.inHead ? 1 : before ? ctx.rowIndex : ctx.rowIndex + 1, 0)
}

/** 删除光标所在行（表头行不可删，由按钮禁用态保证） */
function tableDeleteRow() {
  const ctx = getCellContext()
  if (!ctx || ctx.inHead) return
  ctx.tr.remove()
  triggerTableInput()
  const total = ctx.table.rows.length - 1
  focusTableCell(Math.min(ctx.rowIndex, total - 1), Math.min(ctx.colIndex, ctx.colCount - 1))
}

/**
 * 在光标所在列左侧/右侧插入一列（表头行插 th）
 * @param {boolean} before - true 左侧插入；false 右侧插入
 */
function tableInsertCol(before) {
  const ctx = getCellContext()
  if (!ctx) return
  Array.from(ctx.table.rows).forEach((tr) => {
    const refCell = tr.children[Math.min(ctx.colIndex, tr.children.length - 1)]
    const newCell = document.createElement(tr.parentElement.tagName === 'THEAD' ? 'th' : 'td')
    newCell.textContent = ' '
    if (before) {
      refCell.before(newCell)
    } else {
      refCell.after(newCell)
    }
  })
  triggerTableInput()
  focusTableCell(ctx.rowIndex, before ? ctx.colIndex : ctx.colIndex + 1)
}

/** 删除光标所在列（仅剩 1 列时不可删，由按钮禁用态保证） */
function tableDeleteCol() {
  const ctx = getCellContext()
  if (!ctx || ctx.colCount <= 1) return
  const targetCol = ctx.colIndex > 0 ? ctx.colIndex - 1 : 1
  Array.from(ctx.table.rows).forEach((tr) => {
    if (tr.children[ctx.colIndex]) tr.children[ctx.colIndex].remove()
  })
  triggerTableInput()
  focusTableCell(ctx.rowIndex, Math.min(targetCol, ctx.colCount - 2))
}

/** 监听光标变化与编辑器滚动，驱动表格工具条 */
function bindTableToolbar() {
  if (selectionChangeListener) return
  selectionChangeListener = scheduleUpdateTableToolbar
  document.addEventListener('selectionchange', selectionChangeListener)
  editorScrollListener = scheduleUpdateTableToolbar
  const container = editorContentRef.value
  if (container) container.addEventListener('scroll', editorScrollListener, true)
  scheduleUpdateTableToolbar()
}

function unbindTableToolbar() {
  if (selectionChangeListener) {
    document.removeEventListener('selectionchange', selectionChangeListener)
    selectionChangeListener = null
  }
  if (editorScrollListener) {
    editorContentRef.value?.removeEventListener('scroll', editorScrollListener, true)
    editorScrollListener = null
  }
}

// ============ 编辑器快捷键 ============
// ============ 编辑器快捷键 ============

/**
 * 从键盘事件生成组合键字符串（与 settingsStore.shortcuts 格式一致）
 * @param {KeyboardEvent} e
 * @returns {string} 如 'ctrl+1'、'ctrl+shift+d'；纯修饰键返回空串
 */
function comboFromEvent(e) {
  const parts = []
  if (e.ctrlKey || e.metaKey) parts.push('ctrl')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  const key = (e.key || '').toLowerCase()
  if (!['control', 'shift', 'alt', 'meta'].includes(key)) parts.push(key)
  return parts.join('+')
}

/**
 * 编辑器快捷键处理（捕获阶段，优先于 Vditor 内部处理）
 * 匹配 settingsStore.shortcuts 中配置的组合键
 * @param {KeyboardEvent} e
 */
function onEditorKeydown(e) {
  if (!(e.ctrlKey || e.metaKey || e.altKey)) return
  const combo = comboFromEvent(e)
  const shortcuts = settingsStore.shortcuts || {}

  // 标题级别：heading1 ~ heading6 → Ctrl+1 ~ Ctrl+6（默认）
  for (let level = 1; level <= 6; level++) {
    if (shortcuts['heading' + level] === combo) {
      e.preventDefault()
      e.stopImmediatePropagation()
      setHeadingLevel(level)
      return
    }
  }

  // 代码块：codeBlock → Ctrl+D（默认）
  if (shortcuts.codeBlock === combo) {
    e.preventDefault()
    e.stopImmediatePropagation()
    insertCodeBlock()
  }
}

/**
 * 设置光标所在块的标题级别（IR 模式）
 * 原理：IR 编辑区中标题就是 h1~h6 块元素，直接替换标签后在光标处插入
 * <wbr> 标记并触发 input 事件，Vditor 会重新解析该块并恢复光标
 * @param {number} level - 标题级别 1-6
 */
function setHeadingLevel(level) {
  if (!vditorInstance) return
  const irEl = vditorInstance.vditor.ir.element
  const sel = window.getSelection()
  if (!sel.rangeCount) return

  const range = sel.getRangeAt(0)
  // 向上找光标所在的块级元素
  let node = range.startContainer
  let block = null
  while (node && node !== irEl) {
    if (node.nodeType === 1 && /^(H[1-6]|P)$/.test(node.tagName)) {
      block = node
      break
    }
    node = node.parentNode
  }
  if (!block) return

  const newTag = 'H' + level
  const markerText = '#'.repeat(level) + ' '
  if (block.tagName === newTag) return

  // 在光标处插入 wbr 标记（Vditor 依赖它恢复光标位置）
  const wbr = document.createElement('wbr')
  try {
    range.insertNode(wbr)
  } catch (err) {
    block.appendChild(wbr)
  }

  /** 创建 IR 标题标记符 span（其文本就是块的 Markdown 标记源码） */
  const createMarker = () => {
    const marker = document.createElement('span')
    marker.className = 'vditor-ir__marker vditor-ir__marker--heading'
    marker.setAttribute('data-type', 'heading-marker')
    marker.textContent = markerText
    return marker
  }

  if (block.tagName === 'P') {
    // 段落 → 标题：改标签 + 在首位插入标记符
    const newBlock = document.createElement(newTag)
    newBlock.setAttribute('data-block', '0')
    for (const attr of block.attributes) newBlock.setAttribute(attr.name, attr.value)
    newBlock.appendChild(createMarker())
    while (block.firstChild) newBlock.appendChild(block.firstChild)
    block.replaceWith(newBlock)
  } else {
    // 标题 → 标题：改标签 + 修改标记符文本（保留全部子节点）
    const newBlock = document.createElement(newTag)
    newBlock.setAttribute('data-block', '0')
    for (const attr of block.attributes) newBlock.setAttribute(attr.name, attr.value)
    while (block.firstChild) newBlock.appendChild(block.firstChild)
    block.replaceWith(newBlock)
    const marker = newBlock.querySelector('.vditor-ir__marker--heading')
    if (marker) {
      marker.textContent = markerText
    } else {
      newBlock.prepend(createMarker())
    }
  }

  // 触发 Vditor IR 输入管线，重新解析该块并恢复光标
  irEl.dispatchEvent(new InputEvent('input', { bubbles: true }))
}

/**
 * 在光标处插入代码块（复用 Vditor 工具栏 code 按钮的原生行为）
 */
function insertCodeBlock() {
  if (!vditorInstance) return
  const codeItem = vditorInstance.vditor?.toolbar?.elements?.code
  const btn = codeItem && (codeItem.querySelector('button') || codeItem.firstElementChild)
  if (btn) {
    btn.click()
  } else {
    // 兜底：直接插入 Markdown 围栏语法
    vditorInstance.insertValue('\n```\n\n```\n')
  }
}

/** 绑定快捷键监听（捕获阶段，在 Vditor 内部处理之前拦截） */
function bindEditorShortcuts() {
  if (!vditorInstance) return
  const irEl = vditorInstance.vditor?.ir?.element
  if (!irEl) return
  shortcutHandler = onEditorKeydown
  irEl.addEventListener('keydown', shortcutHandler, true)
}

function unbindEditorShortcuts() {
  if (!vditorInstance || !shortcutHandler) return
  const irEl = vditorInstance.vditor?.ir?.element
  if (irEl) irEl.removeEventListener('keydown', shortcutHandler, true)
  shortcutHandler = null
}

// ============ 代码块折叠（方案 A：默认展开，超长显示折叠按钮，纯视图状态不持久化） ============

/** 防抖调度折叠按钮同步（DOM 波动密集时合并到下一帧执行一次） */
function scheduleSyncCodeFold() {
  if (codeFoldRaf) cancelAnimationFrame(codeFoldRaf)
  codeFoldRaf = requestAnimationFrame(() => {
    codeFoldRaf = 0
    syncCodeFoldChips()
  })
}

/**
 * 同步所有代码块的折叠按钮状态
 * 按钮注入在 pre.vditor-ir__preview（data-render=1）内部：该子树由 Vditor
 * 渲染管线重建、不参与 markdown 序列化（与自带复制按钮同机制），因此
 * 注入的按钮不会污染文档内容；重渲染后被清除 → 由观察器再次补挂
 */
function syncCodeFoldChips() {
  if (!vditorInstance) return
  const irEl = vditorInstance.vditor?.ir?.element
  if (!irEl) return
  irEl.querySelectorAll('[data-type="code-block"]').forEach((node) => {
    const preview = node.querySelector('pre.vditor-ir__preview')
    if (!preview) return
    const code = preview.querySelector('code')
    const lineCount = code ? code.textContent.split('\n').length : 0

    if (lineCount <= CODE_FOLD_THRESHOLD) {
      // 不超长：移除按钮并确保展开
      const chip = preview.querySelector('.rn-code-fold')
      if (chip) chip.remove()
      node.classList.remove('rn-code-collapsed')
      return
    }

    let chip = preview.querySelector('.rn-code-fold')
    if (!chip) {
      chip = document.createElement('span')
      chip.className = 'rn-code-fold'
      // 阻止点击传播到 IR 编辑区，避免移动光标/触发解析
      chip.addEventListener('mousedown', (e) => e.stopPropagation())
      chip.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleCodeFold(node)
      })
      preview.appendChild(chip)
    }
    const collapsed = node.classList.contains('rn-code-collapsed')
    if (code) {
      // 直接改内联 max-height：折叠时覆盖 Vditor 自带的 760px 限高
      code.style.maxHeight = collapsed ? CODE_FOLD_COLLAPSED_HEIGHT : ''
    }
    chip.textContent = collapsed ? '展开全部（共 ' + lineCount + ' 行）' : '折叠'
    chip.title = collapsed ? '展开代码块' : '折叠代码块'
  })
}

/** 切换指定代码块的折叠状态 */
function toggleCodeFold(node) {
  node.classList.toggle('rn-code-collapsed')
  syncCodeFoldChips()
}

/** 监听 IR 区 DOM 变化，自动补挂/更新折叠按钮 */
function bindCodeFoldObserver() {
  const irEl = vditorInstance?.vditor?.ir?.element
  if (!irEl || codeFoldObserver) return
  codeFoldObserver = new MutationObserver(scheduleSyncCodeFold)
  codeFoldObserver.observe(irEl, { childList: true, subtree: true })
  scheduleSyncCodeFold()
}

// ============ 语言提示面板搜索框（Vditor 原生 hint 无搜索能力） ============

/**
 * 监听 hint 面板：显示时在顶部注入搜索输入框，输入即过滤语言列表；
 * 隐藏时移除，确保下次打开是干净状态。
 * 注意页面存在多个 .vditor-hint 元素，必须使用 vditor.hint.element 这个活跃实例。
 */
function bindHintSearch() {
  const hintEl = vditorInstance?.vditor?.hint?.element
  if (!hintEl || hintSearchObserver) return
  hintSearchObserver = new MutationObserver(() => syncHintSearch(hintEl))
  hintSearchObserver.observe(hintEl, { attributes: true, attributeFilter: ['style'], childList: true })
}

/**
 * 解除 Vditor 语言提示列表最多 8 条的限制：
 * 包装 hint.genHTML，超过 8 条时先用原版渲染前 8 条（复用其定位/高亮/绑定），
 * 再自行追加剩余条目并补齐点击与溢出处理
 */
function patchHintGenHTML() {
  const hint = vditorInstance?.vditor?.hint
  if (!hint || hint.__rnUncapped) return
  const orig = hint.genHTML.bind(hint)
  hint.__rnUncapped = true
  hint.genHTML = function (data, key, vditor) {
    if (!data || data.length <= 8) {
      orig(data, key, vditor)
      return
    }
    orig(data.slice(0, 8), key, vditor)
    if (hint.element.style.display === 'none') return
    const buildBtn = (hintData) => {
      let html = hintData.html
      if (key) {
        const lastIndex = html.lastIndexOf('>') + 1
        let replaceHtml = html.substr(lastIndex)
        const idx = replaceHtml.toLowerCase().indexOf(key.toLowerCase())
        if (idx > -1) {
          replaceHtml = replaceHtml.substring(0, idx) + '<b>' +
            replaceHtml.substring(idx, idx + key.length) + '</b>' +
            replaceHtml.substring(idx + key.length)
          html = html.substr(0, lastIndex) + replaceHtml
        }
      }
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.setAttribute('data-value', encodeURIComponent(hintData.value) + ' ')
      btn.innerHTML = ' ' + html
      return btn
    }
    const frag = document.createDocumentFragment()
    data.slice(8).forEach((d) => frag.appendChild(buildBtn(d)))
    hint.element.appendChild(frag)
    hint.element.querySelectorAll('button').forEach((btn) => {
      if (!btn.__rnBound) {
        btn.__rnBound = true
        btn.addEventListener('click', (event) => {
          hint.fillEmoji(btn, vditor)
          event.preventDefault()
        })
      }
    })
    const rect = hint.element.getBoundingClientRect()
    if (rect.bottom > window.innerHeight) {
      const top = parseFloat(hint.element.style.top) || 0
      hint.element.style.top = (top - (rect.bottom - window.innerHeight) - 8) + 'px'
    }
  }
}

/**
 * 点击语言按钮（如 bash/java）时弹出语言选择面板。
 * Vditor 原生仅在输入（keyup）时触发提示，点击无响应；此处补齐点击行为：
 * 光标移入语言标记并按当前前缀生成候选列表（复用已解除条数限制的 genHTML）
 */
function bindLanguageClickHint() {
  const irEl = vditorInstance?.vditor?.ir?.element
  if (!irEl || languageClickHandler) return
  languageClickHandler = (e) => {
    const info = e.target.closest('[data-type="code-block-info"]')
    const vditor = vditorInstance?.vditor
    if (!info || !vditor) return
    // 光标移入语言标记末尾，保持与输入时一致的编辑状态
    const range = document.createRange()
    range.selectNodeContents(info)
    range.collapse(false)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
    info.focus()
    // 生成候选列表（与 processHint 同样的前缀匹配逻辑）
    const langs = (vditor.options.preview.hljs && vditor.options.preview.hljs.langs) || []
    const key = (info.textContent || '').replace(/\u200b/g, '').toLowerCase()
    const data = langs
      .filter((l) => l.toLowerCase().includes(key))
      .map((l) => ({ html: l, value: l }))
    vditor.hint.genHTML(data, key, vditor)
  }
  irEl.addEventListener('click', languageClickHandler)
}
/** 同步搜索框：面板可见且是语言列表时注入/复用，隐藏时移除 */
function syncHintSearch(hintEl) {
  const visible = hintEl.style.display === 'block'
  const isLangList = !!hintEl.querySelector('button[data-value]')
  let input = hintEl.querySelector('.rn-hint-search')

  if (!visible || !isLangList) {
    if (input) input.remove()
    return
  }
  if (!input) {
    input = document.createElement('input')
    input.className = 'rn-hint-search'
    input.placeholder = '搜索语言...'
    input.addEventListener('input', () => filterHintList(hintEl, input))
    input.addEventListener('mousedown', (e) => e.stopPropagation())
    input.addEventListener('click', (e) => e.stopPropagation())
    input.addEventListener('keydown', (e) => handleHintSearchKeydown(e, hintEl, input))
    hintEl.prepend(input)
  }
  // 每次面板重新打开时重置筛选
  if (input.value) {
    input.value = ''
    filterHintList(hintEl, input)
  }
}

/** 按关键字过滤语言列表，并把“当前项”重置到第一个可见项 */
function filterHintList(hintEl, input) {
  const keyword = input.value.trim().toLowerCase()
  const items = [...hintEl.querySelectorAll('button[data-value]')]
  let firstVisible = null
  items.forEach((btn) => {
    const hit = !keyword || btn.textContent.toLowerCase().includes(keyword)
    btn.style.display = hit ? '' : 'none'
    btn.classList.remove('vditor-hint--current')
    if (hit && !firstVisible) firstVisible = btn
  })
  if (firstVisible) firstVisible.classList.add('vditor-hint--current')
}

/** 搜索框内 Enter/↑/↓/Escape 的键盘导航 */
function handleHintSearchKeydown(e, hintEl, input) {
  const visible = () => [...hintEl.querySelectorAll('button[data-value]')].filter(b => b.style.display !== 'none')
  if (e.key === 'Enter') {
    e.preventDefault()
    const current = visible().find(b => b.classList.contains('vditor-hint--current')) || visible()[0]
    if (current) current.click()
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const items = visible()
    if (!items.length) return
    const idx = items.findIndex(b => b.classList.contains('vditor-hint--current'))
    const next = e.key === 'ArrowDown'
      ? items[Math.min(idx + 1, items.length - 1)]
      : items[Math.max(idx - 1, 0)]
    items.forEach(b => b.classList.remove('vditor-hint--current'))
    next.classList.add('vditor-hint--current')
    next.scrollIntoView({ block: 'nearest' })
  } else if (e.key === 'Escape') {
    e.preventDefault()
    hintEl.style.display = 'none'
    input.value = ''
    filterHintList(hintEl, input)
    vditorInstance?.vditor?.ir?.element?.focus()
  }
}

// ============ 侦听器 ============

/** 外部内容变化（切换文件/重载）→ 注入编辑器；内部编辑引起的变化跳过 */
watch(() => props.content, (newContent) => {
  if (!vditorInstance) return
  const current = vditorInstance.getValue()
  if (newContent !== current) {
    setContentFromOutside(newContent)
  }
})

/** 主题切换 */
watch(() => props.theme, (t) => applyTheme(t))

// ============ 生命周期 ============

onMounted(() => {
  initVditor()
})

onBeforeUnmount(() => {
  if (inputTimer) clearTimeout(inputTimer)
  unbindEditorShortcuts()
  if (codeFoldObserver) {
    codeFoldObserver.disconnect()
    codeFoldObserver = null
  }
  if (hintSearchObserver) {
    hintSearchObserver.disconnect()
    hintSearchObserver = null
  }
  if (languageClickHandler && vditorInstance) {
    const irEl = vditorInstance.vditor?.ir?.element
    if (irEl) irEl.removeEventListener('click', languageClickHandler)
    languageClickHandler = null
  }
  unbindTableToolbar()
  if (codeFoldRaf) cancelAnimationFrame(codeFoldRaf)
  try {
    vditorInstance?.destroy?.()
  } catch (e) {
    // 忽略销毁异常
  }
  vditorInstance = null
})

// ============ 对外暴露 ============

defineExpose({
  /** 聚焦编辑器（保持与原 Editor 组件兼容的调用方式） */
  focus: () => {
    try {
      vditorInstance?.focus?.()
    } catch (e) {
      // 忽略聚焦异常
    }
  },
  /** 获取编辑器当前 Markdown 源文本 */
  getValue: () => (vditorInstance ? vditorInstance.getValue() : ''),
  /** 注入内容（外部更新） */
  setValue: setContentFromOutside
})
</script>

<style scoped>
.markdown-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 8px;
  min-height: 40px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

.markdown-editor.dark .editor-toolbar {
  border-bottom-color: rgba(255, 255, 255, 0.12);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-label {
  margin-left: 4px;
}

.toc-count {
  margin-left: 4px;
  font-size: 11px;
  opacity: 0.7;
}

.editor-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.vditor-container {
  flex: 1;
  min-width: 0;
}

/* IR 编辑区字号（字号 × 缩放比例） */
.vditor-container :deep(.vditor-ir .vditor-reset) {
  font-size: var(--ir-font-size, 14px);
}

/* TOC 点击高亮闪烁 */
.vditor-container :deep(.toc-flash) {
  animation: toc-flash-anim 1.2s ease;
}

@keyframes toc-flash-anim {
  0% {
    background-color: rgba(25, 118, 210, 0.25);
  }
  100% {
    background-color: transparent;
  }
}

/* 编辑区填满剩余高度 */
.vditor-container :deep(.vditor) {
  height: 100%;
  border: none;
}

/* 表格编辑浮动工具条（绝对定位于 editor-content，坐标由 JS 计算） */
.table-toolbar {
  position: absolute;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 4px;
  background-color: #ffffff;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  height: 28px;
}

/* 暗色主题适配 */
.markdown-editor.dark .table-toolbar {
  background-color: #2d333b;
  border-color: #444c56;
}
</style>

<style>
/* Vditor 工具栏 tooltip 方向修复：
   1. 未配置 tipPosition 时类名为 __undefined，Vditor 自带 CSS 未定义该方向；
   2. 默认气泡显示在按钮上方（bottom:100%），但工具栏位于编辑区顶部，
      上方多层祖先（.editor-content/.markdown-editor 等）均为 overflow:hidden，
      气泡被完全裁剪不可见。
   统一改为：气泡显示在按钮下方，箭头指向上方。 */
.vditor-container .vditor-tooltipped__undefined::after,
.vditor-container .vditor-tooltipped__n::after,
.vditor-container .vditor-tooltipped__ne::after,
.vditor-container .vditor-tooltipped__nw::after {
  bottom: auto !important;
  top: 100% !important;
  margin-top: 5px !important;
  margin-bottom: 0 !important;
  left: 50% !important;
  right: auto !important;
  transform: translateX(-50%) !important;
}

.vditor-container .vditor-tooltipped__undefined::before,
.vditor-container .vditor-tooltipped__n::before,
.vditor-container .vditor-tooltipped__ne::before,
.vditor-container .vditor-tooltipped__nw::before {
  top: -5px !important;
  bottom: auto !important;
  right: 50% !important;
  margin-right: -5px !important;
  border-top-color: transparent !important;
  border-bottom-color: #3b3e43 !important;
}

/* 第一个工具栏按钮（标题）靠近左边界，居中气泡会超出容器被裁剪，
   改为左对齐：气泡左边缘与按钮左边缘对齐 */
.vditor-toolbar__item:first-child .vditor-tooltipped::after {
  left: 0 !important;
  right: auto !important;
  transform: none !important;
  margin-left: 0 !important;
}

.vditor-toolbar__item:first-child .vditor-tooltipped::before {
  left: 15px !important;
  right: auto !important;
  margin-left: 0 !important;
  transform: none !important;
}

/* ===== 代码块增强：灰底色差 + 语言按钮 + 折叠按钮 ===== */

/* 编辑态（--expand）只显示源码编辑区，隐藏下方渲染预览区，避免出现两块区域 */
.vditor-container .vditor-ir .vditor-ir__node--expand > .vditor-ir__preview {
  display: none;
}

/* 渲染视图：与正文有明显色差的灰色区域 */
.vditor-container .vditor-ir .vditor-ir__node[data-type="code-block"] .vditor-ir__preview {
  position: relative;
  background-color: #f6f8fa;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 8px 12px;
  margin: 4px 0;
}

/* 语言按钮（bash）：胶囊按钮样式，位于代码块正上方 */
.vditor-container .vditor-ir .vditor-ir__marker--info[data-type="code-block-info"] {
  display: inline-block;
  background-color: #eaeef2;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  padding: 0 10px;
  margin: 2px 0 6px;
  line-height: 20px;
  cursor: pointer;
  font-size: 12px;
}

/* 折叠按钮：位于渲染区右上角（复制按钮左侧） */
.vditor-container .vditor-ir .rn-code-fold {
  position: absolute;
  top: 6px;
  right: 40px;
  z-index: 2;
  font-size: 12px;
  line-height: 20px;
  padding: 0 8px;
  background-color: #ffffff;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  opacity: 0.85;
}

.vditor-container .vditor-ir .rn-code-fold:hover {
  opacity: 1;
  background-color: #f0f4f8;
}

/* 折叠态：代码底部渐隐，暗示内容被收纳 */
.vditor-container .vditor-ir .rn-code-collapsed .vditor-ir__preview code {
  -webkit-mask-image: linear-gradient(180deg, #000 55%, transparent 100%);
  mask-image: linear-gradient(180deg, #000 55%, transparent 100%);
}

/* 暗色主题适配 */
.vditor--dark .vditor-ir .vditor-ir__node[data-type="code-block"] .vditor-ir__preview {
  background-color: #252c33;
  border-color: #3a434c;
}

/* 语言提示面板：限制高度滚动查看完整列表 */
.vditor-hint {
  max-height: 46vh;
  overflow-y: auto;
}

/* 语言提示面板搜索框（吸顶） */
.vditor-hint .rn-hint-search {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin: 0 0 4px;
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  outline: none;
  position: sticky;
  top: 0;
  z-index: 1;
  background-color: #ffffff;
}

.vditor-hint .rn-hint-search:focus {
  border-color: #0969da;
}

.vditor--dark .vditor-hint .rn-hint-search {
  background-color: #22272e;
  border-color: #444c56;
  color: #adbac7;
}

.vditor--dark .vditor-ir .vditor-ir__marker--info[data-type="code-block-info"] {
  background-color: #3a434c;
  border-color: #444c56;
  color: #adbac7;
}

.vditor--dark .vditor-ir .rn-code-fold {
  background-color: #2d333b;
  border-color: #444c56;
  color: #adbac7;
}

.vditor--dark .vditor-ir .rn-code-fold:hover {
  background-color: #37424c;
}
</style>
