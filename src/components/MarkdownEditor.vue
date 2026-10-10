<template>
  <div class="markdown-editor" :class="{ dark: theme === 'dark' }">
    <!-- 模式切换工具栏 -->
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <v-btn-toggle
          :model-value="mode"
          @update:model-value="handleModeChange"
          density="compact"
          variant="outlined"
          size="small"
          :color="theme === 'dark' ? 'white' : 'primary'"
        >
          <v-btn value="edit" size="small">
            <v-icon size="18">mdi-pencil</v-icon>
            <span class="btn-label">编辑</span>
          </v-btn>
          <v-btn value="split" size="small">
            <v-icon size="18">mdi-view-split-vertical</v-icon>
            <span class="btn-label">分屏</span>
          </v-btn>
          <v-btn value="preview" size="small">
            <v-icon size="18">mdi-eye</v-icon>
            <span class="btn-label">预览</span>
          </v-btn>
        </v-btn-toggle>

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
        v-if="tocVisible && content"
        :headings="headings"
        :active-id="tocActiveId"
        :theme="theme"
        :width="tocWidth"
        @close="tocVisible = false"
        @navigate="handleTocNavigate"
        @update:width="tocWidth = $event"
      />

      <!-- 编辑模式 -->
      <div v-show="mode === 'edit'" class="editor-pane full-pane">
        <Editor
          ref="editorRef"
          :model-value="content"
          @update:model-value="handleContentUpdate"
          :theme="theme"
          :font-size="Math.round(fontSize * zoomLevel / 100)"
          :on-save="handleSave"
          :on-theme-change="handleThemeChange"
        />
      </div>

      <!-- 预览模式 -->
      <div v-show="mode === 'preview'" class="preview-pane full-pane">
        <Preview
          ref="previewRef"
          :content="content"
          :theme="theme"
          :font-size="Math.round(fontSize * zoomLevel / 100)"
          @reload="() => emit('reload')"
        />
      </div>

      <!-- 分屏模式 -->
      <template v-if="mode === 'split'">
        <div class="editor-pane split-pane">
          <Editor
            ref="editorRef"
            :model-value="content"
            @update:model-value="handleContentUpdate"
            :theme="theme"
            :font-size="Math.round(fontSize * zoomLevel / 100)"
            :on-save="handleSave"
            :on-theme-change="handleThemeChange"
          />
        </div>
        <div class="split-divider" @mousedown="onDragStart"></div>
        <div class="preview-pane split-pane">
          <Preview
            ref="previewRef"
            :content="content"
            :theme="theme"
            :font-size="Math.round(fontSize * zoomLevel / 100)"
            @reload="() => emit('reload')"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, onUnmounted, nextTick } from 'vue'
import Editor from './Editor.vue'
import Preview from './Preview.vue'
import TocPanel from './TocPanel.vue'
import { extractHeadings } from '@/utils/toc'

// ============ Props ============

const props = defineProps({
  /** 编辑器内容 */
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
  /** 显示模式 ('edit' | 'preview' | 'split') */
  mode: {
    type: String,
    default: 'split',
    validator: (value) => ['edit', 'preview', 'split'].includes(value)
  },
  /** 字体大小（像素） */
  fontSize: {
    type: Number,
    default: 14
  },
  /** 缩放比例 (50-200) */
  zoomLevel: {
    type: Number,
    default: 100
  },
  /** 内容是否已修改（未保存） */
  modified: {
    type: Boolean,
    default: false
  }
})

// ============ Emits ============

const emit = defineEmits([
  'update:content',
  'update:mode',
  'save',
  'theme-change',
  'reload'
])

// ============ Refs ============

const editorRef = ref(null)

/** 预览组件引用 */
const previewRef = ref(null)

/** 分屏模式下的拖拽状态 */
let isDragging = false

/** 分屏比例（左侧编辑区占比，0~1） */
const splitRatio = ref(0.5)

/** TOC 面板是否可见 */
const tocVisible = ref(false)

/** TOC 面板宽度（持久化，不随 v-if 销毁重置） */
const tocWidth = ref(220)

/** 当前高亮的标题 ID */
const tocActiveId = ref('')

/** IntersectionObserver 实例 */
let headingObserver = null

