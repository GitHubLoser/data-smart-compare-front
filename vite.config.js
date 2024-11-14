import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  server: {
    port: 3000, // 指定固定端口
    strictPort: true, // 如果端口被占用，则直接退出
  },
  plugins: [vue()],
  resolve: {
    alias: {
      '@': '/src'
    }
  }
}) 