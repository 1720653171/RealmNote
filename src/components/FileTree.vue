<template>
  <div class="file-tree">
    <!-- 工具栏 -->
    <div class="file-tree-toolbar">
      <!-- 搜索栏 -->
      <v-text-field
        v-model="searchQuery"
        placeholder="搜索文件..."
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
        density="compact"
        hide-details
        clearable
        class="search-input"
        @update:model-value="onSearchChange"
      />

      <!-- 操作按钮 -->
      <div class="toolbar-actions">
        <v-btn
          icon
          size="small"
          variant="text"
          title="新建文件"
          :disabled="!fileStore?.currentFolder"
          @click="onCreateFile"
        >
          <v-icon size="18">mdi-file-plus-outline</v-icon>
        </v-btn>

        <v-btn
          icon
          size="small"
          variant="text"
          title="新建文件夹"
          :disabled="!fileStore?.currentFolder"
          @click="onCreateFolder"
        >
          <v-icon size="18">mdi-folder-plus-outline</v-icon>
        </v-btn>

        <v-btn
          icon
          size="small"
          variant="text"
          title="刷新"
          :disabled="!fileStore?.currentFolder"
          @click="onRefresh"
        >
          <v-icon size="18">mdi-refresh</v-icon>
        </v-btn>
      </div>
    </div>

    <!-- 文件树内容区域 -->
    <div class="file-tree-content">
      <!-- 加载状态 -->
      <div v-if="fileStore?.loading" class="loading-state">
        <v-progress-circular indeterminate color="primary" size="32" />
        <span class="loading-text">加载中...</span>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!fileStore?.currentFolder" class="empty-state">
        <v-icon size="48" color="grey-lighten-1">mdi-folder-outline</v-icon>
        <p class="empty-text">打开文件夹以查看文件</p>
        <v-btn
          color="primary"
          variant="outlined"
          size="small"
          @click="onOpenFolder"
        >
          <v-icon start>mdi-folder-open-outline</v-icon>
          打开文件夹
        </v-btn>
      </div>

      <!-- 搜索无结果 -->
      <div v-else-if="searchQuery && filteredTree.length === 0" class="empty-state">
        <v-icon size="48" color="grey-lighten-1">mdi-file-search-outline</v-icon>
        <p class="empty-text">未找到匹配的文件</p>
      </div>

      <!-- 文件树 -->
      <div v-else-if="filteredTree.length > 0" class="tree-root">
        <FileTreeNode
          v-for="node in filteredTree"
          :key="node.path"
          :node="node"
          :depth="0"
          :selected-path="fileStore?.activeFilePath || ''"
          :bookmarked-files="bookmarkedFilesArray"
          @select="onNodeSelect"
          @context-menu="onNodeContextMenu"
          @create="onNodeCreate"
          @move="onNodeMove"
        />
      </div>

      <!-- 空文件夹 -->
      <div v-else class="empty-state">
        <v-icon size="48" color="grey-lighten-1">mdi-folder-outline</v-icon>
        <p class="empty-text">文件夹为空</p>
      </div>
    </div>

    <!-- 右键菜单 -->
    <v-menu
      v-model="contextMenuVisible"
      :target="contextMenuTarget"
      location="bottom start"
    >
      <v-list density="compact" class="context-menu">
        <!-- 新建 -->
        <v-list-item
          v-if="contextMenuNode?.isDirectory"
          @click="onContextCreateFile"
        >
          <template #prepend>
            <v-icon size="18">mdi-file-plus-outline</v-icon>
          </template>
          <v-list-item-title>新建文件</v-list-item-title>
        </v-list-item>

        <v-list-item
          v-if="contextMenuNode?.isDirectory"
          @click="onContextCreateFolder"
        >
          <template #prepend>
            <v-icon size="18">mdi-folder-plus-outline</v-icon>
          </template>
          <v-list-item-title>新建文件夹</v-list-item-title>
        </v-list-item>

        <v-divider v-if="contextMenuNode?.isDirectory" />

        <!-- 重命名 -->
        <v-list-item @click="onContextRename">
          <template #prepend>
            <v-icon size="18">mdi-rename-outline</v-icon>
          </template>
          <v-list-item-title>重命名</v-list-item-title>
        </v-list-item>

        <!-- 删除 -->
        <v-list-item @click="onContextDelete">
          <template #prepend>
            <v-icon size="18" color="error">mdi-delete-outline</v-icon>
          </template>
          <v-list-item-title class="text-error">删除</v-list-item-title>
        </v-list-item>

        <v-divider />

        <!-- 收藏 -->
        <v-list-item
          v-if="contextMenuNode?.isFile"
          @click="onContextToggleBookmark"
        >
          <template #prepend>
            <v-icon size="18">
              {{ isBookmarked(contextMenuNode?.path) ? 'mdi-star' : 'mdi-star-outline' }}
            </v-icon>
          </template>
          <v-list-item-title>
            {{ isBookmarked(contextMenuNode?.path) ? '取消收藏' : '添加收藏' }}
          </v-list-item-title>
        </v-list-item>

        <!-- 复制路径 -->
        <v-list-item @click="onContextCopyPath">
          <template #prepend>
            <v-icon size="18">mdi-content-copy</v-icon>
          </template>
          <v-list-item-title>复制路径</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>

    <!-- 新建/重命名对话框 -->
    <v-dialog
      v-model="dialogVisible"
      max-width="400"
      persistent
    >
      <v-card>
        <v-card-title class="text-body-1">
          {{ dialogTitle }}
        </v-card-title>

        <v-card-text>
          <v-text-field
            v-model="dialogInputValue"
            :label="dialogInputLabel"
            :placeholder="dialogInputPlaceholder"
            variant="outlined"
            density="compact"
            hide-details
            autofocus
            @keydown.enter="onDialogConfirm"
            @keydown.escape="onDialogCancel"
          />
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="onDialogCancel">取消</v-btn>
          <v-btn
            variant="text"
            color="primary"
            :disabled="!dialogInputValue.trim()"
            @click="onDialogConfirm"
          >
            确认
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 删除确认对话框 -->
    <v-dialog
      v-model="deleteConfirmVisible"
      max-width="400"
    >
      <v-card>
        <v-card-title class="text-body-1">确认删除</v-card-title>
        <v-card-text>
          确定要删除 "{{ deleteTargetName }}" 吗？
          <br />
          <span class="text-caption text-warning">此操作无法撤销。</span>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteConfirmVisible = false">取消</v-btn>
          <v-btn variant="text" color="error" @click="onConfirmDelete">删除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, inject } from 'vue'
