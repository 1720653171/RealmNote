<template>
  <div
    class="sidebar"
    :class="{ 'is-collapsed': !modelValue }"
    :style="{ width: `${width}px` }"
  >
    <!-- 拖拽调整宽度手柄 -->
    <div
      v-if="modelValue"
      class="sidebar-resize-handle"
      @mousedown="onResizeStart"
    />

    <!-- 折叠/展开切换按钮 -->
    <div class="sidebar-toggle-area">
      <v-btn
        icon
        size="small"
        variant="text"
        density="compact"
        class="sidebar-toggle-btn"
        :title="modelValue ? '折叠侧边栏 (Ctrl+B)' : '展开侧边栏 (Ctrl+B)'"
        @click="onToggleCollapse"
      >
        <v-icon size="18">
          {{ modelValue ? 'mdi-chevron-left' : 'mdi-chevron-right' }}
        </v-icon>
      </v-btn>
    </div>

    <!-- 主内容区域 -->
    <div class="sidebar-content" v-show="modelValue">
      <!-- 文件树区域（主要部分） -->
      <div class="file-tree-section">
        <FileTree
          ref="fileTreeRef"
          @file-select="onFileSelect"
        />
      </div>

      <!-- 收藏列表区域（可折叠） -->
      <div class="bookmarks-section">
        <!-- 收藏列表标题 -->
        <div
          class="bookmarks-header"
          @click="toggleBookmarks"
        >
          <v-icon
            size="18"
            class="bookmarks-toggle"
            :class="{ 'is-expanded': bookmarksExpanded }"
          >
            {{ bookmarksExpanded ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
          </v-icon>
          <span class="bookmarks-title">收藏</span>
          <span v-if="bookmarkedFilesCount > 0" class="bookmarks-count">
            {{ bookmarkedFilesCount }}
          </span>
        </div>

        <!-- 收藏列表内容 -->
        <Transition name="collapse">
          <div v-show="bookmarksExpanded" class="bookmarks-content">
            <!-- 空状态 -->
            <div v-if="bookmarkedFilesCount === 0" class="bookmarks-empty">
              <v-icon size="32" color="grey-lighten-1">mdi-star-outline</v-icon>
              <p class="empty-text">暂无收藏的文件</p>
            </div>

            <!-- 收藏文件列表 -->
            <div v-else class="bookmarks-list">
              <div
                v-for="file in bookmarkedFilesList"
                :key="file.path"
                class="bookmark-item"
                :class="{ 'is-active': isActiveFile(file.path) }"
                @click="onBookmarkClick(file)"
              >
                <v-icon size="16" color="amber">mdi-star</v-icon>
                <span class="bookmark-name" :title="file.path">{{ file.name }}</span>
                <v-btn
                  icon
                  size="x-small"
                  variant="text"
                  class="bookmark-remove"
                  @click.stop="onRemoveBookmark(file.path)"
                >
                  <v-icon size="14">mdi-close</v-icon>
                </v-btn>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted, onUnmounted } from 'vue'
import FileTree from './FileTree.vue'

// ============================================================
// Props & Emits
// ============================================================

const props = defineProps({
  /** v-model 绑定值（可用于控制显示/隐藏等） */
  modelValue: {
    type: Boolean,
    default: true
  },
  /** 侧边栏宽度（像素） */
  width: {
    type: Number,
    default: 280
  }
})

const emit = defineEmits([
  'update:modelValue',
  'update:width',
  'open-folder',
  'file-select'
])

// ============================================================
// Inject
// ============================================================

/** @type {import('@/stores/fileStore').ReturnType<typeof useFileStore>} */
const fileStore = inject('fileStore')

// ============================================================
// Refs
// ============================================================

/** FileTree 组件实例引用 */
const fileTreeRef = ref(null)

/** 收藏列表是否展开 */
const bookmarksExpanded = ref(true)

/** 是否正在调整宽度 */
const isResizing = ref(false)

/** 调整宽度时的起始 X 坐标 */
const resizeStartX = ref(0)

/** 调整宽度时的起始宽度 */
const resizeStartWidth = ref(0)

// ============================================================
// Computed
// ============================================================

/** 已收藏文件数量 */
const bookmarkedFilesCount = computed(() => {
  return fileStore?.bookmarkedFiles?.size || 0
})

/** 已收藏文件列表（转换为数组） */
const bookmarkedFilesList = computed(() => {
  if (!fileStore?.bookmarkedFiles) return []

  const paths = Array.from(fileStore.bookmarkedFiles)
  return paths.map(path => {
    // 从路径中提取文件名
    const name = path.split(/[/\\]/).pop() || path
    return { path, name }
  })
})

// ============================================================
// Methods
// ============================================================

/**
 * 切换侧边栏折叠/展开状态
 */
function onToggleCollapse() {
  emit('update:modelValue', !props.modelValue)
}

/**
 * 切换收藏列表展开/折叠状态
 */
function toggleBookmarks() {
  bookmarksExpanded.value = !bookmarksExpanded.value
}

/**
 * 判断文件是否为当前激活文件
 * @param {string} path - 文件路径
 * @returns {boolean}
 */
function isActiveFile(path) {
  return fileStore?.activeFilePath === path
}

/**
 * 文件选择事件处理
 * @param {Object} fileInfo - 文件信息
 */
function onFileSelect(fileInfo) {
  emit('file-select', fileInfo)
}

/**
 * 点击收藏文件
 * @param {Object} file - 文件信息 { path, name }
 */
async function onBookmarkClick(file) {
  if (fileStore) {
    await fileStore.openFile(file.path)
  }
}

/**
 * 移除收藏
 * @param {string} path - 文件路径
 */
function onRemoveBookmark(path) {
  if (fileStore) {
    fileStore.toggleBookmark(path)
  }
}

// ============================================================
// 宽度调整
// ============================================================

/** 最小宽度 */
const MIN_WIDTH = 200

/** 最大宽度 */
const MAX_WIDTH = 500

/**
 * 开始调整宽度
 * @param {MouseEvent} event
 */
function onResizeStart(event) {
  isResizing.value = true
  resizeStartX.value = event.clientX
  resizeStartWidth.value = props.width

  // 添加全局事件监听
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)

  // 防止文本选择
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

/**
 * 调整宽度移动中
 * @param {MouseEvent} event
 */
function onResizeMove(event) {
  if (!isResizing.value) return

  const deltaX = event.clientX - resizeStartX.value
  const newWidth = resizeStartWidth.value + deltaX

  // 限制宽度范围
  const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth))

  emit('update:width', clampedWidth)
}

