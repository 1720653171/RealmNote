<template>
  <div ref="editorContainer" class="editor-container"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { createExtensions } from '@/utils/editorConfig'

// ============ Props ============

const props = defineProps({
  /** 编辑器内容（v-model 绑定） */
  modelValue: {
    type: String,
    default: ''
  },
  /** 主题模式 ('light' | 'dark') */
  theme: {
    type: String,
    default: 'light',
    validator: (value) => ['light', 'dark'].includes(value)
  },
  /** 字体大小（像素） */
  fontSize: {
    type: Number,
    default: 14
  },
  /** 保存回调（Ctrl+S 触发） */
  onSave: {
    type: Function,
    default: null
  },
  /** 主题变更回调 */
  onThemeChange: {
    type: Function,
    default: null
  },
  /** 编辑模式变更回调 */
  onModeChange: {
    type: Function,
    default: null
  }
})

// ============ Emits ============

const emit = defineEmits([
  'update:modelValue',
  'change'
])

// ============ Refs ============

const editorContainer = ref(null)

/** @type {import('vue').ShallowRef<EditorView | null>} */
let editorView = null

/** 标记内部更新，避免 watch 触发循环 */
let isInternalUpdate = false

// ============ 方法 ============

/**
 * 获取编辑器当前内容
 * @returns {string} 编辑器文档内容
 */
function getContent() {
  if (!editorView) return ''
  return editorView.state.doc.toString()
}

/**
 * 设置编辑器内容
 * @param {string} content - 要设置的内容
 */
function setContent(content) {
  if (!editorView) return
  if (content === undefined || content === null) content = ''

  const currentContent = editorView.state.doc.toString()
  if (currentContent === content) return

  isInternalUpdate = true
  editorView.dispatch({
    changes: {
      from: 0,
      to: editorView.state.doc.length,
      insert: content
    }
  })
  isInternalUpdate = false
}

/**
 * 聚焦编辑器
 */
function focus() {
  if (editorView) {
    editorView.focus()
  }
}

/**
 * 初始化编辑器
 * 创建 EditorView 实例并挂载到 DOM
 */
function initEditor() {
  if (!editorContainer.value) return

  // 销毁已有实例
  destroyEditor()

  const darkMode = props.theme === 'dark'

  const extensions = createExtensions({
    darkMode,
    fontSize: props.fontSize,
    onChange: (content) => {
      // 内容变化时通知父组件
      isInternalUpdate = true
      emit('update:modelValue', content)
      emit('change', content)
      isInternalUpdate = false
    }
  })

  // 添加 Ctrl+S 保存快捷键
  extensions.push(EditorView.domEventHandlers({
    keydown: (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault()
        if (props.onSave && typeof props.onSave === 'function') {
          props.onSave()
        }
        return true
      }
      return false
    }
  }))

  const state = EditorState.create({
    doc: props.modelValue || '',
    extensions
  })

  editorView = new EditorView({
    state,
    parent: editorContainer.value
  })
}

/**
 * 销毁编辑器实例
 * 清理 DOM 和事件监听
 */
function destroyEditor() {
  if (editorView) {
    editorView.destroy()
    editorView = null
  }
}

/**
 * 重建编辑器（主题或字体大小变化时调用）
 * 保留当前内容和光标位置
 */
function rebuildEditor() {
  if (!editorView) return

  const content = editorView.state.doc.toString()
  const selection = editorView.state.selection

  destroyEditor()

  const darkMode = props.theme === 'dark'

  const extensions = createExtensions({
    darkMode,
    fontSize: props.fontSize,
    onChange: (newContent) => {
      isInternalUpdate = true
      emit('update:modelValue', newContent)
      emit('change', newContent)
      isInternalUpdate = false
    }
  })

  // 添加 Ctrl+S 保存快捷键
  extensions.push(EditorView.domEventHandlers({
    keydown: (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault()
        if (props.onSave && typeof props.onSave === 'function') {
          props.onSave()
        }
        return true
      }
      return false
    }
  }))

  const state = EditorState.create({
    doc: content,
    extensions
  })

  editorView = new EditorView({
    state,
    parent: editorContainer.value
  })

  // 尝试恢复光标位置
  try {
    const pos = Math.min(selection.main.head, state.doc.length)
    editorView.dispatch({
      selection: { anchor: pos, head: pos }
    })
  } catch {
    // 忽略光标恢复失败
  }
}

// ============ Watchers ============

/**
 * 监听 modelValue 外部变化，同步到编辑器
 */
watch(() => props.modelValue, (newValue) => {
  if (isInternalUpdate) return
  if (!editorView) return

  const currentContent = editorView.state.doc.toString()
  if (newValue === currentContent) return

  setContent(newValue || '')
})

/**
 * 监听主题变化，重建编辑器
 */
watch(() => props.theme, (newTheme, oldTheme) => {
  if (newTheme !== oldTheme) {
    rebuildEditor()
    if (props.onThemeChange && typeof props.onThemeChange === 'function') {
      props.onThemeChange(newTheme)
    }
  }
})

/**
 * 监听字体大小变化，重建编辑器
 */
watch(() => props.fontSize, (newSize, oldSize) => {
  if (newSize !== oldSize) {
    rebuildEditor()
  }
})

// ============ 生命周期 ============

onMounted(() => {
  initEditor()
})

onBeforeUnmount(() => {
  destroyEditor()
})

// ============ 暴露方法 ============

defineExpose({
  getContent,
  setContent,
  focus
})
</script>

<style scoped>
.editor-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.editor-container :deep(.cm-editor) {
  height: 100%;
  font-size: inherit;
}

.editor-container :deep(.cm-scroller) {
  overflow: auto;
  font-family: 'Fira Code', 'Consolas', 'Courier New', monospace;
}

.editor-container :deep(.cm-content) {
  padding: 8px 0;
}

.editor-container :deep(.cm-focused) {
  outline: none;
}
</style>
