<template>
  <div class="preview-wrapper" @contextmenu.prevent="onContextMenu">
    <div
      ref="previewContainer"
      class="markdown-preview"
      :class="{ dark: theme === 'dark' }"
      :style="{ fontSize: fontSize + 'px' }"
      v-html="renderedContent"
    ></div>

    <!-- 右键菜单（Teleport 到 body 避免被父容器 overflow 裁剪） -->
    <Teleport to="body">
      <div
        v-if="contextMenu.show"
        class="preview-ctx-overlay"
        @click="closeContextMenu"
        @contextmenu.prevent="closeContextMenu"
      >
        <div
          class="preview-ctx-menu"
          :class="{ dark: theme === 'dark' }"
          :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
          @click.stop
        >
          <div
            class="preview-ctx-item"
            :class="{ 'preview-ctx-item--disabled': !hasSelection }"
            @click="onCopy"
          >
            <v-icon size="16">mdi-content-copy</v-icon>
            <span>复制</span>
          </div>
          <div class="preview-ctx-divider" />
          <div class="preview-ctx-item" @click="onRefresh">
            <v-icon size="16">mdi-refresh</v-icon>
            <span>刷新</span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { renderMarkdown } from '@/utils/markdown'

const props = defineProps({
  /**
   * Markdown 内容
   * @type {string}
   */
  content: {
    type: String,
    default: ''
  },
  /**
   * 主题模式
   * @type {'light' | 'dark'}
   */
  theme: {
    type: String,
    default: 'light',
    validator: (value) => ['light', 'dark'].includes(value)
  },
  /**
   * 字体大小（像素）
   * @type {number}
   */
  fontSize: {
    type: Number,
    default: 14
  }
})

// ============ Emits ============

const emit = defineEmits(['reload'])

// ============ Refs ============

/** 预览容器的 DOM 引用 */
const previewContainer = ref(null)

/** 右键菜单状态 */
const contextMenu = reactive({
  show: false,
  x: 0,
  y: 0
})

/** 是否有文本被选中 */
const hasSelection = ref(false)

// ============ Computed ============

/**
 * 渲染后的 HTML 内容
 */
const renderedContent = computed(() => {
  if (!props.content) return ''
  return renderMarkdown(props.content)
})

// ============ Methods ============

/**
 * 滚动到指定 id 的标题元素
 * @param {string} id - 标题的锚点 ID
 */
function scrollToHeading(id) {
  nextTick(() => {
    const container = previewContainer.value
    if (!container) return

    try {
      const target = container.querySelector('#' + CSS.escape(id))
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    } catch (_) {
      // CSS.escape 可能在某些环境下不可用，静默忽略
    }
  })
}

/**
 * 获取预览区域中所有带 id 的标题 DOM 元素
 * @returns {NodeListOf<Element>|null}
 */
function getRenderedHeadings() {
  const container = previewContainer.value
  if (!container) return null
  return container.querySelectorAll('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]')
}

// ============ 右键菜单 ============

/**
 * 右键点击事件处理
 * @param {MouseEvent} event
 */
function onContextMenu(event) {
  // 检测是否有文本被选中
  const selection = window.getSelection()
  hasSelection.value = selection && selection.toString().trim().length > 0

  contextMenu.show = true
  contextMenu.x = event.clientX
  contextMenu.y = event.clientY
}

/** 关闭右键菜单 */
function closeContextMenu() {
  contextMenu.show = false
}

/** 点击"复制"菜单项 */
async function onCopy() {
  if (!hasSelection.value) return

  try {
    const selection = window.getSelection()
    await navigator.clipboard.writeText(selection.toString())
  } catch (err) {
    console.error('复制失败:', err)
  }

  closeContextMenu()
}

/** 点击"刷新"菜单项 */
function onRefresh() {
  closeContextMenu()
  emit('reload')
}

/** ESC 键关闭右键菜单 */
function handleKeydown(event) {
  if (event.key === 'Escape' && contextMenu.show) {
    closeContextMenu()
  }
}

// ============ Lifecycle ============

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

// ============ 暴露方法 ============

defineExpose({
  scrollToHeading,
  getRenderedHeadings,
  /** 预览容器 DOM 引用（供父组件注册 IntersectionObserver） */
  previewContainer
})
</script>

<style>
@import '@/styles/markdown.css';
</style>

<style scoped>
/* Preview 外层包裹容器 */
.preview-wrapper {
  height: 100%;
  overflow: hidden;
}
</style>

<style>
/* 右键菜单样式（非 scoped，因 Teleport 到 body 后 scoped 样式不生效） */

.preview-ctx-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
}

.preview-ctx-menu {
  position: fixed;
  min-width: 140px;
  background-color: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 4px 0;
  z-index: 10000;
}

.preview-ctx-menu.dark {
  background-color: #2a2a2a;
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.preview-ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.85);
  transition: background-color 0.1s;
  user-select: none;
}

.preview-ctx-item:hover {
  background-color: rgba(0, 0, 0, 0.06);
}

.dark .preview-ctx-item {
  color: rgba(255, 255, 255, 0.85);
}

.dark .preview-ctx-item:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

/* 禁用态 */
.preview-ctx-item--disabled {
  opacity: 0.4;
  cursor: default;
}

.preview-ctx-item--disabled:hover {
  background-color: transparent;
}

.dark .preview-ctx-item--disabled:hover {
  background-color: transparent;
}

/* 菜单分隔线 */
.preview-ctx-divider {
  height: 1px;
  margin: 4px 8px;
  background-color: rgba(0, 0, 0, 0.08);
}

.dark .preview-ctx-divider {
  background-color: rgba(255, 255, 255, 0.08);
}
</style>