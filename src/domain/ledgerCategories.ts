/** 资产大类：展示名 → 存储里可能出现的 category 取值 */
export const ASSET_CATEGORY_GROUPS: { label: string; aliases: readonly string[] }[] = [
  { label: '现金', aliases: ['现金'] },
  { label: '银行', aliases: ['银行', '银行资金'] },
  { label: '投资', aliases: ['投资'] },
  { label: '其他', aliases: ['其他', '房产', '不动产', '汽车', '车辆'] }
] as const;

/** 负债类别：与表单标签、存储 category 一致 */
export const LIABILITY_CATEGORY_LABELS = ['房贷', '车贷', '信用卡', '其他'] as const;
export type LiabilityCategoryLabel = (typeof LIABILITY_CATEGORY_LABELS)[number];

export function assetGroupAliases(label: string): readonly string[] {
  const g = ASSET_CATEGORY_GROUPS.find((x) => x.label === label);
  return g?.aliases ?? [label];
}

export function assetMatchesGroupLabel(storedCategory: string, groupLabel: string): boolean {
  return assetGroupAliases(groupLabel).includes(storedCategory);
}

/** 将存储里的 category 映射到表单标签（如 银行资金 → 银行）；未知类别归入「其他」 */
export function assetCanonicalLabel(storedCategory: string): string {
  const g = ASSET_CATEGORY_GROUPS.find((x) => (x.aliases as readonly string[]).includes(storedCategory));
  if (g) return g.label;
  return ASSET_CATEGORY_GROUPS.find((x) => x.label === '其他')?.label ?? storedCategory;
}

export function normalizeLiabilityCategory(raw: string): LiabilityCategoryLabel {
  const hit = LIABILITY_CATEGORY_LABELS.find((x) => x === raw);
  return hit ?? '其他';
}
