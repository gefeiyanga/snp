import { useStorage } from '@/composables/useStorage';
import type { AssetRecord, LiabilityRecord, LedgerFormPayload, RepaymentMethod } from '@/types/ledger';
import {
  hydrateLiability,
  isAmortizingCategory,
  isLegacyAmortizationRow,
  migrateLegacyFlags
} from '@/domain/loanSchedule';

const STORAGE_ASSETS = 'assets';
const STORAGE_LIABILITIES = 'liabilities';

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function hasFullAmortizationPayload(data: LedgerFormPayload): boolean {
  return !!(
    data.termMonths !== undefined &&
    data.termMonths >= 1 &&
    data.repaymentMethod &&
    (data.dueDate || data.date)
  );
}

/**
 * 资产：列表读写 + 单条增删改（与页面解耦，便于单测与复用）
 */
export function useAssetRecords() {
  const { getItem, setItem } = useStorage();

  const list = async (): Promise<AssetRecord[]> => (await getItem<AssetRecord[]>(STORAGE_ASSETS)) ?? [];

  const saveAll = async (rows: AssetRecord[]) => {
    await setItem(STORAGE_ASSETS, rows);
  };

  const getById = async (id: string): Promise<AssetRecord | null> => {
    const rows = await list();
    return rows.find((r) => r.id === id) ?? null;
  };

  const create = async (input: Omit<AssetRecord, 'id'>): Promise<AssetRecord> => {
    const row: AssetRecord = {
      id: createId(),
      name: input.name,
      amount: Number(input.amount),
      category: input.category,
      description: input.description ?? '',
      purchaseDate: input.purchaseDate
    };
    const rows = await list();
    rows.push(row);
    await saveAll(rows);
    return row;
  };

  const update = async (id: string, patch: Partial<Omit<AssetRecord, 'id'>>): Promise<AssetRecord | null> => {
    const rows = await list();
    const i = rows.findIndex((r) => r.id === id);
    if (i === -1) return null;
    rows[i] = { ...rows[i], ...patch };
    await saveAll(rows);
    return rows[i];
  };

  const remove = async (id: string): Promise<boolean> => {
    const rows = await list();
    const next = rows.filter((r) => r.id !== id);
    if (next.length === rows.length) return false;
    await saveAll(next);
    return true;
  };

  /** 从底部表单保存（新增或更新） */
  const upsertFromForm = async (data: LedgerFormPayload): Promise<AssetRecord> => {
    const base = {
      name: data.name,
      amount: Number(data.amount),
      category: data.category,
      description: data.description ?? '',
      purchaseDate: data.purchaseDate ?? data.date
    };
    if (data.id) {
      const updated = await update(data.id, base);
      if (updated) return updated;
    }
    return create(base);
  };

  return { list, saveAll, getById, create, update, remove, upsertFromForm };
}

/**
 * 负债：列表读写 + 单条增删改
 */
