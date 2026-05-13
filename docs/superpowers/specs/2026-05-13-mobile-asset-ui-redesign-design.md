# Mobile Asset UI Redesign Design

Date: 2026-05-13

## Goal

Redesign the mobile asset management experience into a simple, modern, finance-tool interface with clear hierarchy and shorter operation paths. The redesign keeps the existing business capabilities:

- Asset overview
- Asset page
- Liability page
- Asset and liability categories
- Detail lists
- Add asset and add liability bottom sheets
- Quick income and expense entry

The work is UI and interaction layer only. It must not change storage keys, ledger data contracts, quote refresh behavior, amortization logic, or repository APIs.

## Direction

Use the approved **data-first tool** direction.

The interface should use a quiet neutral system:

- Page background: `#F7F8FA`
- Card background: `#FFFFFF`
- Primary text: `#111827`
- Secondary text: `#6B7280`
- Muted text: `#9CA3AF`
- Divider: `#EEF0F3`
- Asset, positive, and income accent: `#10B981`
- Liability, negative, and expense accent: `#EF4444` or `#E11D48`
- Investment accent: `#F59E0B`
- Bank accent: `#3B82F6`
- Other accent: `#6B7280`

Color is reserved for amounts, category icons, small tags, buttons, and lightweight chart elements. Large saturated gradients should be removed from the overview, asset, liability, and sheet surfaces.

## Shared UI System

Introduce or refactor toward these reusable display components where practical:

- `AmountText`: shared amount formatting and semantic color handling.
- `PageHeader`: mobile header with optional back and add actions.
- `SummaryCard`: white primary card for net asset, total asset, or total liability summaries.
- `QuickActions`: homepage quick income and expense actions.
- `CategoryGrid` and `CategoryCard`: two-column category summaries.
- `DetailList` and `DetailListItem`: category detail rows.
- `BottomSheet`: bottom sheet shell behavior and fixed action area.
- `AssetForm` and `DebtForm`: form sections inside the sheet, or equivalent internal split if keeping the current component file is lower risk.
- `EmptyState`: consistent lightweight empty states.

Cards use:

```less
border-radius: 16px;
background: #fff;
box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
border: 1px solid rgba(15, 23, 42, 0.04);
```

Interactive controls must have at least 44px touch height. Page bottoms reserve:

```less
padding-bottom: calc(24px + env(safe-area-inset-bottom));
```

Amounts use tabular numerals:

```less
font-variant-numeric: tabular-nums;
```

## Amount Display Rules

All pages and sheets should share these display rules:

- Main amount: `¥6,921.92`
- Category amount: `¥6,921.92`
- Zero: `¥0.00`
- Positive change: `+¥909.18 / +20.29%`
- Negative change: `-¥120.00 / -3.42%`
- No comparison data: `暂无对比数据`
- No generic missing value dashes for user-facing data. Use `暂无数据`, `暂无记录`, or `暂无负债数据`.

Compact values are allowed only when horizontal space is truly constrained. Do not use Chinese shorthand such as `6.9千`.

## Page 1: Asset Overview

The homepage should immediately communicate net worth, total assets, total liabilities, and month comparison.

Structure:

1. Header: simple title `资产总览`, no complex background.
2. Main summary card:
   - Label: `净资产`
   - Main amount
   - Explanation: `总资产 - 总负债`
   - Three columns: `总资产`, `总负债`, `较上月`
   - If month comparison is unavailable, show `暂无数据`.
   - Use a small green accent line or tag only, not a full-card gradient.
3. Quick actions:
   - `记支出`: light red background, red text, minus icon.
   - `记收入`: light green background, green text, plus icon.
   - 48px height, 14px radius, two columns.
   - Secondary entries such as transfer and add asset may exist only if they do not crowd the first viewport.
4. Pending confirmations:
   - Title: `待确认`
   - Empty: `暂无待确认事项`
   - Keep compact.
5. Distributions:
   - `资产分布` and `负债分布` as lightweight cards.
   - Use progress rows when only one category exists, for example `投资  ¥6,921.92  100%`.
   - Use an empty state for liabilities when there is no liability data.
6. Account balance and recent transactions:
   - Keep existing business capability.
   - Visually demote below the primary financial overview and quick actions.

## Page 2: Assets

The asset page focuses on total assets, asset categories, and detail navigation.

Structure:

1. Header:
   - Left: back button
   - Center: `资产`
   - Right: add button with clear accessible label `新增资产`
2. Total asset summary card:
   - White card with a thin green accent.
   - `总资产`
   - Main amount
   - `净资产`
   - `较上月`
   - If comparison is unavailable, show `暂无对比数据`.