import FileTreeNode from './FileTreeNode.vue'

// ============================================================
// Inject
// ============================================================

/** @type {import('@/stores/fileStore').ReturnType<typeof useFileStore>} */
const fileStore = inject('fileStore')

// ============================================================
// State
// ============================================================

/** 搜索关键词 */
const searchQuery = ref('')

/** 右键菜单是否可见 */
const contextMenuVisible = ref(false)

/** 右键菜单定位目标 */
const contextMenuTarget = ref(null)

/** 右键菜单对应的节点 */
const contextMenuNode = ref(null)

/** 对话框是否可见 */
const dialogVisible = ref(false)

/** 对话框类型: 'newFile' | 'newFolder' | 'rename' */
const dialogType = ref('')

/** 对话框输入值 */
const dialogInputValue = ref('')

/** 对话框关联的父路径（新建时）或节点（重命名时） */
const dialogContext = ref(null)

/** 删除确认对话框是否可见 */
const deleteConfirmVisible = ref(false)

/** 删除目标路径 */
const deleteTargetPath = ref('')

/** 删除目标名称 */
const deleteTargetName = ref('')

// ============================================================
// Computed
// ============================================================

/** 已收藏文件路径数组（用于传递给 FileTreeNode） */
const bookmarkedFilesArray = computed(() => {
  if (!fileStore?.bookmarkedFiles) return []
  return Array.from(fileStore.bookmarkedFiles)
})

/** 过滤后的文件树 */
const filteredTree = computed(() => {
  const tree = fileStore?.fileTree
  if (!tree || !tree.children) return []

  // 无搜索关键词，返回原始树
  if (!searchQuery.value.trim()) {
    return tree.children
  }

  // 有搜索关键词，过滤匹配的节点
  const query = searchQuery.value.toLowerCase().trim()
  return filterTreeNodes(tree.children, query)
})

/** 对话框标题 */
const dialogTitle = computed(() => {
  switch (dialogType.value) {
    case 'newFile':
      return '新建文件'
    case 'newFolder':
      return '新建文件夹'
    case 'rename':
      return '重命名'
    default:
      return ''
  }
})