// ============ 方法 ============

/**
 * 处理内容更新
 * @param {string} newContent - 新内容
 */
function handleContentUpdate(newContent) {
  emit('update:content', newContent)
}

/**
 * 处理模式切换
 * @param {string} newMode - 新模式
 */
function handleModeChange(newMode) {
  emit('update:mode', newMode)
  // 切换到编辑模式时自动聚焦编辑器
  if (newMode === 'edit' || newMode === 'split') {
    nextTick(() => {
      focus()
    })
  }
}

/**
 * 处理保存操作
 */
function handleSave() {
  emit('save')
}

/**
 * 处理主题变更
 * @param {string} newTheme - 新主题
 */
function handleThemeChange(newTheme) {
  emit('theme-change', newTheme)
}

/**
 * 获取编辑器当前内容
 * @returns {string} 编辑器文档内容
 */
function getContent() {
  if (editorRef.value) {
    return editorRef.value.getContent()
  }
  return props.content
}

/**
 * 设置编辑器内容
 * @param {string} content - 要设置的内容
 */
function setContent(content) {
  if (editorRef.value) {
    editorRef.value.setContent(content)
  }
}

/**
 * 聚焦编辑器
 */
function focus() {
  if (editorRef.value) {
    editorRef.value.focus()
  }
}

// ============ 分屏拖拽 ============

/**
 * 开始拖拽分屏分隔线
 * @param {MouseEvent} event
 */
function onDragStart(event) {
  if (props.mode !== 'split') return
  isDragging = true
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  event.preventDefault()
}

/**
 * 拖拽移动中
 * @param {MouseEvent} event
 */
function onDragMove(event) {
  if (!isDragging) return

  const contentEl = document.querySelector('.editor-content')
  if (!contentEl) return

  const rect = contentEl.getBoundingClientRect()

  // 扣除 TOC 面板宽度（如果可见）和分隔线宽度
  const tocPanel = contentEl.querySelector('.toc-panel')
  const tocWidth = tocPanel ? tocPanel.offsetWidth : 0
  const dividerWidth = 4
  const paneAreaWidth = rect.width - tocWidth - dividerWidth

  const x = event.clientX - rect.left - tocWidth - dividerWidth
  const ratio = Math.max(0.2, Math.min(0.8, x / paneAreaWidth))

  splitRatio.value = ratio
  updateSplitLayout()
}

/**
 * 拖拽结束
 */
function onDragEnd() {
  isDragging = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// ============ TOC 相关 ============

/** 从当前内容中提取的标题列表 */
const headings = computed(() => {
  return extractHeadings(props.content)
})

/**
 * 处理 TOC 导航：点击标题后的跳转
 * @param {{ id: string, line: number }} payload - 标题的 id 和行号
 */
function handleTocNavigate({ id, line }) {
  // 预览或分屏模式：滚动预览区域
  if ((props.mode === 'preview' || props.mode === 'split') && previewRef.value) {
    previewRef.value.scrollToHeading(id)
    tocActiveId.value = id
  }

  // 编辑模式：跳转到 CodeMirror 对应行
  if (props.mode === 'edit' && editorRef.value) {
    editorRef.value.scrollToLine(line)
    tocActiveId.value = id
  }
}

/**
 * 注册 IntersectionObserver 监听预览区标题可见性
 * 用于自动高亮当前阅读位置对应的标题
 */
function setupHeadingObserver() {
  clearHeadingObserver()

  if (!previewRef.value) return

  const container = previewRef.value.previewContainer
  if (!container) return

  // 等待 DOM 渲染完成
  nextTick(() => {
    const headings = previewRef.value.getRenderedHeadings()
    if (!headings || headings.length === 0) return

    // 用于追踪所有被观察标题的可见比例
    const visibilityMap = new Map()

    headingObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibilityMap.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0)
        }

        // 找出第一个可见的标题（intersectionRatio > 0 且最靠前）
        let firstVisibleId = ''
        for (const headingEl of headings) {
          const ratio = visibilityMap.get(headingEl.id) || 0
          if (ratio > 0) {
            firstVisibleId = headingEl.id
            break
          }
        }

        if (firstVisibleId) {
          tocActiveId.value = firstVisibleId
        }
      },
      {
        root: container,
        rootMargin: '-64px 0px -70% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1]
      }
    )

    for (const headingEl of headings) {
      headingObserver.observe(headingEl)
    }
  })
}