export function useLiabilityRecords() {
  const { getItem, setItem } = useStorage();

  async function readRaw(): Promise<LiabilityRecord[]> {
    return (await getItem<LiabilityRecord[]>(STORAGE_LIABILITIES)) ?? [];
  }

  const saveAll = async (rows: LiabilityRecord[]) => {
    await setItem(STORAGE_LIABILITIES, rows);
  };

  const list = async (): Promise<LiabilityRecord[]> => {
    const raw = await readRaw();
    return raw.map((r) => hydrateLiability(migrateLegacyFlags(r)));
  };

  const getById = async (id: string): Promise<LiabilityRecord | null> => {
    const raw = await readRaw();
    const r = raw.find((x) => x.id === id);
    return r ? hydrateLiability(migrateLegacyFlags(r)) : null;
  };

  const create = async (input: Omit<LiabilityRecord, 'id'>): Promise<LiabilityRecord> => {
    const rows = await readRaw();
    const row: LiabilityRecord = {
      id: createId(),
      name: input.name,
      amount: Number(input.amount),
      remaining: Number(input.remaining ?? input.amount),
      category: input.category,
      description: input.description ?? '',
      monthlyPayment: Number(input.monthlyPayment ?? 0),
      interestRate: Number(input.interestRate ?? 0),
      dueDate: input.dueDate,
      firstPaymentDate: input.firstPaymentDate,
      termMonths: input.termMonths,
      repaymentMethod: input.repaymentMethod as RepaymentMethod | undefined,
      legacyManual: input.legacyManual
    };
    let normalized = migrateLegacyFlags(row);
    if (isAmortizingCategory(normalized.category) && !isLegacyAmortizationRow(normalized)) {
      normalized = hydrateLiability(normalized);
    }
    rows.push(normalized);
    await saveAll(rows);
    return hydrateLiability(migrateLegacyFlags(normalized));
  };

  const update = async (id: string, patch: Partial<Omit<LiabilityRecord, 'id'>>): Promise<LiabilityRecord | null> => {
    const rows = await readRaw();
    const i = rows.findIndex((r) => r.id === id);
    if (i === -1) return null;
    let row: LiabilityRecord = { ...rows[i], ...patch };
    row = migrateLegacyFlags(row);
    if (isAmortizingCategory(row.category) && !isLegacyAmortizationRow(row)) {
      row = hydrateLiability(row);
    }
    rows[i] = row;
    await saveAll(rows);
    return hydrateLiability(migrateLegacyFlags(row));
  };

  const remove = async (id: string): Promise<boolean> => {
    const rows = await readRaw();
    const next = rows.filter((r) => r.id !== id);
    if (next.length === rows.length) return false;
    await saveAll(next);
    return true;
  };

  const upsertFromForm = async (data: LedgerFormPayload): Promise<LiabilityRecord> => {
    const isAm = isAmortizingCategory(data.category);
    const fullAm = isAm && hasFullAmortizationPayload(data);

    if (fullAm) {
      const first = (data.dueDate ?? data.date) as string;
      const principal = Number(data.amount);
      const term = Number(data.termMonths);
      const method = data.repaymentMethod as RepaymentMethod;
      const rate = Number(data.interestRate ?? 0);
      const desc = data.description ?? '';

      if (data.id) {
        const rows = await readRaw();
        const i = rows.findIndex((r) => r.id === data.id);
        if (i === -1) {
          return create({
            name: data.name,
            amount: principal,
            remaining: principal,
            category: data.category,
            description: desc,
            monthlyPayment: 0,
            interestRate: rate,
            dueDate: first,
            firstPaymentDate: first,
            termMonths: term,
            repaymentMethod: method,
            legacyManual: false
          });
        }
        const prev = rows[i];
        const nextRow: LiabilityRecord = {
          ...prev,
          name: data.name,
          amount: principal,
          category: data.category,
          description: desc,
          interestRate: rate,
          termMonths: term,
          repaymentMethod: method,
          firstPaymentDate: first,
          dueDate: first,
          legacyManual: false
        };
        let normalized = migrateLegacyFlags(nextRow);
        normalized = hydrateLiability(normalized);
        rows[i] = normalized;
        await saveAll(rows);
        return normalized;
      }

      return create({
        name: data.name,
        amount: principal,
        remaining: principal,
        category: data.category,
        description: desc,
        monthlyPayment: 0,
        interestRate: rate,
        dueDate: first,
        firstPaymentDate: first,
        termMonths: term,
        repaymentMethod: method,
        legacyManual: false
      });
    }

    const amt = Number(data.amount);
    const monthly = Number(data.monthlyPayment ?? 0);
    const rate = Number(data.interestRate ?? 0);
    const due = data.dueDate ?? data.date;

    if (data.id) {
      const rows = await readRaw();
      const i = rows.findIndex((r) => r.id === data.id);
      if (i === -1) {
        return create({
          name: data.name,
          amount: amt,
          remaining: amt,
          category: data.category,
          description: data.description ?? '',
          monthlyPayment: monthly,
          interestRate: rate,
          dueDate: due,
          firstPaymentDate: due
        });
      }
      const prev = rows[i];
      const patch: Partial<Omit<LiabilityRecord, 'id'>> = {
        name: data.name,
        remaining: amt,
        amount: Math.max(prev.amount, amt),
        category: data.category,
        description: data.description ?? '',
        monthlyPayment: monthly,
        interestRate: rate,
        dueDate: due,
        firstPaymentDate: due
      };
      return (await update(data.id, patch))!;
    }

    return create({
      name: data.name,
      amount: amt,
      remaining: amt,
      category: data.category,
      description: data.description ?? '',
      monthlyPayment: monthly,
      interestRate: rate,
      dueDate: due,
      firstPaymentDate: due
    });
  };

  return { list, saveAll, getById, create, update, remove, upsertFromForm };
}
