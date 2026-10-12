<template>
  <v-dialog v-model="visible" max-width="380" transition="fade-transition">
    <v-card>
      <v-card-title class="text-h6">插入表格</v-card-title>
      <v-card-text>
        <v-text-field
          v-model.number="rows"
          label="行数（含表头行）"
          type="number"
          min="1"
          max="50"
          density="compact"
          hide-details="auto"
          class="mb-3"
        />
        <v-text-field
          v-model.number="cols"
          label="列数"
          type="number"
          min="1"
          max="20"
          density="compact"
          hide-details="auto"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="visible = false">取消</v-btn>
        <v-btn color="primary" variant="text" @click="confirm">确定</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'confirm'])

/** 行数（含表头行，默认 3 行 = 表头 + 2 数据行） */
const rows = ref(3)

/** 列数（默认 3 列） */
const cols = ref(3)

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

/** 打开时重置为默认值（由父组件通过 v-model 打开） */
function reset() {
  rows.value = 3
  cols.value = 3
}

function clamp(val, min, max, fallback) {
  const n = parseInt(val, 10)
  if (isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/** 确认插入：校验并上报行列数 */
function confirm() {
  const r = clamp(rows.value, 1, 50, 3)
  const c = clamp(cols.value, 1, 20, 3)
  emit('confirm', r, c)
  visible.value = false
}

defineExpose({ reset })
</script>
