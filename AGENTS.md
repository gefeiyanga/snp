# Agent Project Guide

这份文档面向接手开发的 agent。目标是在尽量短的时间内理解项目边界、核心数据流和开发约束。

## 项目一句话

这是一个个人资产与负债管理 PWA。前端使用 Vue 3 + TypeScript + Less + Vant，数据默认存储在浏览器本地 `localforage`，并支持投资资产行情查询、资产/负债分类统计、房贷/车贷摊销计算。

## 快速启动

```bash
pnpm install
pnpm run dev
```

开发服务默认运行在 `http://localhost:3001`。

常用命令：

```bash
pnpm run build
pnpm run test
pnpm run lint
pnpm run format
pnpm run dev:vercel
```

## 技术栈

- Vue 3 + `<script setup lang="ts">`
- Vite，入口是 `src/main.ts`
- Vue Router，路由表在 `src/router/index.ts`
- Less，全局样式在 `src/styles/global.less`，财务主题变量在 `src/styles/finance-theme.less`
- Vant 4，移动端 UI 组件库
- ECharts / vue-echarts，用于图表能力
- LocalForage，用于浏览器本地持久化
- vite-plugin-pwa，用于 PWA
- Vitest，用于单元测试
- Oxlint / Oxfmt，用于 lint 和格式化
- Vercel Serverless API，用于加密货币行情代理接口

## 目录地图

- `src/main.ts`：创建 Vue app，挂载 router。
- `src/App.vue`：应用壳，只渲染 `RouterView` 和全局背景。
- `src/router/index.ts`：页面路由，包括首页、资产页、负债页、分类详情页。
- `src/pages/`：业务页面。
  - `HomePage.vue`：资产总览、净资产、资产/负债分布。
  - `AssetsPage.vue`：资产列表入口。
  - `AssetCategoryPage.vue`：资产分类详情。
  - `LiabilitiesPage.vue`：负债列表入口。
  - `LiabilityCategoryPage.vue`：负债分类详情。
- `src/components/`：可复用 UI 组件，包括底部表单、资产表单、图表组件。
- `src/composables/useStorage.ts`：`localforage` 包装。
- `src/composables/useFinancialLedger.ts`：资产/负债仓储层，页面主要通过这里读写业务数据。
- `src/types/ledger.ts`：资产、负债、表单 payload 等核心类型。
- `src/domain/ledgerCategories.ts`：资产/负债分类归一化。
- `src/domain/loanSchedule.ts`：房贷/车贷摊销、剩余本金、月供等纯业务计算。
- `src/services/marketData.ts`：投资资产行情查询入口。
- `api/crypto/quote.ts`：Vercel API 路由，加密货币行情代理。
- `api/_lib/`：API 侧行情 provider 与 CoinMarketCap 适配。
- `docs/superpowers/specs/`：历史需求/设计说明。
- `docs/superpowers/plans/`：历史实施计划。
- `src/docs/requirements.md`：早期需求文档，注意当前终端里可能出现中文编码显示异常。

## 业务模型

核心类型在 `src/types/ledger.ts`。

资产 `AssetRecord`：

- `amount` 是当前展示总价值。
- 普通资产使用 `valuationMode: 'manual_amount'`。
- 投资资产使用 `valuationMode: 'market_quantity'`，由 `quantity * unitPrice` 得到 `amount`。
- 投资类型包括 `fund`、`stock`、`crypto`。
- 币种包括 `CNY`、`USD`、`USDT`。

负债 `LiabilityRecord`：

- `amount` 是合同初始本金。
- `remaining` 是当前剩余应还本金。
- `monthlyPayment` 是展示用月供。
- 房贷/车贷支持摊销字段：`firstPaymentDate`、`termMonths`、`repaymentMethod`、`interestRate`。
- 缺少摊销字段的历史房贷/车贷会标记为 `legacyManual: true`，不要自动改写为摊销模式。

存储 key：

- `assets`
- `liabilities`

## 数据流

页面不要直接碰 `localforage`。优先通过仓储 composable：

