<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    max-width="560"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon size="20" class="mr-2">mdi-keyboard</v-icon>
        快捷键设置
        <v-spacer />
        <v-btn icon size="small" variant="text" @click="$emit('update:modelValue', false)">
          <v-icon size="18">mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider />

      <v-card-text class="pt-4">
        <!-- 可自定义的编辑器快捷键 -->
        <div class="section-title">编辑器快捷键（点击右侧按键进行修改）</div>
        <v-list density="compact" class="shortcut-list">
          <v-list-item
            v-for="item in editableShortcuts"
            :key="item.action"
            :title="item.label"
            :subtitle="item.hint"
            class="shortcut-item"
          >
            <template v-slot:append>
              <v-chip
                size="small"
                :color="capturingAction === item.action ? 'primary' : 'default'"
                :variant="capturingAction === item.action ? 'flat' : 'tonal'"
                class="combo-chip"
                @click="startCapture(item.action)"
                :title="capturingAction === item.action ? '请按下新的快捷键…' : '点击修改快捷键'"
              >
                {{ capturingAction === item.action ? '请按下新快捷键…' : displayCombo(item.combo) }}
              </v-chip>
            </template>
          </v-list-item>
        </v-list>

        <!-- 固定默认快捷键 -->
        <div class="section-title mt-4">其他快捷键（默认，暂不可修改）</div>
        <v-list density="compact" class="shortcut-list">
          <v-list-item
            v-for="item in fixedShortcuts"
            :key="item.label"
            :title="item.label"
            class="shortcut-item"
          >
            <template v-slot:append>
              <v-chip size="small" variant="tonal" class="combo-chip">{{ item.combo }}</v-chip>
            </template>
          </v-list-item>
        </v-list>

        <div v-if="captureError" class="capture-error">{{ captureError }}</div>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-btn variant="text" color="warning" @click="resetDefaults">恢复默认</v-btn>
        <v-spacer />
        <v-btn variant="flat" color="primary" @click="$emit('update:modelValue', false)">完成</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const settingsStore = useSettingsStore()

// ============ 可编辑快捷键定义 ============

const EDITABLE_ITEMS = [
  { action: 'heading1', label: '一级标题', hint: '将当前行转换为一二级…转换为 H1 标题' },
  { action: 'heading2', label: '二级标题', hint: '将当前行转换为 H2 标题' },
  { action: 'heading3', label: '三级标题', hint: '将当前行转换为 H3 标题' },
  { action: 'heading4', label: '四级标题', hint: '将当前行转换为 H4 标题' },
  { action: 'heading5', label: '五级标题', hint: '将当前行转换为 H5 标题' },
  { action: 'heading6', label: '六级标题', hint: '将当前行转换为 H6 标题' },
  { action: 'codeBlock', label: '代码块', hint: '在光标处插入代码块围栏' }
]

const editableShortcuts = computed(() =>
  EDITABLE_ITEMS.map(item => ({
    ...item,
    combo: settingsStore.shortcuts?.[item.action] || ''
  }))
)

/** 固定默认快捷键（暂不支持修改） */
const fixedShortcuts = [
  { label: '保存文件', combo: 'Ctrl+S' },
  { label: '撤销', combo: 'Ctrl+Z' },
  { label: '重做', combo: 'Ctrl+Y' },
  { label: '加粗', combo: 'Ctrl+B' },
  { label: '斜体', combo: 'Ctrl+I' },
  { label: '删除线', combo: 'Ctrl+Shift+S' },
  { label: '行内代码', combo: 'Ctrl+`' }
]

// ============ 快捷键捕获 ============

/** 当前正在捕获的 action（null 表示未在捕获） */
const capturingAction = ref(null)
const captureError = ref('')

/** 组合键显示格式化：ctrl+1 → Ctrl+1 */
function displayCombo(combo) {
  return String(combo || '')
    .split('+')
    .map(part => {
      if (part === 'ctrl') return 'Ctrl'
      if (part === 'alt') return 'Alt'
      if (part === 'shift') return 'Shift'
      if (part === 'meta') return 'Win'
      if (part.length === 1) return part.toUpperCase()
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join('+')
}

/** 开始捕获：注册 window keydown 捕获下一次按键组合 */
function startCapture(action) {
  capturingAction.value = action
  captureError.value = ''
  window.addEventListener('keydown', onCaptureKeydown, true)
}

function stopCapture() {
  capturingAction.value = null
  window.removeEventListener('keydown', onCaptureKeydown, true)
}

/**
 * 捕获按键组合
 * @param {KeyboardEvent} e
 */
function onCaptureKeydown(e) {
  e.preventDefault()
  e.stopPropagation()

  // Esc 取消捕获
  if (e.key === 'Escape') {
    stopCapture()
    return
  }

  // 仅修饰键按下时不作为完整快捷键
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return

  const parts = []
  if (e.ctrlKey || e.metaKey) parts.push('ctrl')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  const key = e.key.toLowerCase()
  if (!['control', 'shift', 'alt', 'meta'].includes(key)) parts.push(key)

  if (parts.length === 1 && parts[0].length === 1) {
    // 单个普通按键不允许作为快捷键（避免干扰输入）
    captureError.value = '快捷键需包含 Ctrl/Alt 修饰键'
    return
  }

  const combo = parts.join('+')

  // 冲突检测：与其他可编辑快捷键重复则拒绝
  const conflict = EDITABLE_ITEMS.find(
    item => item.action !== capturingAction.value && settingsStore.shortcuts?.[item.action] === combo
  )
  if (conflict) {
    captureError.value = `与"${conflict.label}"冲突，请换一个组合`
    return
  }

  settingsStore.updateShortcut(capturingAction.value, combo)
  captureError.value = ''
  stopCapture()
}

// 对话框关闭时中断未完成的捕获
watch(() => props.modelValue, (visible) => {
  if (!visible) stopCapture()
})

onUnmounted(stopCapture)

function resetDefaults() {
  settingsStore.resetShortcuts()
  captureError.value = ''
  stopCapture()
}
</script>

<style scoped>
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.7);
  margin-bottom: 4px;
}

.shortcut-list {
  max-height: none;
}

.shortcut-item {
  min-height: 40px;
}

.combo-chip {
  cursor: pointer;
  font-family: 'Consolas', 'Courier New', monospace;
  min-width: 90px;
  justify-content: center;
}

.capture-error {
  color: #d32f2f;
  font-size: 12px;
  margin-top: 8px;
}
</style>
