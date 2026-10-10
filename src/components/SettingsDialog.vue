<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    max-width="560"
    scrollable
  >
    <v-card>
      <!-- 标题栏 -->
      <v-card-title class="d-flex align-center pa-4">
        <v-icon start>mdi-cog</v-icon>
        设置
        <v-spacer />
        <v-btn
          icon
          size="small"
          variant="text"
          @click="$emit('update:modelValue', false)"
        >
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider />

      <!-- 设置内容区域 -->
      <v-card-text class="pa-0">
        <div class="settings-content">
          <!-- 外观设置 -->
          <div class="settings-section">
            <div class="section-title">
              <v-icon size="18" class="mr-2">mdi-palette</v-icon>
              外观
            </div>

            <div class="setting-item">
              <div class="setting-label">主题模式</div>
              <div class="setting-control">
                <v-btn-toggle
                  :model-value="settingsStore.theme"
                  @update:model-value="onThemeChange"
                  mandatory
                  density="compact"
                  variant="outlined"
                  divided
                >
                  <v-btn value="light" size="small">
                    <v-icon start size="16">mdi-white-balance-sunny</v-icon>
                    浅色
                  </v-btn>
                  <v-btn value="dark" size="small">
                    <v-icon start size="16">mdi-moon-waning-crescent</v-icon>
                    深色
                  </v-btn>
                </v-btn-toggle>
              </div>
            </div>
          </div>

          <!-- 编辑器设置 -->
          <div class="settings-section">
            <div class="section-title">
              <v-icon size="18" class="mr-2">mdi-code-braces</v-icon>
              编辑器
            </div>

            <div class="setting-item">
              <div class="setting-label">默认编辑模式</div>
              <div class="setting-control">
                <v-text-field
                  model-value="即时渲染 (IR)"
                  density="compact"
                  variant="outlined"
                  hide-details
                  disabled
                  style="min-width: 160px"
                />
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-label">
                字体大小
                <span class="setting-value">{{ settingsStore.fontSize }}px</span>
              </div>
              <div class="setting-control setting-control--full">
                <v-slider
                  :model-value="settingsStore.fontSize"
                  @update:model-value="onFontSizeChange"
                  :min="10"
                  :max="32"
                  :step="1"
                  thumb-label
                  hide-details
                  color="primary"
                />
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-label">显示行号</div>
              <div class="setting-control">
                <v-switch
                  :model-value="settingsStore.showLineNumbers"
                  @update:model-value="onShowLineNumbersChange"
                  color="primary"
                  density="compact"
                  hide-details
                />
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-label">自动换行</div>
              <div class="setting-control">
                <v-switch
                  :model-value="settingsStore.wordWrap"
                  @update:model-value="onWordWrapChange"
                  color="primary"
                  density="compact"
                  hide-details
                />
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-label">
                Tab 缩进
                <span class="setting-value">{{ settingsStore.tabSize }} 空格</span>
              </div>
              <div class="setting-control setting-control--full">
                <v-slider
                  :model-value="settingsStore.tabSize"
                  @update:model-value="onTabSizeChange"
                  :min="1"
                  :max="8"
                  :step="1"
                  thumb-label
                  hide-details
                  color="primary"
                />
              </div>
            </div>
          </div>

          <!-- 自动保存设置 -->
          <div class="settings-section">
            <div class="section-title">
              <v-icon size="18" class="mr-2">mdi-content-save</v-icon>
              自动保存
            </div>

            <div class="setting-item">
              <div class="setting-label">启用自动保存</div>
              <div class="setting-control">
                <v-switch
                  :model-value="settingsStore.autoSave"
                  @update:model-value="onAutoSaveChange"
                  color="primary"
                  density="compact"
                  hide-details
                />
              </div>
            </div>

            <div
              class="setting-item"
              :class="{ 'setting-item--disabled': !settingsStore.autoSave }"
            >
              <div class="setting-label">
                保存延迟
                <span class="setting-value">{{ autoSaveDelaySeconds }}秒</span>
              </div>
              <div class="setting-control setting-control--full">
                <v-slider
                  :model-value="settingsStore.autoSaveDelay"
                  @update:model-value="onAutoSaveDelayChange"
                  :min="1000"
                  :max="30000"
                  :step="1000"
                  thumb-label
                  hide-details
                  color="primary"
                  :disabled="!settingsStore.autoSave"
                >
                  <template v-slot:thumb-label="{ modelValue }">
                    {{ (modelValue / 1000).toFixed(0) }}s
                  </template>
                </v-slider>
              </div>
            </div>
          </div>

          <!-- 最近文件设置 -->
          <div class="settings-section">
            <div class="section-title">
              <v-icon size="18" class="mr-2">mdi-history</v-icon>
              最近文件
            </div>

            <div class="setting-item">
              <div class="setting-label">
                清除最近文件列表
                <span class="setting-hint" v-if="recentCount > 0">
                  ({{ recentCount }} 条记录)
                </span>
              </div>
              <div class="setting-control">
                <v-btn
                  size="small"
                  variant="outlined"
                  color="error"
                  :disabled="recentCount === 0"
                  @click="onClearRecent"
                >
                  <v-icon start size="16">mdi-delete-sweep</v-icon>
                  清除
                </v-btn>
              </div>
            </div>
          </div>
        </div>
      </v-card-text>

      <v-divider />

      <!-- 底部操作栏 -->
      <v-card-actions class="pa-4">
        <v-btn
          variant="text"
          color="warning"
          @click="onResetDefaults"
        >
          <v-icon start size="18">mdi-restore</v-icon>
          恢复默认
        </v-btn>
        <v-spacer />
        <v-btn
          variant="text"
          @click="$emit('update:modelValue', false)"
        >
          关闭
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- 恢复默认确认对话框 -->
    <v-dialog
      v-model="confirmResetVisible"
      max-width="360"
    >
      <v-card>
        <v-card-title class="text-body-1">确认恢复默认设置</v-card-title>
        <v-card-text>
          此操作将恢复所有设置为默认值，包括主题、编辑器配置和最近文件列表。是否继续？
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmResetVisible = false">取消</v-btn>
          <v-btn variant="text" color="warning" @click="onConfirmReset">确认恢复</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 清除最近文件确认对话框 -->
    <v-dialog
      v-model="confirmClearVisible"
      max-width="360"
    >
      <v-card>
        <v-card-title class="text-body-1">确认清除最近文件</v-card-title>
        <v-card-text>
          此操作将清除所有最近打开的文件和文件夹记录，是否继续？
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmClearVisible = false">取消</v-btn>
          <v-btn variant="text" color="error" @click="onConfirmClear">确认清除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script setup>