- `useAssetRecords()`：`list`、`saveAll`、`getById`、`create`、`update`、`remove`、`upsertFromForm`
- `useLiabilityRecords()`：同上，并在读取/写入时处理摊销和 legacy 数据

表单提交通常走 `upsertFromForm()`，它会把通用 `LedgerFormPayload` 归一化成资产或负债记录。

负债摊销相关计算保持在 `src/domain/loanSchedule.ts`，这是纯函数模块，适合优先补单测。

## 行情能力

股票/基金：

- 前端从 `src/services/marketData.ts` 直接调用 Alpha Vantage。
- 需要 `VITE_ALPHA_VANTAGE_API_KEY`。
- 股票使用 `GLOBAL_QUOTE`。
- 基金当前使用 `TIME_SERIES_DAILY` 取最近收盘价。

加密货币：

- 前端调用 `/api/crypto/quote`。
- Vercel API 再调用 CoinMarketCap。
- 需要服务端环境变量 `COINMARKETCAP_API_KEY`。

本地开发真实 API 时可使用：

```bash
pnpm run dev:vercel
```

## 自动导入

本项目配置了自动导入，新增 import 前先检查：

- `vite.config.ts` 的 `AutoImport` 配置。
- `src/auto-imports.d.ts` 是否已有 Vue / VueUse API。
- `src/components.d.ts` 是否已有 Vant 组件或本地组件。

当前自动导入覆盖：

- Vue APIs，如 `ref`、`computed`、`watch`、生命周期等。
- VueUse APIs。
- `src/composables` 和 `src/utils` 下导出的函数。
- Vant 组件和本地 Vue 组件。

## 开发约束

来自项目 AGENTS 指令：

- Vue 中的 computed 变量要以 `computed` 开头，例如 `computedLoading`。
- class 不要使用 BEM/BVM 风格，请使用 Less 嵌套。
- 单测、文档不要国际化；保持面向项目当前语言和语境。
- import 导入前先确认包或函数是否已经自动导入。

额外注意：

- TypeScript 开启 `strict`、`noUnusedLocals`、`noUnusedParameters`。
- 路径别名 `@/*` 指向 `src/*`。
- 不要随意改存储 key，否则会影响用户本地数据。
- 修改资产/负债结构时，要考虑历史数据迁移和空字段兼容。
- 涉及摊销算法时，优先在 `src/domain/loanSchedule.test.ts` 增加用例。
- 涉及 CoinMarketCap provider 时，优先在 `api/_lib/coinMarketCap.test.ts` 增加用例。
- 单测和文档不需要做 i18n 抽取。

## 推荐接手路径

1. 先读 `package.json`、`vite.config.ts`、`src/router/index.ts`，确认运行方式和页面入口。
2. 再读 `src/types/ledger.ts`，掌握资产/负债数据形状。
3. 业务读写从 `src/composables/useFinancialLedger.ts` 开始。
4. 负债计算问题从 `src/domain/loanSchedule.ts` 和对应测试开始。
5. 行情问题从 `src/services/marketData.ts`、`api/crypto/quote.ts`、`api/_lib/coinMarketCap.ts` 开始。
6. UI 问题先定位 `src/pages`，再下钻到 `src/components`。

## 常见改动位置

- 新增页面：改 `src/router/index.ts`，新增 `src/pages/*.vue`。
- 新增资产/负债字段：改 `src/types/ledger.ts`、表单组件、`useFinancialLedger.ts` 归一化逻辑，并补兼容。
- 新增分类：改 `src/domain/ledgerCategories.ts`，检查首页和分类页是否还有本地分类常量。
- 改摊销公式：改 `src/domain/loanSchedule.ts`，先补测试。
- 改行情来源：改 `src/services/marketData.ts` 或 `api/_lib/*`，并保留用户可读错误信息。
- 改全局视觉：优先改 `src/styles/finance-theme.less` 和 `src/styles/global.less`。

## 验证建议

文档改动通常不需要跑完整验证。代码改动建议至少执行：

```bash
pnpm run test
pnpm run build
```

如果修改了 UI，请启动 `pnpm run dev` 后用浏览器检查移动端宽度下的首页、资产页、负债页和底部表单。
