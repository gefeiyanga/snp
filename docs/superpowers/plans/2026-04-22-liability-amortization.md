# 房贷/车贷标准摊销（动态剩余本金）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为类别「房贷」「车贷」的负债实现标准摊销（等额本息 / 等额本金二选一），以「第一期还款日」为锚、以本地「今天」为 asOf 计算已还期数与剩余本金；信用卡/其他保持手工剩余；旧数据 legacy 直至补全字段。

**Architecture:** 纯函数域模块 `src/domain/loanSchedule.ts` 负责应还日、已还期数、剩余本金与展示月供；`LiabilityRecord` 扩展摊销字段；`useLiabilityRecords().list()` 读库后对非 legacy 的房贷/车贷行做 **hydrate**（重算 `remaining` / `monthlyPayment` 并按 spec 可选写回）；`ModernBottomSheet` 在房贷/车贷时收集摊销参数并隐藏手工月供输入。

**Tech Stack:** Vue 3、TypeScript、Vant、localforage（现有）、Vitest（新增用于域逻辑单测）、Vite。

---

## 文件结构（创建 / 修改一览）

| 路径 | 职责 |
|------|------|
| `package.json` | 增加 `vitest` 脚本与 devDependency |
| `vitest.config.ts` | Vitest + `@vitejs/plugin-vue`（与 Vite 一致，便于后续组件测） |
| `src/domain/loanSchedule.ts` | **新建**：应还日、已还期数、等额本息/等额本金剩余本金、是否摊销类别、legacy 判定 |
| `src/domain/loanSchedule.test.ts` | **新建**：上述纯函数单测 |
| `src/types/ledger.ts` | 扩展 `LiabilityRecord`、`LedgerFormPayload`（`termMonths`、`repaymentMethod`、`legacyManual?`、`firstPaymentDate` 与 `dueDate` 关系见任务说明） |
| `src/composables/useFinancialLedger.ts` | `list` 后 hydrate；`create`/`update`/`upsertFromForm` 对摊销类写入重算后的 `remaining`/`monthlyPayment` |
| `src/components/ModernBottomSheet.vue` | 负债 + 房贷/车贷时 UI：还款方式、期数、首期日；月供只读；校验 |
| `src/pages/LiabilityCategoryPage.vue` | 展示摊销后的剩余与月供（读 list 已 hydrate 即可，小改若有） |
| `src/pages/LiabilitiesPage.vue` | 汇总行与 legacy 提示（可选 Toast/副文案） |

**规格来源：** `docs/superpowers/specs/2026-04-22-liability-amortization-design.md`

---

### Task 1: 接入 Vitest

**Files:**

- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1.1: 安装依赖**

```bash
cd /Users/gefeiyang/personal/snp && pnpm add -D vitest@3.0.9
```

预期：`package.json` 出现 `vitest` devDependency，`pnpm-lock.yaml` 更新。

- [ ] **Step 1.2: 写入 `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false
  }
});
```

- [ ] **Step 1.3: 修改 `package.json` 的 `scripts`**

在 `"scripts"` 中增加一行（保留原有键）：

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 1.4: 运行 Vitest（尚无测试时应 0 通过或跳过）**

```bash
cd /Users/gefeiyang/personal/snp && pnpm exec vitest run
```

预期：命令成功退出（可能显示 no tests）。