/** 对话框输入框标签 */
const dialogInputLabel = computed(() => {
  switch (dialogType.value) {
    case 'newFile':
      return '文件名'
    case 'newFolder':
      return '文件夹名'
    case 'rename':
      return '新名称'
    default:
      return ''
  }
})

/** 对话框输入框占位符 */
const dialogInputPlaceholder = computed(() => {
  switch (dialogType.value) {
    case 'newFile':
      return 'example.md'
    case 'newFolder':
      return '新建文件夹'
    case 'rename':
      return '输入新名称'
    default:
      return ''
  }
})

// ============================================================
// Methods
// ============================================================

/**
 * 过滤树节点，保留匹配的节点及其父节点
 * @param {Array} nodes - 节点数组
 * @param {string} query - 搜索关键词
 * @returns {Array} 过滤后的节点数组
 */
function filterTreeNodes(nodes, query) {
  const result = []

  for (const node of nodes) {
    // 检查当前节点名称是否匹配
    const nameMatches = node.name.toLowerCase().includes(query)

    if (node.isDirectory) {
      // 文件夹：递归检查子节点
      const filteredChildren = filterTreeNodes(node.children || [], query)

      if (nameMatches || filteredChildren.length > 0) {
        // 当前文件夹名称匹配或有匹配的子节点，保留此文件夹
        result.push({
          ...node,
          children: filteredChildren
        })
      }
    } else {
      // 文件：名称匹配则保留
      if (nameMatches) {
        result.push(node)
      }
    }
  }

  return result
}

/**
 * 搜索关键词变化处理
 */
function onSearchChange() {
  // 搜索变化时可以执行额外操作（如展开所有匹配节点）
}

/**
 * 点击打开文件夹按钮
 */
async function onOpenFolder() {
  if (fileStore) {
    await fileStore.openFolder()
  }
}

/**
 * 点击刷新按钮
 */
async function onRefresh() {
  if (fileStore) {
    await fileStore.refreshTree()
  }
}

/**
 * 点击新建文件按钮（在根目录）
 */
function onCreateFile() {
  showCreateDialog('newFile', fileStore?.currentFolder)
}

/**
 * 点击新建文件夹按钮（在根目录）
 */
function onCreateFolder() {
  showCreateDialog('newFolder', fileStore?.currentFolder)
}

/**
 * 节点选中事件
 * @param {Object} nodeInfo - 节点信息
 */
async function onNodeSelect(nodeInfo) {
  if (nodeInfo.isFile && fileStore) {
    await fileStore.openFile(nodeInfo.path)
  }
}

/**
 * 节点右键菜单事件
 * @param {Object} data - { event, node }
 */
function onNodeContextMenu(data) {
  contextMenuNode.value = data.node
  contextMenuTarget.value = data.event.target
  contextMenuVisible.value = true
}

/**
 * 节点创建事件（由 FileTreeNode 触发，用于在特定文件夹下创建）
 * @param {Object} data - { parentPath, type }
 */
function onNodeCreate(data) {
  if (data.type === 'file') {
    showCreateDialog('newFile', data.parentPath)
  } else {
    showCreateDialog('newFolder', data.parentPath)
  }
}

/**
 * 节点移动事件（拖拽）
 * @param {Object} data - { source, target }
 */
async function onNodeMove(data) {
  if (!fileStore) return

  // 移动文件/文件夹到目标目录
  const sourcePath = data.source.path
  const targetPath = data.target.path
  const fileName = data.source.name

  // 构建新路径
  const newPath = `${targetPath}/${fileName}`.replace(/\\/g, '/')

  // 使用 renameFile 实现移动（本质是重命名路径）
  // 注意：这里简化处理，实际可能需要专门的 moveFile API
  try {
    // 通过创建新文件/文件夹并删除旧文件来实现移动
    // 这里暂时只提供提示，完整实现需要 fileStore 支持 move 操作
    console.log('[FileTree] 移动:', sourcePath, '->', newPath)
  } catch (error) {
    console.error('[FileTree] 移动失败:', error)
  }
}

/**
 * 检查文件是否已收藏
 * @param {string} path - 文件路径
 * @returns {boolean}
 */
function isBookmarked(path) {
  return fileStore?.bookmarkedFiles?.has(path) || false
}

// ============================================================
// 右键菜单处理
// ============================================================

/** 右键菜单 - 新建文件 */
function onContextCreateFile() {
  contextMenuVisible.value = false
  if (contextMenuNode.value) {
    showCreateDialog('newFile', contextMenuNode.value.path)
  }
}

