<template>
  <div class="tab-bar" v-if="fileStore && fileStore.openFiles.length > 0">
    <!-- 左滚动按钮 -->
    <v-btn
      v-show="showScrollButtons"
      class="tab-scroll-btn tab-scroll-left"
      icon
      size="x-small"
      variant="text"
      :disabled="scrollAtStart"
      @click="scrollLeft"
    >
      <v-icon size="16">mdi-chevron-left</v-icon>
    </v-btn>

    <!-- 标签页容器 -->
    <div
      ref="tabContainer"
      class="tab-container"
      @scroll="onScroll"
    >
      <div
        v-for="(file, index) in fileStore.openFiles"
        :key="file.path"
        class="tab-item"
        :class="{
          'is-active': index === fileStore.activeFileIndex,
          'is-modified': fileStore.modifiedFiles.has(file.path)
        }"
        :title="file.path"
        @click="onTabClick(index)"
        @contextmenu.prevent="onTabContextMenu($event, index)"
      >
        <!-- 修改状态圆点 -->
        <span
          v-if="fileStore.modifiedFiles.has(file.path)"
          class="tab-modified-dot"
        />

        <!-- 文件名 -->
        <span class="tab-name">{{ file.name }}</span>

        <!-- 关闭按钮 -->
        <v-btn
          class="tab-close-btn"
          icon
          size="x-small"
          variant="text"
          @click.stop="onTabClose(index)"
        >
          <v-icon size="14">mdi-close</v-icon>
        </v-btn>
      </div>
    </div>

    <!-- 右滚动按钮 -->
    <v-btn
      v-show="showScrollButtons"
      class="tab-scroll-btn tab-scroll-right"
      icon
      size="x-small"
      variant="text"
      :disabled="scrollAtEnd"
      @click="scrollRight"
    >
      <v-icon size="16">mdi-chevron-right</v-icon>
    </v-btn>

    <!-- 右键菜单 -->
    <v-menu
      v-model="contextMenuVisible"
      :target="contextMenuTarget"
      location="bottom start"
    >
      <v-list density="compact" class="tab-context-menu">
        <v-list-item @click="onContextClose">
          <template #prepend>
            <v-icon size="18">mdi-close</v-icon>
          </template>
          <v-list-item-title>关闭</v-list-item-title>
        </v-list-item>

        <v-list-item
          :disabled="fileStore.openFiles.length <= 1"
          @click="onContextCloseOthers"
        >
          <template #prepend>
            <v-icon size="18">mdi-close-circle-outline</v-icon>
          </template>
          <v-list-item-title>关闭其他</v-list-item-title>
        </v-list-item>

        <v-list-item
          :disabled="contextMenuIndex >= fileStore.openFiles.length - 1"
          @click="onContextCloseRight"
        >
          <template #prepend>
            <v-icon size="18">mdi-close-circle-multiple-outline</v-icon>
          </template>
          <v-list-item-title>关闭右侧所有</v-list-item-title>
        </v-list-item>

        <v-divider />

        <v-list-item
          :disabled="fileStore.openFiles.length === 0"
          @click="onContextCloseAll"
        >
          <template #prepend>
            <v-icon size="18">mdi-close-box-multiple-outline</v-icon>
          </template>
          <v-list-item-title>关闭所有</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, inject } from 'vue'

// ============ Inject ============

/** @type {import('@/stores/fileStore').ReturnType<typeof useFileStore>} */
const fileStore = inject('fileStore')

// ============ Refs ============

/** 标签页滚动容器 */
const tabContainer = ref(null)

/** 是否显示左右滚动按钮 */
const showScrollButtons = ref(false)

/** 是否滚动到最左侧 */
const scrollAtStart = ref(true)

/** 是否滚动到最右侧 */
const scrollAtEnd = ref(false)

/** 右键菜单是否可见 */
const contextMenuVisible = ref(false)

/** 右键菜单定位目标 */
const contextMenuTarget = ref(null)

/** 右键菜单对应的标签索引 */
const contextMenuIndex = ref(-1)