3. Asset category grid:
   - Four categories: `现金`, `银行`, `投资`, `其他`
   - Two-column grid, 12px gap.
   - Card height around 128px.
   - Show icon, category name, amount, record count, and change data when available.
   - Zero categories remain readable but visually quiet: `¥0.00`, `0 笔记录`.
4. Detail list:
   - Title: `明细列表`
   - Each row: category icon or color dot, category name, secondary metadata, amount, and arrow only because it enters the category detail page.
   - Row height around 72px.

Existing investment return calculations should be reused for investment change display.

## Page 3: Liabilities

The liability page mirrors the asset page and switches semantics to debt/red.

Structure:

1. Header:
   - Left: back button
   - Center: `负债`
   - Right: add button with clear accessible label `新增负债`
2. Total liability summary card:
   - White card with red emphasis.
   - `总负债`
   - Main amount in liability red.
   - `已还金额`
   - `负债笔数`
   - If there are no liabilities, show `暂无负债记录` in the card.
3. Liability category grid:
   - Four categories: `房贷`, `车贷`, `信用卡`, `其他`
   - Show category name, amount or `暂无`, and record count.
   - Empty cards should be subdued, not visually heavy.
4. Detail list:
   - Same list rhythm as assets.
   - If no liabilities exist, show a lightweight empty state `暂无负债数据`.

## Page 4: Add Asset and Add Liability Bottom Sheet

Refactor the current sheet into a modern bottom sheet while preserving submit payloads and repository behavior.

Sheet shell:

- Bottom-position popup.
- Top-left and top-right radius: 24px.
- Max height: 85vh.
- Scrollable content area.
- Fixed bottom action area.
- Overlay: `rgba(0, 0, 0, 0.45)`.
- Avoid page and sheet scroll conflicts with contained overscroll behavior.

Asset sheet:

- Header: `新增资产` and close button.
- Category tabs: `投资`, `现金`, `银行`, `其他`.
- Active tab: green text and light green background.
- Inactive tabs: gray text.
- Base fields:
  - `资产名称`, placeholder `例如 纳指ETF、苹果、比特币`
  - `当前金额`, placeholder `请输入当前资产金额`
  - `备注`, placeholder `可选`
- Investment-only fields:
  - `投资类型`: `股票/基金`, `加密货币`
  - `标的代码`, placeholder `例如 510300 / AAPL / BTC`
  - `持有数量`, placeholder `请输入持有数量`
  - `当前价格`, placeholder `用于计算当前总价值`
  - Secondary button `查询价格`
  - Hint: `可根据持有数量和当前价格自动计算总资产价值`
- Save disabled until required fields are valid.
- Query price button remains visually secondary.
- Save success closes the sheet and refreshes lists.

Liability sheet:

- Keep existing debt creation and amortization fields.
- Apply the same bottom sheet shell, typography, tabs, and fixed action behavior.
- Do not remove existing mortgage and car-loan calculation support.

## Data Flow

Preserve existing data repositories:

- Assets continue through `useAssetRecords()`.
- Liabilities continue through `useLiabilityRecords()`.
- Quick income and expense continue through `useCashflowLedger()`.
- Asset and liability form submissions continue through `upsertFromForm()`.

Do not change:

- `assets` or `liabilities` localforage storage keys.
- Historical data compatibility.
- Market quote lookup contracts.
- Investment return calculation contracts.
- Mortgage and car-loan amortization contracts.

## Error Handling and Empty States

Validation:

- Required fields disable primary save where possible.
- Submit still validates and shows toasts for invalid data.
- Numeric inputs should normalize to valid numeric strings.

Empty states:

- `暂无记录`
- `暂无待确认事项`
- `暂无负债数据`
- `暂无对比数据`
- `暂无数据`

No user-facing placeholders should be bare `—` when the meaning can be stated.

## Testing and Verification

After implementation:

1. Run `pnpm run build`.
2. Run relevant tests, preferably `pnpm run test` if the current repo state allows it.
3. Start `pnpm run dev`.
4. Inspect mobile viewport for:
   - Homepage summary visibility.
   - Asset category grid and detail list.
   - Liability page empty and non-empty states.
   - Add asset bottom sheet on a small viewport.
   - Save button visibility and disabled state.
   - No large green/pink/orange gradient cards.
   - No incoherent overlapping text.

## Open Decisions

- Whether transfer should be implemented as a visible secondary homepage quick action or left out of this redesign pass.
- Whether account balances and recent transactions should remain on the homepage below distributions or move behind a secondary route later. For this pass, keep them but visually demote them.
