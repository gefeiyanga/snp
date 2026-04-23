/** 单条资产（与本地存储结构一致） */
export type AssetValuationMode = 'manual_amount' | 'market_quantity';
export type InvestmentAssetType = 'fund' | 'stock' | 'crypto';
export type AssetCurrency = 'CNY' | 'USD' | 'USDT';

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
