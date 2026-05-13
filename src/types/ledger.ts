/** 单条资产（与本地存储结构一致） */
export type AssetValuationMode = 'manual_amount' | 'market_quantity';
export type LegacyInvestmentAssetType = 'fund' | 'stock';
export type InvestmentAssetType = 'security' | 'crypto' | LegacyInvestmentAssetType;
export type AssetCurrency = 'CNY' | 'USD' | 'USDT';
export type LedgerAccountType =
  | 'cash'
  | 'bank'
  | 'payment'
  | 'credit_card'
  | 'loan'
  | 'investment'
  | 'manual_asset';
export type LedgerAccountSide = 'asset' | 'liability';
export type LedgerTransactionType =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'loan_payment'
  | 'investment_buy'
  | 'investment_sell'
  | 'balance_adjustment';
export type LedgerTransactionStatus = 'pending' | 'confirmed' | 'void';
export type LedgerTransactionSource = 'manual' | 'recurring_rule' | 'import' | 'loan_schedule';
export type RecurringRuleFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type RecurringRuleKind = 'income' | 'expense' | 'transfer' | 'loan_payment';

/** 账户：现金、银行卡、信用卡、贷款账户等余额载体 */
export interface AccountRecord {
  id: string;
  name: string;
  type: LedgerAccountType;
  side: LedgerAccountSide;
  currency: AssetCurrency;
  openingBalance: number;
  category?: string;
  description?: string;
  linkedAssetId?: string;
  linkedLiabilityId?: string;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 收入、支出、转账、还贷等维护型流水 */
export interface TransactionRecord {
  id: string;
  date: string;
  type: LedgerTransactionType;
  amount: number;
  currency: AssetCurrency;
  accountId?: string;
  counterAccountId?: string;
  category: string;
  description?: string;
  status: LedgerTransactionStatus;
  source: LedgerTransactionSource;
  sourceId?: string;
  relatedAssetId?: string;
  relatedLiabilityId?: string;
  principalAmount?: number;
  interestAmount?: number;
  feeAmount?: number;
  createdAt: string;
  updatedAt: string;
}

/** 周期规则：工资、房贷、车贷、房租等重复事项 */
export interface RecurringRuleRecord {
  id: string;
  name: string;
  kind: RecurringRuleKind;
  frequency: RecurringRuleFrequency;
  interval: number;
  startDate: string;
  endDate?: string;
  dayOfMonth?: number;
  amount: number;
  currency: AssetCurrency;
  accountId?: string;
  counterAccountId?: string;
  category: string;
  description?: string;
  relatedLiabilityId?: string;
  active: boolean;
  lastConfirmedDate?: string;
  createdAt: string;
  updatedAt: string;
}

/** 从周期规则生成、等待用户确认的发生项 */
export interface RecurringOccurrence {
  id: string;
  ruleId: string;
  date: string;
  name: string;
  kind: RecurringRuleKind;
  amount: number;
  currency: AssetCurrency;
  accountId?: string;
  counterAccountId?: string;
  category: string;
  description?: string;
  relatedLiabilityId?: string;
}

export interface AssetRecord {
  id: string;
  /** 当前展示总价值 */
  name: string;
  amount: number;
  category: string;
  description?: string;
  /** 买入 / 记账日期 */
  purchaseDate?: string;
  valuationMode?: AssetValuationMode;
  investmentType?: InvestmentAssetType;
  quantity?: number;
  unitPrice?: number;
  /** 价格币种到人民币的汇率；加密货币为 USDT/CNY */
  exchangeRate?: number;
  /** 最近一次价格更新时间，优先使用行情源返回的时间 */
  quoteUpdatedAt?: string;
  costPrice?: number;
  symbol?: string;
  currency?: AssetCurrency;
}

/** 等额本息 / 等额本金（房贷、车贷摊销） */
export type RepaymentMethod = 'equal_payment' | 'equal_principal';

/** 单条负债 */
export interface LiabilityRecord {
  id: string;
  name: string;
  /** 合同初始本金 */
  amount: number;
  /** 当前剩余应还本金（摊销类由引擎按 asOf 重算） */
  remaining: number;
  category: string;
  description?: string;
  /** 展示用月供；摊销类由公式写入 */
  monthlyPayment: number;
  /** 年名义利率（%） */
  interestRate: number;
  /** 与 firstPaymentDate 同步镜像，兼容旧读路径 */
  dueDate?: string;
  /** 第一期还款日（起息日同） */
  firstPaymentDate?: string;
  /** 总期数（月） */
  termMonths?: number;
  repaymentMethod?: RepaymentMethod;
  /** 缺摊销字段的旧房贷/车贷为 true，直至用户补全 */
  legacyManual?: boolean;
}

/** 表单提交载荷（资产 / 负债共用底部表单） */
export type LedgerFormPayload = {
  id?: string;
  name: string;
  amount: number;
  category: string;
  description?: string;
  date?: string;
  purchaseDate?: string;
  valuationMode?: AssetValuationMode;
  investmentType?: InvestmentAssetType;
  quantity?: number;
  unitPrice?: number;
  exchangeRate?: number;
  quoteUpdatedAt?: string;
  costPrice?: number;
  symbol?: string;
  currency?: AssetCurrency;
  dueDate?: string;
  monthlyPayment?: number;
  interestRate?: number;
  termMonths?: number;
  repaymentMethod?: RepaymentMethod;
  legacyManual?: boolean;
};