/**
 * 结束调整宽度
 */
function onResizeEnd() {
  if (!isResizing.value) return

  isResizing.value = false

  // 移除全局事件监听
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)

  // 恢复默认样式
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// ============================================================
// Lifecycle
// ============================================================

/**
 * 组件卸载时清理事件监听
 */
onUnmounted(() => {
  if (isResizing.value) {
    document.removeEventListener('mousemove', onResizeMove)
    document.removeEventListener('mouseup', onResizeEnd)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
})
</script>

<style scoped>
.sidebar {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: rgb(var(--v-theme-surface));
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  min-width: 200px;
  max-width: 500px;
  transition: min-width 0.2s ease;
}

/* 折叠状态：宽度收缩到 48px */
.sidebar.is-collapsed {
  min-width: 48px;
  max-width: 48px;
}

/* 折叠按钮容器 */
.sidebar-toggle-area {
  display: flex;
  justify-content: flex-end;
  padding: 4px 6px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  min-height: 36px;
}

.sidebar-toggle-btn {
  opacity: 0.5;
  transition: opacity 0.15s ease;
}

.sidebar-toggle-btn:hover {
  opacity: 1;
}

/* 暗色主题适配 */
:deep(.v-theme--dark) .sidebar-toggle-area {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

/* 调整宽度手柄 */
.sidebar-resize-handle {
  position: absolute;
  top: 0;
  right: -4px;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
}

.sidebar-resize-handle:hover {
  background-color: rgba(var(--v-theme-primary), 0.2);
}

/* 主内容区域 */
.sidebar-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

/* 文件树区域 */
.file-tree-section {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 收藏区域 */
.bookmarks-section {
  flex-shrink: 0;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

/* 收藏列表标题 */
.bookmarks-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s ease;
}

.bookmarks-header:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.bookmarks-toggle {
  margin-right: 4px;
  transition: transform 0.2s ease;
}

.bookmarks-toggle.is-expanded {
  transform: rotate(0deg);
}

.bookmarks-title {
  font-size: 13px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.7);
}

.bookmarks-count {
  margin-left: 8px;
  padding: 0 6px;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.5);
  background-color: rgba(0, 0, 0, 0.08);
  border-radius: 10px;
}

/* 收藏列表内容 */
.bookmarks-content {
  max-height: 200px;
  overflow-y: auto;
}

/* 空状态 */
.bookmarks-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  gap: 8px;
}

.empty-text {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.4);
  margin: 0;
}

/* 收藏列表 */
.bookmarks-list {
  padding: 4px 0;
}

/* 收藏项 */
.bookmark-item {
  display: flex;
  align-items: center;
  padding: 6px 12px 6px 24px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.bookmark-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.bookmark-item.is-active {
  background-color: rgba(var(--v-theme-primary), 0.12);
}

.bookmark-item .v-icon {
  margin-right: 8px;
  flex-shrink: 0;
}

.bookmark-name {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bookmark-remove {
  opacity: 0;
  transition: opacity 0.15s ease;
}

.bookmark-item:hover .bookmark-remove {
  opacity: 1;
}

/* 折叠动画 */
.collapse-enter-active,
.collapse-leave-active {
  transition: max-height 0.2s ease, opacity 0.2s ease;
}

.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  max-height: 200px;
  opacity: 1;
}

/* 暗色主题适配 */
:deep(.v-theme--dark) .sidebar {
  border-right-color: rgba(255, 255, 255, 0.08);
}

:deep(.v-theme--dark) .bookmarks-section {
  border-top-color: rgba(255, 255, 255, 0.08);
}

:deep(.v-theme--dark) .bookmarks-header:hover {
  background-color: rgba(255, 255, 255, 0.06);
}

:deep(.v-theme--dark) .bookmarks-title {
  color: rgba(255, 255, 255, 0.7);
}

:deep(.v-theme--dark) .bookmarks-count {
  color: rgba(255, 255, 255, 0.5);
  background-color: rgba(255, 255, 255, 0.1);
}

:deep(.v-theme--dark) .empty-text {
  color: rgba(255, 255, 255, 0.4);
}

:deep(.v-theme--dark) .bookmark-item:hover {
  background-color: rgba(255, 255, 255, 0.06);
}

:deep(.v-theme--dark) .bookmark-item.is-active {
  background-color: rgba(var(--v-theme-primary), 0.16);
}
</style>