// ============ Computed ============

/** 标签页数量 */
const tabCount = computed(() => {
  return fileStore?.openFiles?.length || 0
})

// ============ Methods ============

/**
 * 点击标签页，切换激活文件
 * @param {number} index - 标签索引
 */
function onTabClick(index) {
  if (fileStore) {
    fileStore.switchTab(index)
  }
}

/**
 * 点击关闭按钮，关闭指定标签
 * 如果文件未保存，先强制关闭（后续可扩展为确认对话框）
 * @param {number} index - 标签索引
 */
function onTabClose(index) {
  if (!fileStore) return

  const result = fileStore.closeFile(index)
  if (result.unsaved) {
    // 文件已修改未保存，强制关闭
    // TODO: 后续可替换为确认对话框，让用户选择保存/放弃/取消
    fileStore.forceCloseFile(index)
  }
}

/**
 * 右键菜单事件
 * @param {MouseEvent} event - 鼠标事件
 * @param {number} index - 标签索引
 */
function onTabContextMenu(event, index) {
  contextMenuIndex.value = index
  contextMenuTarget.value = event.target
  contextMenuVisible.value = true
}

/** 右键菜单 - 关闭当前标签 */
function onContextClose() {
  if (contextMenuIndex.value < 0) return
  onTabClose(contextMenuIndex.value)
  contextMenuVisible.value = false
}

/** 右键菜单 - 关闭其他标签 */
function onContextCloseOthers() {
  if (contextMenuIndex.value < 0 || !fileStore) return
  fileStore.closeOtherTabs(contextMenuIndex.value)
  contextMenuVisible.value = false
}

/** 右键菜单 - 关闭右侧所有标签 */
function onContextCloseRight() {
  if (contextMenuIndex.value < 0 || !fileStore) return

  const keepIndex = contextMenuIndex.value
  const toClose = []

  // 收集右侧需要关闭的标签（跳过未保存的）
  for (let i = fileStore.openFiles.length - 1; i > keepIndex; i--) {
    const file = fileStore.openFiles[i]
    if (fileStore.modifiedFiles.has(file.path)) {
      // 未保存的文件跳过
      continue
    }
    toClose.push(i)
  }

  // 从后往前删除，避免索引偏移
  for (const index of toClose) {
    fileStore.openFiles.splice(index, 1)
  }

  // 调整激活文件索引
  if (fileStore.openFiles.length === 0) {
    fileStore.activeFileIndex = -1
  } else if (fileStore.activeFileIndex >= fileStore.openFiles.length) {
    fileStore.activeFileIndex = fileStore.openFiles.length - 1
  } else if (fileStore.activeFileIndex > keepIndex) {
    // 激活文件在右侧被关闭的范围内，切换到 keepIndex
    fileStore.activeFileIndex = keepIndex
  }

  contextMenuVisible.value = false
}

/** 右键菜单 - 关闭所有标签 */
function onContextCloseAll() {
  if (!fileStore) return
  fileStore.closeAllTabs()
  contextMenuVisible.value = false
}

/**
 * 检查是否需要显示滚动按钮
 * 根据容器和内容的宽度差判断
 */
function checkScroll() {
  if (!tabContainer.value) {
    showScrollButtons.value = false
    return
  }

  const container = tabContainer.value
  const hasOverflow = container.scrollWidth > container.clientWidth
  showScrollButtons.value = hasOverflow
  updateScrollState()
}

/**
 * 更新滚动边界状态
 */
function updateScrollState() {
  if (!tabContainer.value) {
    scrollAtStart.value = true
    scrollAtEnd.value = false
    return
  }

  const container = tabContainer.value
  const tolerance = 2 // 像素容差

  scrollAtStart.value = container.scrollLeft <= tolerance
  scrollAtEnd.value = container.scrollLeft + container.clientWidth >= container.scrollWidth - tolerance
}

/**
 * 容器滚动事件处理
 */
function onScroll() {
  updateScrollState()
}

/**
 * 向左滚动标签页
 */
