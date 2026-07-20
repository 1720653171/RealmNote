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
      <!-- 编辑模式 -->
      <div v-show="mode === 'edit'" class="editor-pane full-pane">
        <Editor
          ref="editorRef"
          :model-value="content"
          @update:model-value="handleContentUpdate"
          :theme="theme"
          :font-size="fontSize"
          :on-save="handleSave"
          :on-theme-change="handleThemeChange"
        />
      </div>

      <!-- 预览模式 -->
      <div v-show="mode === 'preview'" class="preview-pane full-pane">
        <Preview
          :content="content"
          :theme="theme"
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
            :font-size="fontSize"
            :on-save="handleSave"
            :on-theme-change="handleThemeChange"
          />
        </div>
        <div class="split-divider" @mousedown="onDragStart"></div>
        <div class="preview-pane split-pane">
          <Preview
            :content="content"
            :theme="theme"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Editor from './Editor.vue'
import Preview from './Preview.vue'

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
  'theme-change'
])

// ============ Refs ============

const editorRef = ref(null)

/** 分屏模式下的拖拽状态 */
let isDragging = false

/** 分屏比例（左侧编辑区占比，0~1） */
const splitRatio = ref(0.5)

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
  const x = event.clientX - rect.left
  const ratio = Math.max(0.2, Math.min(0.8, x / rect.width))
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

/**
 * 更新分屏布局尺寸
 */
function updateSplitLayout() {
  const editorPane = document.querySelector('.split-pane.editor-pane')
  const previewPane = document.querySelector('.split-pane.preview-pane')
  if (editorPane && previewPane) {
    const percentage = (splitRatio.value * 100).toFixed(2)
    editorPane.style.flex = `0 0 calc(${percentage}% - 2px)`
    previewPane.style.flex = `0 0 calc(${100 - percentage}% - 2px)`
  }
}

// ============ Watchers ============

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

/* ============ 内容区域样式 ============ */

.editor-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.full-pane {
  width: 100%;
  height: 100%;
}

.split-pane {
  height: 100%;
  overflow: hidden;
}

.split-pane.editor-pane {
  flex: 0 0 calc(50% - 2px);
}

.split-pane.preview-pane {
  flex: 0 0 calc(50% - 2px);
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
