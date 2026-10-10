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
      <div class="toolbar-right">
        <v-btn
          size="small"
          variant="text"
          :color="theme === 'dark' ? 'white' : 'default'"
          @click="shortcutDialogVisible = true"
          title="快捷键设置"
        >
          <v-icon size="18">mdi-keyboard</v-icon>
          <span class="btn-label">快捷键</span>
        </v-btn>
        <v-btn
          size="small"
          variant="text"
          :color="theme === 'dark' ? 'white' : 'default'"
          @click="handleReload"
          title="从磁盘重新加载"
        >
          <v-icon size="18">mdi-refresh</v-icon>
          <span class="btn-label">刷新</span>
        </v-btn>
        <v-btn
          size="small"
          variant="text"
          :color="theme === 'dark' ? 'white' : 'default'"
          @click="handleSave"
          :disabled="!modified"
          title="保存 (Ctrl+S)"
        >
          <v-icon size="18">mdi-content-save</v-icon>
          <span class="btn-label">保存</span>
        </v-btn>
      </div>
    </div>

    <!-- 编辑器内容区域 -->
    <div class="editor-content">
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

    <!-- 快捷键设置对话框 -->
    <ShortcutDialog v-model="shortcutDialogVisible" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import TocPanel from './TocPanel.vue'
import ShortcutDialog from './ShortcutDialog.vue'
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

/** 快捷键设置对话框可见性 */
const shortcutDialogVisible = ref(false)

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
    preview: { maxWidth: 100000 },
    toolbarConfig: { pin: true },
    // 精简工具栏：只保留高频操作，不放源码/分屏模式切换按钮，保持纯 IR
    toolbar: [
      'headings', 'bold', 'italic', 'strike', '|',
      'list', 'ordered-list', 'check', 'outdent', 'indent', '|',
      'quote', 'line', 'code', 'inline-code', 'insert-before', 'insert-after', '|',
      'link', 'table', '|', 'undo', 'redo', '|', 'fullscreen', 'export'
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

function handleReload() {
  emit('reload')
}

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
</style>