import { inject, ref, computed } from 'vue'

// ============ Props ============

const props = defineProps({
  /** 对话框是否显示（v-model 绑定） */
  modelValue: {
    type: Boolean,
    default: false
  }
})

// ============ Emits ============

const emit = defineEmits(['update:modelValue'])

// ============ Inject ============

/** @type {import('@/stores/settingsStore').ReturnType<typeof useSettingsStore>} */
const settingsStore = inject('settingsStore')

// ============ Data ============

/** 恢复默认确认对话框是否可见 */
const confirmResetVisible = ref(false)

/** 清除最近文件确认对话框是否可见 */
const confirmClearVisible = ref(false)

// ============ Computed ============

/** 自动保存延迟（秒） */
const autoSaveDelaySeconds = computed(() => {
  return (settingsStore?.autoSaveDelay || 3000) / 1000
})

/** 最近文件和文件夹总数 */
const recentCount = computed(() => {
  if (!settingsStore) return 0
  return (settingsStore.recentFiles?.length || 0) + (settingsStore.recentFolders?.length || 0)
})

// ============ Methods ============

/**
 * 主题变更处理
 * @param {string} newTheme - 新主题值
 */
function onThemeChange(newTheme) {
  if (settingsStore) {
    settingsStore.updateTheme(newTheme)
  }
}

/**
 * 字体大小变更处理
 * @param {number} size - 新字体大小
 */
function onFontSizeChange(size) {
  if (settingsStore) {
    settingsStore.updateFontSize(size)
  }
}

/**
 * 行号显示变更处理
 * @param {boolean} visible - 是否显示行号
 */
function onShowLineNumbersChange(visible) {
  if (settingsStore) {
    settingsStore.updateShowLineNumbers(visible)
  }
}

/**
 * 自动换行变更处理
 * @param {boolean} enabled - 是否启用自动换行
 */
function onWordWrapChange(enabled) {
  if (settingsStore) {
    settingsStore.updateWordWrap(enabled)
  }
}

/**
 * Tab 缩进大小变更处理
 * @param {number} size - 新缩进大小
 */
function onTabSizeChange(size) {
  if (settingsStore) {
    settingsStore.updateTabSize(size)
  }
}

/**
 * 自动保存开关变更处理
 * @param {boolean} enabled - 是否启用自动保存
 */
function onAutoSaveChange(enabled) {
  if (settingsStore) {
    settingsStore.updateAutoSave(enabled)
  }
}

/**
 * 自动保存延迟变更处理
 * @param {number} delay - 新延迟时间（毫秒）
 */
function onAutoSaveDelayChange(delay) {
  if (settingsStore) {
    settingsStore.updateAutoSaveDelay(delay)
  }
}

/**
 * 清除最近文件列表按钮点击
 * 显示确认对话框
 */
function onClearRecent() {
  confirmClearVisible.value = true
}

/**
 * 确认清除最近文件
 */
function onConfirmClear() {
  if (settingsStore) {
    settingsStore.clearRecentFiles()
    settingsStore.clearRecentFolders()
  }
  confirmClearVisible.value = false
}

/**
 * 恢复默认设置按钮点击
 * 显示确认对话框
 */
function onResetDefaults() {
  confirmResetVisible.value = true
}

/**
 * 确认恢复默认设置
 */
function onConfirmReset() {
  if (settingsStore) {
    settingsStore.resetToDefaults()
  }
  confirmResetVisible.value = false
}
</script>

<style scoped>
/* 设置内容区域 */
.settings-content {
  padding: 8px 0;
}

/* 设置分组 */
.settings-section {
  padding: 16px 24px;
}

.settings-section + .settings-section {
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

/* 分组标题 */
.section-title {
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 16px;
}

/* 单个设置项 */
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  margin-bottom: 8px;
}

.setting-item:last-child {
  margin-bottom: 0;
}

.setting-item--disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* 设置项标签 */
.setting-label {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.87);
  flex-shrink: 0;
  margin-right: 16px;
}

.setting-value {
  margin-left: 8px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  font-weight: 500;
}

.setting-hint {
  margin-left: 4px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.38);
}

/* 设置项控件 */
.setting-control {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.setting-control--full {
  flex: 1;
  min-width: 0;
  max-width: 240px;
}

/* 暗色主题适配 */
:deep(.v-theme--dark) .settings-section + .settings-section {
  border-top-color: rgba(255, 255, 255, 0.06);
}

:deep(.v-theme--dark) .section-title {
  color: rgba(255, 255, 255, 0.6);
}

:deep(.v-theme--dark) .setting-label {
  color: rgba(255, 255, 255, 0.87);
}

:deep(.v-theme--dark) .setting-value {
  color: rgba(255, 255, 255, 0.45);
}

:deep(.v-theme--dark) .setting-hint {
  color: rgba(255, 255, 255, 0.38);
}
</style>
