<template>
  <div
    ref="panelRef"
    class="toc-panel"
    :class="{ dark: theme === 'dark' }"
    :style="{ width: `${currentWidth}px` }"
  >
    <!-- 拖拽调整宽度手柄 -->
    <div
      class="toc-resize-handle"
      @mousedown="onResizeStart"
    />

    <!-- 面板头部 -->
    <div class="toc-header">
      <span class="toc-title">目录</span>
      <v-btn
        icon
        size="x-small"
        variant="text"
        density="compact"
        @click="$emit('close')"
        title="关闭目录"
      >
        <v-icon size="16">mdi-close</v-icon>
      </v-btn>
    </div>

    <!-- 目录内容 -->
    <div class="toc-content" ref="tocContentRef">
      <!-- 空状态 -->
      <div v-if="safeHeadings.length === 0" class="toc-empty">
        <v-icon size="28" color="grey-lighten-1">mdi-text-box-outline</v-icon>
        <p class="empty-text">暂无标题</p>
      </div>

      <!-- 标题列表 -->
      <ul v-else class="toc-list">
        <li
          v-for="(heading, index) in safeHeadings"
          :key="`${heading.id}-${index}`"
          :class="[
            'toc-item',
            `toc-level-${heading.level}`,
            { 'is-active': activeId === heading.id }
          ]"
          :style="{ paddingLeft: paddingForLevel(heading.level) + 'px' }"
          :title="heading.text"
          @click="$emit('navigate', { id: heading.id, line: heading.line })"
        >
          <span class="toc-item-text">{{ heading.text }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'

// ============ Props ============

const props = defineProps({
  /** 标题列表，每项 { id, text, level, line } */
  headings: {
    type: Array,
    default: () => []
  },
  /** 当前激活的标题 ID */
  activeId: {
    type: String,
    default: ''
  },
  /** 主题模式 */
  theme: {
    type: String,
    default: 'light',
    validator: (value) => ['light', 'dark'].includes(value)
  },
  /** 面板宽度（像素） */
  width: {
    type: Number,
    default: 220
  }
})

// ============ Emits ============

const emit = defineEmits(['close', 'navigate', 'update:width'])

// ============ 防御性计算属性 ============

/** 标题列表防御：确保始终为数组，避免异常数据导致渲染失败出现空白面板 */
const safeHeadings = computed(() => (Array.isArray(props.headings) ? props.headings : []))

// ============ Refs ============

const panelRef = ref(null)
const tocContentRef = ref(null)

/** 当前面板宽度（同步自 prop，拖拽时实时更新） */
const currentWidth = ref(props.width)

// 同步外部 width prop 变化
watch(() => props.width, (val) => {
  currentWidth.value = val
})

// ============ 宽度调整 ============

/** 最小宽度 */
const MIN_WIDTH = 150
/** 最大宽度 */
const MAX_WIDTH = 400
/** 是否正在调整宽度 */
let isResizing = false
/** 调整起始 X */
let startX = 0
/** 调整起始宽度 */
let startWidth = 0

/**
 * 开始拖拽调整宽度
 * @param {MouseEvent} event
 */
function onResizeStart(event) {
  isResizing = true
  startX = event.clientX
  startWidth = currentWidth.value

  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  event.preventDefault()
}

/**
 * 拖拽移动中
 * @param {MouseEvent} event
 */
function onResizeMove(event) {
  if (!isResizing) return

  const deltaX = event.clientX - startX
  const newWidth = startWidth + deltaX
  const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth))

  currentWidth.value = clampedWidth
}

/**
 * 拖拽结束
 */
function onResizeEnd() {
  isResizing = false
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''

  // 通知父组件持久化宽度
  emit('update:width', currentWidth.value)
}

// ============ Lifecycle ============

onUnmounted(() => {
  if (isResizing) {
    document.removeEventListener('mousemove', onResizeMove)
    document.removeEventListener('mouseup', onResizeEnd)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
})

// ============ Methods ============

/**
 * 根据标题层级计算左侧缩进
 * @param {number} level - 标题层级 (1-6)
 * @returns {number} 左侧内边距像素值
 */
function paddingForLevel(level) {
  return Math.min(level, 6) * 16 + 4
}
</script>

<style scoped>
.toc-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: rgb(var(--v-theme-surface));
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  min-width: 150px;
  max-width: 400px;
  overflow: hidden;
  flex-shrink: 0;
}

.toc-panel.dark {
  border-right-color: rgba(255, 255, 255, 0.08);
}

/* 拖拽手柄 */
.toc-resize-handle {
  position: absolute;
  top: 0;
  right: -4px;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
}

.toc-resize-handle:hover {
  background-color: rgba(var(--v-theme-primary), 0.2);
}

/* 头部 */
.toc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px 6px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  min-height: 36px;
  flex-shrink: 0;
}

.dark .toc-header {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.toc-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.8);
  user-select: none;
}

.dark .toc-title {
  color: rgba(255, 255, 255, 0.8);
}

/* 内容区域 */
.toc-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 0;
}

/* 空状态 */
.toc-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  gap: 8px;
}

.empty-text {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.4);
  margin: 0;
  user-select: none;
}

.dark .empty-text {
  color: rgba(255, 255, 255, 0.4);
}

/* 标题列表 */
.toc-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

/* 标题项 */
.toc-item {
  display: flex;
  align-items: center;
  padding: 4px 12px 4px 0;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.12s ease;
  border-left: 3px solid transparent;
}

.toc-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.dark .toc-item:hover {
  background-color: rgba(255, 255, 255, 0.06);
}

.toc-item.is-active {
  background-color: rgba(var(--v-theme-primary), 0.1);
  border-left-color: rgb(var(--v-theme-primary));
}

.dark .toc-item.is-active {
  background-color: rgba(var(--v-theme-primary), 0.16);
}

/* 标题文本 */
.toc-item-text {
  font-size: 13px;
  line-height: 1.6;
  color: rgba(0, 0, 0, 0.75);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dark .toc-item-text {
  color: rgba(255, 255, 255, 0.75);
}

.toc-item.is-active .toc-item-text {
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}

/* 层级样式微调 */
.toc-level-1 .toc-item-text { font-size: 14px; font-weight: 600; }
.toc-level-2 .toc-item-text { font-size: 13px; }
.toc-level-3 .toc-item-text,
.toc-level-4 .toc-item-text,
.toc-level-5 .toc-item-text,
.toc-level-6 .toc-item-text { font-size: 12px; color: rgba(0, 0, 0, 0.6); }

.dark .toc-level-3 .toc-item-text,
.dark .toc-level-4 .toc-item-text,
.dark .toc-level-5 .toc-item-text,
.dark .toc-level-6 .toc-item-text { color: rgba(255, 255, 255, 0.55); }
</style>
