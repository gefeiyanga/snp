# 维护型账本底座 Implementation Plan

> 对应规格：`docs/superpowers/specs/2026-05-08-ledger-maintenance-design.md`

**Goal:** 先建立账户、流水、周期规则和待确认发生项的数据底座，让每日收支、每月工资、房贷/车贷还款可以用事件维护，而不是手动改资产/负债结果。

**Architecture:** `src/types/ledger.ts` 扩展账本类型；`src/domain/cashflow.ts` 放周期生成与余额计算纯函数；`src/composables/useCashflowLedger.ts` 用 localforage 管理 `accounts`、`transactions`、`recurringRules`；`src/domain/loanSchedule.ts` 补单期还款拆分。

---

## Task 1: 数据模型

- [x] 在 `src/types/ledger.ts` 增加 `AccountRecord`。
- [x] 在 `src/types/ledger.ts` 增加 `TransactionRecord`。
- [x] 在 `src/types/ledger.ts` 增加 `RecurringRuleRecord`。
- [x] 在 `src/types/ledger.ts` 增加 `RecurringOccurrence`。

## Task 2: 纯业务函数

- [x] 新增 `src/domain/cashflow.ts`。
- [x] 实现周期规则发生项生成。
- [x] 实现待确认发生项转流水。
- [x] 实现账户余额计算。
- [x] 在 `src/domain/loanSchedule.ts` 增加单期还款拆分。

## Task 3: localforage 仓储

- [x] 新增 `src/composables/useCashflowLedger.ts`。
- [x] 增加账户仓储 `useAccountRecords()`。
- [x] 增加流水仓储 `useTransactionRecords()`。
- [x] 增加周期规则仓储 `useRecurringRuleRecords()`。
- [x] 实现待确认发生项查询与确认。

## Task 4: 测试

- [x] 为周期规则生成补单测。
- [x] 为账户余额计算补单测。
- [x] 为贷款单期拆分补单测。
- [x] 运行 `pnpm run test`。
- [x] 运行 `pnpm run build`。

## Task 5: 首页维护入口

- [x] 首页增加「待确认」模块，读取 `pendingOccurrences()`。
- [x] 首页增加快速记账入口，写入 `TransactionRecord`。
- [x] 首页展示账户余额与最近流水。
- [x] 首次快速记账时自动创建默认现金账户。

## 后续 UI 任务

- [ ] 增加账户管理页或底部弹层。
- [ ] 房贷/车贷详情页增加「确认本期还款」动作。
- [ ] 提供旧资产/负债生成账户初始余额的显式迁移入口。