/** 右键菜单 - 新建文件夹 */
function onContextCreateFolder() {
  contextMenuVisible.value = false
  if (contextMenuNode.value) {
    showCreateDialog('newFolder', contextMenuNode.value.path)
  }
}

/** 右键菜单 - 重命名 */
function onContextRename() {
  contextMenuVisible.value = false
  if (contextMenuNode.value) {
    showRenameDialog(contextMenuNode.value)
  }
}

/** 右键菜单 - 删除 */
function onContextDelete() {
  contextMenuVisible.value = false
  if (contextMenuNode.value) {
    showDeleteConfirm(contextMenuNode.value)
  }
}

/** 右键菜单 - 切换收藏状态 */
function onContextToggleBookmark() {
  contextMenuVisible.value = false
  if (contextMenuNode.value && fileStore) {
    fileStore.toggleBookmark(contextMenuNode.value.path)
  }
}

/** 右键菜单 - 复制路径 */
async function onContextCopyPath() {
  contextMenuVisible.value = false
  if (contextMenuNode.value) {
    try {
      await navigator.clipboard.writeText(contextMenuNode.value.path)
    } catch (error) {
      console.error('[FileTree] 复制路径失败:', error)
    }
  }
}

// ============================================================
// 对话框处理
// ============================================================

/**
 * 显示创建对话框
 * @param {string} type - 'newFile' | 'newFolder'
 * @param {string} parentPath - 父目录路径
 */
function showCreateDialog(type, parentPath) {
  dialogType.value = type
  dialogInputValue.value = ''
  dialogContext.value = { parentPath }
  dialogVisible.value = true
}

/**
 * 显示重命名对话框
 * @param {Object} node - 节点信息
 */
function showRenameDialog(node) {
  dialogType.value = 'rename'
  dialogInputValue.value = node.name
  dialogContext.value = { node }
  dialogVisible.value = true
}

/**
 * 显示删除确认对话框
 * @param {Object} node - 节点信息
 */
function showDeleteConfirm(node) {
  deleteTargetPath.value = node.path
  deleteTargetName.value = node.name
  deleteConfirmVisible.value = true
}

/**
 * 对话框确认
 */
async function onDialogConfirm() {
  if (!dialogInputValue.value.trim() || !fileStore) return

  const name = dialogInputValue.value.trim()

  switch (dialogType.value) {
    case 'newFile':
      await fileStore.createFile(dialogContext.value.parentPath, name)
      break
    case 'newFolder':
      await fileStore.createFolder(dialogContext.value.parentPath, name)
      break
    case 'rename':
      await fileStore.renameFile(dialogContext.value.node.path, name)
      break
  }

  dialogVisible.value = false
}

/**
 * 对话框取消
 */
function onDialogCancel() {
  dialogVisible.value = false
}

/**
 * 确认删除
 */
async function onConfirmDelete() {
  if (fileStore && deleteTargetPath.value) {
    await fileStore.deleteFile(deleteTargetPath.value)
  }
  deleteConfirmVisible.value = false
}

// ============================================================
// Watchers
// ============================================================

/**
 * 监听对话框显示，自动聚焦输入框
 */
watch(dialogVisible, (visible) => {
  if (!visible) {
    dialogInputValue.value = ''
    dialogContext.value = null
  }
})
</script>

<style scoped>
.file-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: rgb(var(--v-theme-surface));
  overflow: hidden;
}

/* 工具栏 */
.file-tree-toolbar {
  display: flex;
  flex-direction: column;
  padding: 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

/* 搜索输入框 */
.search-input {
  margin-bottom: 8px;
}

/* 工具栏操作按钮 */
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 文件树内容区域 */
.file-tree-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

/* 树根节点容器 */
.tree-root {
  padding: 4px 0;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 120px;
  gap: 12px;
}

.loading-text {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.5);
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 180px;
  gap: 12px;
  padding: 24px;
  text-align: center;
}

.empty-text {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.5);
  margin: 0;
}

/* 右键菜单 */
.context-menu {
  min-width: 160px;
}

/* 暗色主题适配 */
:deep(.v-theme--dark) .file-tree-toolbar {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

:deep(.v-theme--dark) .loading-text,
:deep(.v-theme--dark) .empty-text {
  color: rgba(255, 255, 255, 0.5);
}
</style>