/** 清理 IntersectionObserver */
function clearHeadingObserver() {
  if (headingObserver) {
    headingObserver.disconnect()
    headingObserver = null
  }
}

/**
 * 更新分屏布局尺寸
 */
function updateSplitLayout() {
  const editorPane = document.querySelector('.split-pane.editor-pane')
  const previewPane = document.querySelector('.split-pane.preview-pane')
  if (editorPane && previewPane) {
    const ratio = splitRatio.value
    // 使用 flex-grow 按比例分配剩余空间（TOC 面板和分隔线固定宽度不参与分配）
    editorPane.style.flex = `${ratio} 1 0px`
    previewPane.style.flex = `${1 - ratio} 1 0px`
  }
}

// ============ Watchers ============

/**
 * 监听内容和 TOC 可见状态变化，重新注册 IntersectionObserver
 */
watch(() => [props.content, tocVisible.value, props.mode], () => {
  if (tocVisible.value && (props.mode === 'preview' || props.mode === 'split')) {
    nextTick(() => {
      setupHeadingObserver()
    })
  } else {
    clearHeadingObserver()
  }
})

/**
 * 监听模式变化，更新分屏布局
 */
watch(() => props.mode, (newMode) => {
  if (newMode === 'split') {
    nextTick(() => {
      updateSplitLayout()
    })
  }
})

// ============ 生命周期 ============

onMounted(() => {
  if (props.mode === 'split') {
    nextTick(() => {
      updateSplitLayout()
    })
  }
})

onBeforeUnmount(() => {
  // 清理 IntersectionObserver
  clearHeadingObserver()

  // 清理拖拽事件监听
  if (isDragging) {
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mouseup', onDragEnd)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
})

// ============ 暴露方法 ============

defineExpose({
  getContent,
  setContent,
  focus
})
</script>

<style scoped>
.markdown-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background-color: #ffffff;
  color: #24292f;
}

.markdown-editor.dark {
  background-color: #0d1117;
  color: #c9d1d9;
}

/* ============ 工具栏样式 ============ */

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-bottom: 1px solid #d0d7de;
  background-color: #f6f8fa;
  min-height: 40px;
  flex-shrink: 0;
}

.dark .editor-toolbar {
  border-bottom-color: #30363d;
  background-color: #161b22;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-label {
  margin-left: 4px;
  font-size: 12px;
}

/* TOC 按钮激活状态 */
.toc-btn-active :deep(.v-btn__overlay) {
  opacity: 0.12;
}

/* TOC 标题数量角标 */
.toc-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 2px;
  padding: 0 5px;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  min-width: 18px;
  height: 16px;
  border-radius: 8px;
  background-color: rgba(var(--v-theme-primary), 0.15);
  color: rgb(var(--v-theme-primary));
}

/* ============ 内容区域样式 ============ */

.editor-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.full-pane {
  flex: 1;
  min-width: 0;
  height: 100%;
}

.split-pane {
  height: 100%;
  overflow: hidden;
}

.split-pane.editor-pane {
  flex: 1 1 0%;
  min-width: 0;
}

.split-pane.preview-pane {
  flex: 1 1 0%;
  min-width: 0;
}

/* ============ 分屏分隔线样式 ============ */

.split-divider {
  width: 4px;
  cursor: col-resize;
  background-color: #d0d7de;
  flex-shrink: 0;
  transition: background-color 0.2s;
  position: relative;
}

.split-divider:hover {
  background-color: #0969da;
}

.dark .split-divider {
  background-color: #30363d;
}

.dark .split-divider:hover {
  background-color: #58a6ff;
}

/* ============ 深色主题工具栏按钮 ============ */

.dark .editor-toolbar :deep(.v-btn) {
  color: #c9d1d9;
}

.dark .editor-toolbar :deep(.v-btn--disabled) {
  color: #484f58 !important;
}

.dark .editor-toolbar :deep(.v-btn-toggle) {
  border-color: #30363d;
}
</style>
