<template>
  <div
    class="file-tree-node"
    :class="{
      'is-selected': isSelected,
      'is-directory': node.isDirectory,
      'is-drag-over': isDragOver,
      'is-dragging': isDragging
    }"
    :style="{ '--depth': depth }"
    draggable="true"
    @dragstart="onDragStart"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
    @dragend="onDragEnd"
    @contextmenu.prevent="onContextMenu"
  >
    <!-- 节点行 -->
    <div
      class="node-row"
      @click="onNodeClick"
    >
      <!-- 缩进 -->
      <div class="node-indent" :style="{ width: `${depth * 16}px` }" />

      <!-- 展开/折叠箭头 -->
      <v-icon
        v-if="node.isDirectory"
        class="node-toggle"
        :class="{ 'is-expanded': isExpanded }"
        size="18"
        @click.stop="toggleExpand"
      >
        {{ isExpanded ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
      </v-icon>
      <div v-else class="node-toggle-placeholder" />

      <!-- 文件/文件夹图标 -->
      <v-icon
        class="node-icon"
        :color="iconColor"
        size="20"
      >
        {{ iconName }}
      </v-icon>

      <!-- 文件名 -->
      <span class="node-name" :title="node.path">
        {{ node.name }}
      </span>

      <!-- 收藏标记 -->
      <v-icon
        v-if="isBookmarked"
        class="node-bookmark"
        size="14"
        color="amber"
      >
        mdi-star
      </v-icon>
    </div>

    <!-- 子节点（文件夹展开时渲染） -->
    <div v-if="node.isDirectory && isExpanded && hasChildren" class="node-children">
      <FileTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :selected-path="selectedPath"
        :bookmarked-files="bookmarkedFiles"
        @select="(...args) => emit('select', ...args)"
        @context-menu="(...args) => emit('context-menu', ...args)"
        @create="(...args) => emit('create', ...args)"
        @move="(...args) => emit('move', ...args)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, watch, onMounted } from 'vue'
import { getFileType } from '@/utils/fileSystem'

// ============================================================
// Props & Emits
// ============================================================

const props = defineProps({
  /** 文件树节点数据 */
  node: {
    type: Object,
    required: true,
    validator(value) {
      return value && typeof value.name === 'string' && typeof value.path === 'string'
    }
  },
  /** 当前节点在树中的深度层级 */
  depth: {
    type: Number,
    default: 0
  },
  /** 当前选中的文件路径 */
  selectedPath: {
    type: String,
    default: ''
  },
  /** 已收藏的文件路径集合 */
  bookmarkedFiles: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'select',
  'context-menu',
  'create',
  'move'
])

// ============================================================
// Inject
// ============================================================

/** 设置存储 */
const settingsStore = inject('settingsStore')

// ============================================================
// State
// ============================================================

/** 文件夹是否展开 - 使用计算属性从 settingsStore 获取 */
const isExpanded = computed({
  get() {
    return settingsStore?.expandedPaths?.includes(props.node.path) ?? false
  },
  set(value) {
    if (!settingsStore) return
    if (value) {
      settingsStore.addExpandedPath(props.node.path)
    } else {
      settingsStore.removeExpandedPath(props.node.path)
    }
  }
})

/** 拖拽状态 */
const isDragging = ref(false)
const isDragOver = ref(false)

// ============================================================
// Computed
// ============================================================

/** 当前节点是否被选中 */
const isSelected = computed(() => {
  return props.selectedPath === props.node.path
})

/** 当前节点是否已收藏 */
const isBookmarked = computed(() => {
  return props.bookmarkedFiles.includes(props.node.path)
})

/** 是否有子节点 */
const hasChildren = computed(() => {
  return Array.isArray(props.node.children) && props.node.children.length > 0
})

/** 根据文件类型返回图标名称 */
const iconName = computed(() => {
  if (props.node.isDirectory) {
    return isExpanded.value ? 'mdi-folder-open' : 'mdi-folder'
  }

  const fileType = getFileType(props.node.path)

  switch (fileType) {
    case 'markdown':
      return 'mdi-language-markdown'
    case 'image':
      return 'mdi-image-outline'
    case 'code':
      return 'mdi-code-tags'
    case 'text':
      return 'mdi-file-document-outline'
    default:
      return 'mdi-file-outline'
  }
})

/** 根据文件类型返回图标颜色 */
const iconColor = computed(() => {
  if (props.node.isDirectory) {
    return 'amber'
  }

  const fileType = getFileType(props.node.path)

  switch (fileType) {
    case 'markdown':
      return 'blue'
    case 'image':
      return 'purple'
    case 'code':
      return 'green'
    case 'text':
      return 'grey'
    default:
      return 'grey-darken-1'
  }
})

// ============================================================
// Methods
// ============================================================

/** 切换文件夹展开/折叠 */
function toggleExpand() {
  if (props.node.isDirectory) {
    isExpanded.value = !isExpanded.value
  }
}

/** 点击节点 */
function onNodeClick() {
  if (props.node.isDirectory) {
    toggleExpand()
  }
  emit('select', {
    path: props.node.path,
    name: props.node.name,
    isDirectory: props.node.isDirectory,
    isFile: props.node.isFile
  })
}

/** 右键菜单 */
function onContextMenu(event) {
  // 阻止冒泡：外层父节点的 .file-tree-node 容器也监听 contextmenu，
  // 若不阻止，子节点右键会被父节点覆盖，导致菜单目标变成一级目录
  event.stopPropagation()
  emit('context-menu', {
    event,
    node: {
      path: props.node.path,
      name: props.node.name,
      isDirectory: props.node.isDirectory,
      isFile: props.node.isFile
    }
  })
}

// ============================================================
// 拖拽处理
// ============================================================

function onDragStart(event) {
  isDragging.value = true
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('application/json', JSON.stringify({
    path: props.node.path,
    name: props.node.name,
    isDirectory: props.node.isDirectory
  }))
  // 设置拖拽图像（使用节点行元素）
  const rowEl = event.target.closest('.node-row')
  if (rowEl) {
    event.dataTransfer.setDragImage(rowEl, 0, 0)
  }
}

function onDragOver(event) {
  // 只允许拖入文件夹
  if (props.node.isDirectory) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    isDragOver.value = true
  }
}

function onDragLeave() {
  isDragOver.value = false
}

function onDrop(event) {
  event.preventDefault()
  isDragOver.value = false

  try {
    const data = JSON.parse(event.dataTransfer.getData('application/json'))
    // 不允许拖入自身
    if (data.path === props.node.path) return
    // 不允许拖入自己的子目录（防止循环）
    if (props.node.path.startsWith(data.path)) return

    emit('move', {
      source: data,
      target: {
        path: props.node.path,
        name: props.node.name,
        isDirectory: props.node.isDirectory
      }
    })
  } catch {
    // 忽略无效的拖拽数据
  }
}

function onDragEnd() {
  isDragging.value = false
  isDragOver.value = false
}
</script>

<style scoped>
.file-tree-node {
  user-select: none;
  cursor: pointer;
}

/* 节点行 */
.node-row {
  display: flex;
  align-items: center;
  height: 28px;
  padding-right: 8px;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.node-row:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

/* 选中状态 */
.is-selected > .node-row {
  background-color: rgba(25, 118, 210, 0.12);
}

.is-selected > .node-row:hover {
  background-color: rgba(25, 118, 210, 0.18);
}

/* 拖拽目标高亮 */
.is-drag-over > .node-row {
  background-color: rgba(25, 118, 210, 0.08);
  outline: 1px dashed rgba(25, 118, 210, 0.5);
  outline-offset: -1px;
}

/* 拖拽中的源节点半透明 */
.is-dragging {
  opacity: 0.5;
}

/* 缩进区域 */
.node-indent {
  flex-shrink: 0;
}

/* 展开/折叠箭头 */
.node-toggle {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  margin-right: 2px;
  transition: transform 0.15s ease;
}

.node-toggle.is-expanded {
  transform: rotate(0deg);
}

/* 箭头占位（文件节点对齐用） */
.node-toggle-placeholder {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  margin-right: 2px;
}

/* 文件图标 */
.node-icon {
  flex-shrink: 0;
  margin-right: 6px;
}

/* 文件名 */
.node-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  line-height: 28px;
}

/* 收藏标记 */
.node-bookmark {
  flex-shrink: 0;
  margin-left: 4px;
}

/* 子节点容器 */
.node-children {
  /* 子节点无需额外样式，缩进由 depth prop 控制 */
}

/* 暗色主题适配 */
:deep(.v-theme--dark) .node-row:hover {
  background-color: rgba(255, 255, 255, 0.06);
}

:deep(.v-theme--dark) .is-selected > .node-row {
  background-color: rgba(33, 150, 243, 0.16);
}

:deep(.v-theme--dark) .is-selected > .node-row:hover {
  background-color: rgba(33, 150, 243, 0.22);
}

:deep(.v-theme--dark) .is-drag-over > .node-row {
  background-color: rgba(33, 150, 243, 0.1);
  outline-color: rgba(33, 150, 243, 0.5);
}
</style>