function scrollLeft() {
  if (!tabContainer.value) return
  tabContainer.value.scrollBy({ left: -150, behavior: 'smooth' })
}

/**
 * 向右滚动标签页
 */
function scrollRight() {
  if (!tabContainer.value) return
  tabContainer.value.scrollBy({ left: 150, behavior: 'smooth' })
}

/**
 * 滚动到激活的标签页，确保其可见
 */
function scrollToActiveTab() {
  if (!tabContainer.value) return

  nextTick(() => {
    const container = tabContainer.value
    if (!container) return

    const activeTab = container.querySelector('.tab-item.is-active')
    if (!activeTab) return

    const containerRect = container.getBoundingClientRect()
    const tabRect = activeTab.getBoundingClientRect()

    // 如果激活标签在可视区域左侧之外
    if (tabRect.left < containerRect.left) {
      container.scrollTo({
        left: container.scrollLeft + (tabRect.left - containerRect.left) - 10,
        behavior: 'smooth'
      })
    }
    // 如果激活标签在可视区域右侧之外
    else if (tabRect.right > containerRect.right) {
      container.scrollTo({
        left: container.scrollLeft + (tabRect.right - containerRect.right) + 10,
        behavior: 'smooth'
      })
    }
  })
}

// ============ Watchers ============

/**
 * 监听标签页数量变化，重新检查滚动状态
 */
watch(tabCount, () => {
  nextTick(() => {
    checkScroll()
    scrollToActiveTab()
  })
})

/**
 * 监听激活文件变化，滚动到激活标签
 */
watch(
  () => fileStore?.activeFileIndex,
  () => {
    nextTick(() => {
      scrollToActiveTab()
    })
  }
)

// ============ 生命周期 ============

onMounted(() => {
  checkScroll()

  // 监听窗口大小变化，重新检查滚动状态
  window.addEventListener('resize', checkScroll)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkScroll)
})
</script>

<style scoped>
/* 标签栏容器 */
.tab-bar {
  display: flex;
  align-items: center;
  height: 36px;
  background-color: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  user-select: none;
  flex-shrink: 0;
}

/* 标签页滚动容器 */
.tab-container {
  display: flex;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  height: 100%;
  scrollbar-width: none; /* Firefox */
}

.tab-container::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}

/* 滚动按钮 */
.tab-scroll-btn {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  margin: 0 2px;
  border-radius: 4px;
}

/* 单个标签页 */
.tab-item {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 8px;
  padding-right: 4px;
  min-width: 0;
  max-width: 180px;
  cursor: pointer;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  background-color: transparent;
  transition: background-color 0.15s ease;
  flex-shrink: 0;
}

.tab-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

/* 激活标签 */
.tab-item.is-active {
  background-color: rgb(var(--v-theme-background));
  border-bottom: 2px solid rgb(var(--v-theme-primary));
}

.tab-item.is-active:hover {
  background-color: rgb(var(--v-theme-background));
}

/* 修改状态圆点 */
.tab-modified-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: rgb(var(--v-theme-primary));
  margin-right: 6px;
}

/* 文件名 */
.tab-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 36px;
}

/* 关闭按钮 */
.tab-close-btn {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-left: 2px;
  opacity: 0;
  border-radius: 4px;
  transition: opacity 0.15s ease, background-color 0.15s ease;
}

.tab-item:hover .tab-close-btn,
.tab-item.is-active .tab-close-btn {
  opacity: 1;
}

.tab-close-btn:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

/* 暗色主题适配 */
:deep(.v-theme--dark) .tab-bar {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

:deep(.v-theme--dark) .tab-item {
  border-right-color: rgba(255, 255, 255, 0.06);
}

:deep(.v-theme--dark) .tab-item:hover {
  background-color: rgba(255, 255, 255, 0.06);
}

:deep(.v-theme--dark) .tab-close-btn:hover {
  background-color: rgba(255, 255, 255, 0.12);
}

/* 右键菜单样式 */
.tab-context-menu {
  min-width: 160px;
}
</style>