- [ ] **Step 1.5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: add vitest for domain unit tests"
```

---

### Task 2: 应还日与「已还期数」纯函数 + 单测

**Files:**

- Create: `src/domain/loanSchedule.ts`
- Create: `src/domain/loanSchedule.test.ts`

**约定（与 spec 一致）：**

- 日期字符串格式 `YYYY-MM-DD`，比较时按 **日历日**（不含时区复杂转换 v1：用本地解析 `new Date(y, m-1, d)` 与 `asOf` 同日比较）。
- 第 `k` 期（1-based）应还日：`firstPaymentDate` 加 `k-1` 个月；若目标月无同日，取该月 **最后一天**。
- `paidPeriods` = 满足 `due(k) <= asOf` 的最大 `k`，无则为 `0`。
- `asOf` 以 `YYYY-MM-DD` 传入，由调用方用「今天」生成。

- [ ] **Step 2.1: 新建 `src/domain/loanSchedule.ts`（首版最小实现）**

```typescript
/** 房贷 / 车贷启用摊销引擎 */
export const AMORTIZING_LIABILITY_CATEGORIES = ['房贷', '车贷'] as const;

export type RepaymentMethod = 'equal_payment' | 'equal_principal';

export function isAmortizingCategory(category: string): boolean {
  return (AMORTIZING_LIABILITY_CATEGORIES as readonly string[]).includes(category);
}

/** 缺任一项则视为 legacy，不自动摊销 */
export function isLegacyAmortizationRow(row: {
  category: string;
  termMonths?: number;
  repaymentMethod?: RepaymentMethod;
  firstPaymentDate?: string;
  dueDate?: string;
}): boolean {
  if (!isAmortizingCategory(row.category)) return false;
  const first = row.firstPaymentDate ?? row.dueDate;
  const term = row.termMonths;
  const method = row.repaymentMethod;
  if (!first || !term || term < 1 || !method) return true;
  return false;
}

/** 将 YYYY-MM-DD 解析为本地日历 Date（UTC 中午避免 DST 边界，可选） */
function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 目标年月最后一天 */
function lastDayOfMonth(year: number, monthIndex0: number): Date {
  return new Date(year, monthIndex0 + 1, 0);
}

/**
 * 在 (year, month) 上安放「目标日」：若该月天数不足，用月末。
 */
function clampDayInMonth(year: number, monthIndex0: number, targetDay: number): Date {
  const last = lastDayOfMonth(year, monthIndex0);
  const day = Math.min(targetDay, last.getDate());
  return new Date(year, monthIndex0, day);
}

/**
 * 第 period 期（1-based）应还日。
 */
export function nthDueDate(firstPaymentYmd: string, period: number): string {
  if (period < 1) throw new Error('period must be >= 1');
  const first = parseYmd(firstPaymentYmd);
  const targetDay = first.getDate();
  const y0 = first.getFullYear();
  const m0 = first.getMonth();
  const totalShift = period - 1;
  const y = y0 + Math.floor((m0 + totalShift) / 12);
  const m = ((m0 + totalShift) % 12 + 12) % 12;
  return formatYmd(clampDayInMonth(y, m, targetDay));
}

export function compareYmd(a: string, b: string): number {
  return a.localeCompare(b);
}

export function paidPeriods(firstPaymentYmd: string, termMonths: number, asOfYmd: string): number {
  let k = 0;
  for (let p = 1; p <= termMonths; p++) {
    if (compareYmd(nthDueDate(firstPaymentYmd, p), asOfYmd) <= 0) k = p;
    else break;
  }
  return k;
}

function monthlyRateFromAnnualPercent(annualPercent: number): number {
  return annualPercent / 100 / 12;
}

/** 等额本息：还完 k 期后的剩余本金。k ∈ [0, n] */
export function remainingAfterEqualPayment(
  principal: number,
  annualPercent: number,
  termMonths: number,
  paidPeriods: number
): number {
  const n = termMonths;
  const k = Math.min(Math.max(paidPeriods, 0), n);
  const P = principal;
  if (k >= n) return 0;
  const r = monthlyRateFromAnnualPercent(annualPercent);
  if (r === 0) return P - (P / n) * k;
  const pow = (b: number, e: number) => Math.pow(b, e);
  return (P * (pow(1 + r, n) - pow(1 + r, k))) / (pow(1 + r, n) - 1);
}

