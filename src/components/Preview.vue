<template>
  <div
    class="markdown-preview"
    :class="{ dark: theme === 'dark' }"
    v-html="renderedContent"
  ></div>
</template>

<script setup>
import { computed } from 'vue'
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
  }
})

/**
 * 渲染后的 HTML 内容
 */
const renderedContent = computed(() => {
  if (!props.content) return ''
  return renderMarkdown(props.content)
})
</script>

<style scoped>
@import '@/styles/markdown.css';
</style>
