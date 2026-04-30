import { defineConfig } from 'vite'
import type { Plugin, ViteDevServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from 'unplugin-vue-components/resolvers'
import {
  buildEastMoneyPingzhongdataUrl,
  normalizeEastMoneyQuote
} from './api/_lib/eastMoney'

function eastMoneyDevApi(): Plugin {
  return {
    name: 'eastmoney-dev-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/eastmoney/quote', async (request, response) => {
        const requestUrl = new URL(request.url || '', 'http://localhost')
        const symbol = requestUrl.searchParams.get('symbol') || ''

        response.setHeader('Content-Type', 'application/json; charset=utf-8')

        if (!symbol.trim()) {
          response.statusCode = 400
          response.end(JSON.stringify({ error: '请先输入标的代码' }))
          return
        }

        try {
          const eastMoneyResponse = await fetch(buildEastMoneyPingzhongdataUrl(symbol))
          if (!eastMoneyResponse.ok) {
            response.statusCode = 502
            response.end(JSON.stringify({ error: `东方财富行情请求失败：HTTP ${eastMoneyResponse.status}` }))
            return
          }

          response.statusCode = 200
          response.end(JSON.stringify(normalizeEastMoneyQuote(await eastMoneyResponse.text(), symbol)))
        } catch (error) {
          const statusCode =
            error instanceof Error && 'statusCode' in error ? Number(error.statusCode) : 502
          response.statusCode = Number.isFinite(statusCode) ? statusCode : 502
          response.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : '无法连接东方财富，请检查本机网络、代理或稍后再试'
            })
          )
        }
      })
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    eastMoneyDevApi(),
    // 自动导入API和常用函数
    AutoImport({
      imports: ['vue', '@vueuse/core'],
      dts: 'src/auto-imports.d.ts',
      dirs: ['src/composables', 'src/utils'], // 自动导入composables和utils目录下的函数
      vueTemplate: true, // 允许在模板中使用导入的函数
    }),
    // 自动导入组件
    Components({
      resolvers: [VantResolver()],
      dts: 'src/components.d.ts',
    }),
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      },
      manifest: {
        name: 'Vue 3 + TS + Less + PWA + Vant Project',
        short_name: 'Vue3-Vant-PWA',
        description: 'A Vue 3 application with Vant UI and PWA support',
        theme_color: 'var(--van-primary-color)', // 使用Vant主题色变量
        background_color: 'var(--van-background-2)', // 使用Vant背景色变量
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    }
  },
  css: {
    preprocessorOptions: {
      less: {
        math: 'parens-division', // Support for legacy less math mode
        globalVars: {
          // 全局变量定义
        },
        modifyVars: {
          // Vant主题色变量覆盖 - 使用默认值，保持一致性
        },
      },
    },
    // 全局样式导入
    additionalData: `@import "@/styles/global.less";`,
  },
  server: {
    port: 3001,
    open: true,
    host: '0.0.0.0'
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