/** 等额本金：还完 k 期后的剩余本金 */
export function remainingAfterEqualPrincipal(
  principal: number,
  annualPercent: number,
  termMonths: number,
  paidPeriods: number
): number {
  const n = termMonths;
  const k = Math.min(Math.max(paidPeriods, 0), n);
  if (k >= n) return 0;
  return principal - (principal / n) * k;
}

/** 等额本息首期月供（用于只读展示） */
export function firstInstallmentEqualPayment(principal: number, annualPercent: number, termMonths: number): number {
  const P = principal;
  const n = termMonths;
  const r = monthlyRateFromAnnualPercent(annualPercent);
  if (r === 0) return P / n;
  return (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/** 等额本金首期月供（本金 + 首期利息） */
export function firstInstallmentEqualPrincipal(principal: number, annualPercent: number, termMonths: number): number {
  const P = principal;
  const n = termMonths;
  const r = monthlyRateFromAnnualPercent(annualPercent);
  const principalPart = P / n;
  return principalPart + P * r;
}

export function roundMoney2(x: number): number {
  return Math.round(x * 100) / 100;
}
```

- [ ] **Step 2.2: 新建 `src/domain/loanSchedule.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import {
  firstInstallmentEqualPayment,
  isLegacyAmortizationRow,
  nthDueDate,
  paidPeriods,
  remainingAfterEqualPayment,
  remainingAfterEqualPrincipal
} from './loanSchedule';

describe('nthDueDate', () => {
  it('rolls month with clamp to month end', () => {
    expect(nthDueDate('2020-01-31', 1)).toBe('2020-01-31');
    expect(nthDueDate('2020-01-31', 2)).toBe('2020-02-29');
  });
  it('stable on 15th anchor', () => {
    expect(nthDueDate('2024-06-15', 2)).toBe('2024-07-15');
  });
});

describe('paidPeriods', () => {
  it('counts periods whose due <= asOf', () => {
    expect(paidPeriods('2024-01-10', 12, '2024-01-09')).toBe(0);
    expect(paidPeriods('2024-01-10', 12, '2024-01-10')).toBe(1);
    expect(paidPeriods('2024-01-10', 12, '2024-03-09')).toBe(2);
    expect(paidPeriods('2024-01-10', 12, '2024-03-10')).toBe(3);
  });
});

describe('equal payment r=0', () => {
  it('linear principal', () => {
    expect(remainingAfterEqualPayment(1000, 0, 10, 3)).toBe(700);
    expect(firstInstallmentEqualPayment(1000, 0, 10)).toBe(100);
  });
});

describe('legacy', () => {
  it('车贷缺 term 为 legacy', () => {
    expect(
      isLegacyAmortizationRow({
        category: '车贷',
        termMonths: undefined,
        repaymentMethod: 'equal_payment',
        firstPaymentDate: '2024-01-01'
      })
    ).toBe(true);
  });
  it('信用卡不 legacy', () => {
    expect(isLegacyAmortizationRow({ category: '信用卡' })).toBe(false);
  });
});

describe('equal principal balance', () => {
  it('decreases by P/n each period regardless of rate for balance', () => {
    expect(remainingAfterEqualPrincipal(120000, 6, 24, 6)).toBeCloseTo(90000, 5);
  });
});
```

- [ ] **Step 2.3: 运行测试**

```bash
cd /Users/gefeiyang/personal/snp && pnpm exec vitest run src/domain/loanSchedule.test.ts
```

预期：全部 PASS。

- [ ] **Step 2.4: Commit**

```bash
git add src/domain/loanSchedule.ts src/domain/loanSchedule.test.ts
git commit -m "feat(domain): add loan schedule and amortization helpers"
```

---

### Task 3: 类型与仓储 hydrate / 写回

**Files:**

- Modify: `src/types/ledger.ts`
- Modify: `src/composables/useFinancialLedger.ts`

**字段约定：**

- `repaymentMethod?: 'equal_payment' | 'equal_principal'`
- `termMonths?: number`
- `firstPaymentDate?: string`（若与 `dueDate` 并存：写入时 **同时** 写 `dueDate = firstPaymentDate` 以保持旧读路径兼容，或在全仓把「首期」统一改名为 `firstPaymentDate` 并迁移读取；**本计划推荐**：新字段 `firstPaymentDate` 为主，`dueDate` 镜像同步。）
- `legacyManual?: boolean` — 迁移脚本可选：首次读取旧数组时若房贷/车贷缺字段则 `legacyManual: true`；用户保存完整摊销表单后置 `false`。

- [ ] **Step 3.1: 扩展 `src/types/ledger.ts`**

在 `LiabilityRecord` 上增加：

```typescript
export type RepaymentMethod = 'equal_payment' | 'equal_principal';

export interface LiabilityRecord {
  id: string;
  name: string;
  amount: number;
  remaining: number;
  category: string;
  description?: string;
  monthlyPayment: number;
  interestRate: number;
  dueDate?: string;
  firstPaymentDate?: string;
  termMonths?: number;
  repaymentMethod?: RepaymentMethod;
  /** 缺摊销字段的旧房贷/车贷为 true */
  legacyManual?: boolean;
}
```

在 `LedgerFormPayload` 增加可选：`termMonths?: number; repaymentMethod?: RepaymentMethod; legacyManual?: boolean;`

- [ ] **Step 3.2: 在 `useFinancialLedger.ts` 顶部 import 域函数**

```typescript
import {
  firstInstallmentEqualPayment,
  firstInstallmentEqualPrincipal,
  isAmortizingCategory,
  isLegacyAmortizationRow,
  paidPeriods,
  remainingAfterEqualPayment,
  remainingAfterEqualPrincipal,
  roundMoney2
} from '@/domain/loanSchedule';
```

- [ ] **Step 3.3: 新增纯函数 `todayYmd()` 与 `hydrateLiability(row: LiabilityRecord): LiabilityRecord`**

在同一文件 `useFinancialLedger.ts` 内、`useLiabilityRecords` 外，或放在 `loanSchedule.ts`（更纯）。推荐放 `loanSchedule.ts`：

```typescript
export function todayYmd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function hydrateLiability(row: LiabilityRecord): LiabilityRecord {
  if (!isAmortizingCategory(row.category) || isLegacyAmortizationRow(row)) {
    return row;
  }
  const first = row.firstPaymentDate ?? row.dueDate;
  const term = row.termMonths!;
  const method = row.repaymentMethod!;
  const k = paidPeriods(first, term, todayYmd());
  const P = row.amount;
  const rate = row.interestRate;
  let remaining = 0;
  if (method === 'equal_payment') {
    remaining = roundMoney2(remainingAfterEqualPayment(P, rate, term, k));
  } else {
    remaining = roundMoney2(remainingAfterEqualPrincipal(P, rate, term, k));
  }
  const mp =
    method === 'equal_payment'
      ? roundMoney2(firstInstallmentEqualPayment(P, rate, term))
      : roundMoney2(firstInstallmentEqualPrincipal(P, rate, term));
  return { ...row, remaining, monthlyPayment: mp, dueDate: first, firstPaymentDate: first };
}
```

- [ ] **Step 3.4: 修改 `list()`**

将 `list` 改为（概念上）：

```typescript
const list = async (): Promise<LiabilityRecord[]> => {
  const raw = (await getItem<LiabilityRecord[]>(STORAGE_LIABILITIES)) ?? [];
  return raw.map((r) => hydrateLiability(migrateLegacyFlag(r)));
};
```

其中 `migrateLegacyFlag`：若 `isAmortizingCategory` 且缺字段，则 `{ ...r, legacyManual: true }`，否则若字段齐且 `legacyManual === undefined` 则 `{ ...r, legacyManual: false }`（实现时写清分支）。

- [ ] **Step 3.5: 修改 `create` / `update` / `upsertFromForm`**

在写入前对非 legacy 的房贷/车贷：

1. 用表单/合并后的 `amount`、`interestRate`、`termMonths`、`repaymentMethod`、`firstPaymentDate`（来自 `dueDate`/`data.date`）构造临时 `LiabilityRecord`。
2. `const h = hydrateLiability(temp)`，将 `remaining`、`monthlyPayment`、`dueDate`、`firstPaymentDate` 一并写入存储。

**注意：** `upsertFromForm` 当前把表单 `amount` 当作「剩余」用于编辑 — **摊销类需改为**：表单主金额字段表示 **合同本金**（与 spec「买入金额/负债金额」文案调整配合 Task 4）；非摊销类保持「剩余可编辑」语义。实现时在 `upsertFromForm` 分分支：

```typescript
const isAm = isAmortizingCategory(data.category);
const legacy = /* from existing row or true if missing fields */;
if (isAm && !legacy) {
  // principal = Number(data.amount), build row, hydrate, save
}
```

（具体合并逻辑以 Task 4 表单字段为准。）

- [ ] **Step 3.6: 运行**

```bash
pnpm exec oxlint src/composables/useFinancialLedger.ts src/types/ledger.ts src/domain/loanSchedule.ts
pnpm exec vitest run
```

预期：oxlint 0 问题；vitest 全通过。

- [ ] **Step 3.7: Commit**

```bash
git add src/types/ledger.ts src/composables/useFinancialLedger.ts
git commit -m "feat(ledger): hydrate amortizing mortgage/car loans"
```

---

### Task 4: ModernBottomSheet 负债表单（房贷/车贷）

**Files:**

- Modify: `src/components/ModernBottomSheet.vue`

**行为：**

- 当 `type === 'liability'` 且 `activeType` 为 `房贷` 或 `车贷`：
  - 展示 **还款方式**：两个 `van-tag` 或 `van-radio-group`，值映射 `equal_payment` / `equal_principal`。
  - 展示 **总期数（月）**：`van-field` type=digit，绑定 `formData.termMonths`。
  - **年利率** 已有字段，改为必填（保存前校验）。
  - **第一期还款日**：沿用现有日期选择（`dateLabel` 可改为「第一期还款日」）。
  - **月供**：改为 **只读** `van-field`：`computedPreviewMonthly`，依赖 `amount`/`interestRate`/`termMonths`/`repaymentMethod`/`date`；若参数不齐显示 `—`。
  - **主金额输入**：`amountLabel` 改为「合同本金（元）」；编辑模式下若摊销类，仍编辑合同本金（与 spec 一致）。
- 当类别为 **信用卡 / 其他**：保留现有可编辑月供、利率可选；主金额仍为「负债金额 / 当前剩余本金」（与现逻辑一致）。
- `submit` 的 payload 增加 `termMonths`、`repaymentMethod`（及 `legacyManual: false` 当齐套）。

**Props：** 可增加 `mode` 已存在；无需新增 props 若用 `activeType` 判定。

- [ ] **Step 4.1: 扩展 `FormData` 接口**（同文件 script）增加 `termMonths: string`、`repaymentMethod: 'equal_payment' | 'equal_principal'` 默认值 `equal_payment`。

- [ ] **Step 4.2: `watch(initialData)` 合并** `termMonths`、`repaymentMethod` 从 `initialData`。

- [ ] **Step 4.3: `submit` 校验** — 房贷/车贷：`termMonths` 正整数、`interestRate` 必填且 ≥0、`date` 合法；否则 `showToast`。

- [ ] **Step 4.4: 本地手动验证**

```bash
pnpm dev
```

浏览器：新增车贷 → 选等额本息 → 填本金/利率/期数/首期日 → 只读月供有数 → 保存 → 负债列表剩余随「今天」变化（与 Task 3 联调）。

- [ ] **Step 4.5: Commit**

```bash
git add src/components/ModernBottomSheet.vue
git commit -m "feat(ui): amortization fields for mortgage and car loans"
```

---

### Task 5: 页面与文案

**Files:**

- Modify: `src/pages/LiabilityCategoryPage.vue`（若列表已用 `list()` hydrate，可仅加 **legacy** 角标或副标题「按上次手工剩余，补全参数后启用摊销」）
- Modify: `src/pages/LiabilitiesPage.vue`（类别卡上对 legacy 显示小灰标）

- [ ] **Step 5.1: 在 `LiabilitiesPage` 的 `liabilityCategories` 或渲染处** 判断 `isLegacyAmortizationRow(category...)` 需对聚合维度：可对 `category.liabilities` 中任一条为 legacy 则显示（简化：若该类别下存在 legacy 行则提示）。

- [ ] **Step 5.2: Commit**

```bash
git add src/pages/LiabilitiesPage.vue src/pages/LiabilityCategoryPage.vue
git commit -m "feat(ui): indicate legacy amortization loans"
```

---

### Task 6: 收尾与回归

- [ ] **Step 6.1: 全量静态检查**

```bash
pnpm exec oxlint
pnpm exec vitest run
pnpm exec vue-tsc --noEmit
```

（若 `vue-tsc` 因仓库历史错误失败，记录与摊销无关的既有错误链接到 PR 说明；**新文件**不得增加错误。）

- [ ] **Step 6.2: 手工回归清单**

1. 新建 **信用卡**：行为与改前一致。  
2. 新建 **车贷** 等额本息：保存后首页总负债、负债分布与类别页一致；把系统日期 mock（若可）或改首期日为过去多月，确认 `remaining` 下降。  
3. **legacy**：清空 `termMonths` 的旧记录（手工改 localforage）应不崩溃且显示 legacy。  
4. 编辑车贷参数后保存，列表与详情一致。

- [ ] **Step 6.3: Commit**

```bash
git commit --allow-empty -m "chore: finish amortization QA notes" || true
```

---

## Self-review（计划 vs spec）

| Spec 章节 | 对应任务 |
|-----------|----------|
| §2 模型 B / 房贷车贷 / 二选一 / 首期日=起息 / asOf=今天 | Task 2–4 |
| §3 字段 | Task 3 + Task 4 |
| §4 计算与月末说明 | Task 2 `paidPeriods` + `nthDueDate` |
| §5 读路径 hydrate + 写回 | Task 3 |
| §6 UI | Task 4–5 |
| §7 legacy | Task 2 `isLegacy` + Task 3 migrate + Task 5 |
| §8 测试 | Task 2 + Task 6 |

**Placeholder 扫描：** 本计划未使用「TBD / 稍后实现」类占位；`migrateLegacyFlag` 在 Task 3 要求实现者写清分支（已在叙述中限定行为）。

**命名一致性：** 全篇使用 `repaymentMethod`、`termMonths`、`firstPaymentDate` / `dueDate` 镜像策略；`equal_payment` / `equal_principal` 与 `loanSchedule.ts` 导出类型一致。

**缺口补全：** `LedgerFormPayload` 已在 Task 3 声明扩展；`HomePage` 若直接 `getItem` 需改为 `useLiabilityRecords().list()` 才能 hydrate — 若仍存在裸读，计划在 Task 3 自检时 **追加一步**：全局 `rg "getItem.*liabilities"` 并替换为 `list()`。

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-22-liability-amortization.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — 每个 Task 派生子代理并在 Task 间做简短审查，迭代快。  
**2. Inline Execution** — 在本会话用 executing-plans 按 Task 执行并设检查点。

**Which approach?**

（若选 1：请使用 **superpowers:subagent-driven-development**；若选 2：请使用 **superpowers:executing-plans**。）
