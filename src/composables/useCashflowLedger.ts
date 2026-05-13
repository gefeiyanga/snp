import { useAppStorage } from '@/composables/useStorage';
import {
  calculateAccountBalances,
  generateRecurringOccurrences,
  transactionFromRecurringOccurrence
} from '@/domain/cashflow';
import type {
  AccountRecord,
  RecurringOccurrence,
  RecurringRuleRecord,
  TransactionRecord
} from '@/types/ledger';

const STORAGE_ACCOUNTS = 'accounts';
const STORAGE_TRANSACTIONS = 'transactions';
const STORAGE_RECURRING_RULES = 'recurringRules';

type NewAccountInput = Omit<AccountRecord, 'id' | 'createdAt' | 'updatedAt'>;
type NewTransactionInput = Omit<TransactionRecord, 'id' | 'createdAt' | 'updatedAt'>;
type NewRecurringRuleInput = Omit<RecurringRuleRecord, 'id' | 'createdAt' | 'updatedAt'>;
type ConfirmOccurrencePatch = Partial<
  Omit<TransactionRecord, 'id' | 'date' | 'createdAt' | 'updatedAt' | 'source' | 'sourceId'>
>;

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function fallbackSide(type: AccountRecord['type']): AccountRecord['side'] {
  return type === 'credit_card' || type === 'loan' ? 'liability' : 'asset';
}

function normalizeAccountRecord(row: AccountRecord): AccountRecord {
  const now = nowIso();
  return {
    ...row,
    side: row.side ?? fallbackSide(row.type),
    currency: row.currency ?? 'CNY',
    openingBalance: Number(row.openingBalance ?? 0),
    archived: row.archived ?? false,
    createdAt: row.createdAt ?? now,
    updatedAt: row.updatedAt ?? now
  };
}

function normalizeTransactionRecord(row: TransactionRecord): TransactionRecord {
  const now = nowIso();
  return {
    ...row,
    amount: Number(row.amount ?? 0),
    currency: row.currency ?? 'CNY',
    category: row.category ?? '',
    status: row.status ?? 'confirmed',
    source: row.source ?? 'manual',
    principalAmount: row.principalAmount !== undefined ? Number(row.principalAmount) : undefined,
    interestAmount: row.interestAmount !== undefined ? Number(row.interestAmount) : undefined,
    feeAmount: row.feeAmount !== undefined ? Number(row.feeAmount) : undefined,
    createdAt: row.createdAt ?? now,
    updatedAt: row.updatedAt ?? now
  };
}

function normalizeRecurringRuleRecord(row: RecurringRuleRecord): RecurringRuleRecord {
  const now = nowIso();
  return {
    ...row,
    interval: Math.max(1, Math.floor(Number(row.interval || 1))),
    amount: Number(row.amount ?? 0),
    currency: row.currency ?? 'CNY',
    active: row.active ?? true,
    createdAt: row.createdAt ?? now,
    updatedAt: row.updatedAt ?? now
  };
}

function sortTransactions(rows: TransactionRecord[]): TransactionRecord[] {
  return [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function sortOccurrences(rows: RecurringOccurrence[]): RecurringOccurrence[] {
  return [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

export function useAccountRecords() {
  const { getItem, setItem } = useAppStorage();

  const list = async (): Promise<AccountRecord[]> =>
    ((await getItem<AccountRecord[]>(STORAGE_ACCOUNTS)) ?? []).map(normalizeAccountRecord);

  const saveAll = async (rows: AccountRecord[]) => {
    await setItem(STORAGE_ACCOUNTS, rows.map(normalizeAccountRecord));
  };

  const getById = async (id: string): Promise<AccountRecord | null> => {
    const rows = await list();
    return rows.find((r) => r.id === id) ?? null;
  };

  const create = async (input: NewAccountInput): Promise<AccountRecord> => {
    const now = nowIso();
    const row = normalizeAccountRecord({
      ...input,
      id: createId(),
      createdAt: now,
      updatedAt: now
    });
    const rows = await list();
    rows.push(row);
    await saveAll(rows);
    return row;
  };

  const update = async (id: string, patch: Partial<NewAccountInput>): Promise<AccountRecord | null> => {
    const rows = await list();
    const i = rows.findIndex((r) => r.id === id);
    if (i === -1) return null;
    rows[i] = normalizeAccountRecord({ ...rows[i], ...patch, updatedAt: nowIso() });
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

  const balances = async () => {
    const accounts = await list();
    const transactions = ((await getItem<TransactionRecord[]>(STORAGE_TRANSACTIONS)) ?? []).map(
      normalizeTransactionRecord
    );
    return calculateAccountBalances(accounts, transactions);
  };

  return { list, saveAll, getById, create, update, remove, balances };
}

export function useTransactionRecords() {
  const { getItem, setItem } = useAppStorage();

  const list = async (): Promise<TransactionRecord[]> =>
    sortTransactions(((await getItem<TransactionRecord[]>(STORAGE_TRANSACTIONS)) ?? []).map(normalizeTransactionRecord));

  const saveAll = async (rows: TransactionRecord[]) => {
    await setItem(STORAGE_TRANSACTIONS, sortTransactions(rows.map(normalizeTransactionRecord)));
  };

  const getById = async (id: string): Promise<TransactionRecord | null> => {
    const rows = await list();
    return rows.find((r) => r.id === id) ?? null;
  };

  const create = async (input: NewTransactionInput): Promise<TransactionRecord> => {
    const now = nowIso();
    const row = normalizeTransactionRecord({
      ...input,
      id: createId(),
      createdAt: now,
      updatedAt: now
    });
    const rows = await list();
    rows.push(row);
    await saveAll(rows);
    return row;
  };

  const update = async (id: string, patch: Partial<NewTransactionInput>): Promise<TransactionRecord | null> => {
    const rows = await list();
    const i = rows.findIndex((r) => r.id === id);
    if (i === -1) return null;
    rows[i] = normalizeTransactionRecord({ ...rows[i], ...patch, updatedAt: nowIso() });
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

  const findBySourceId = async (sourceId: string): Promise<TransactionRecord | null> => {
    const rows = await list();
    return rows.find((r) => r.sourceId === sourceId) ?? null;
  };

  const confirm = async (id: string): Promise<TransactionRecord | null> =>
    update(id, { status: 'confirmed' });

  return { list, saveAll, getById, create, update, remove, findBySourceId, confirm };
}

export function useRecurringRuleRecords() {
  const { getItem, setItem } = useAppStorage();
  const transactionRepo = useTransactionRecords();

  const list = async (): Promise<RecurringRuleRecord[]> =>
    ((await getItem<RecurringRuleRecord[]>(STORAGE_RECURRING_RULES)) ?? []).map(normalizeRecurringRuleRecord);

  const saveAll = async (rows: RecurringRuleRecord[]) => {
    await setItem(STORAGE_RECURRING_RULES, rows.map(normalizeRecurringRuleRecord));
  };

  const getById = async (id: string): Promise<RecurringRuleRecord | null> => {
    const rows = await list();
    return rows.find((r) => r.id === id) ?? null;
  };

  const create = async (input: NewRecurringRuleInput): Promise<RecurringRuleRecord> => {
    const now = nowIso();
    const row = normalizeRecurringRuleRecord({
      ...input,
      id: createId(),
      createdAt: now,
      updatedAt: now
    });
    const rows = await list();
    rows.push(row);
    await saveAll(rows);
    return row;
  };

  const update = async (id: string, patch: Partial<NewRecurringRuleInput>): Promise<RecurringRuleRecord | null> => {
    const rows = await list();
    const i = rows.findIndex((r) => r.id === id);
    if (i === -1) return null;
    rows[i] = normalizeRecurringRuleRecord({ ...rows[i], ...patch, updatedAt: nowIso() });
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

  const pendingOccurrences = async (fromYmd: string, toYmd: string): Promise<RecurringOccurrence[]> => {
    const [rules, transactions] = await Promise.all([list(), transactionRepo.list()]);
    const confirmedSourceIds = new Set(
      transactions
        .filter((transaction) => transaction.sourceId && transaction.status !== 'void')
        .map((transaction) => transaction.sourceId as string)
    );
    const occurrences = rules
      .flatMap((rule) => generateRecurringOccurrences(rule, fromYmd, toYmd))
      .filter((occurrence) => !confirmedSourceIds.has(occurrence.id));
    return sortOccurrences(occurrences);
  };

  const confirmOccurrence = async (
    occurrence: RecurringOccurrence,
    patch: ConfirmOccurrencePatch = {}
  ): Promise<TransactionRecord> => {
    const existing = await transactionRepo.findBySourceId(occurrence.id);
    if (existing && existing.status !== 'void') return existing;

    const transaction = await transactionRepo.create({
      ...transactionFromRecurringOccurrence(occurrence, 'confirmed'),
      ...patch,
      status: 'confirmed',
      source: 'recurring_rule',
      sourceId: occurrence.id
    });

    const rule = await getById(occurrence.ruleId);
    if (rule && (!rule.lastConfirmedDate || occurrence.date.localeCompare(rule.lastConfirmedDate) > 0)) {
      await update(rule.id, { lastConfirmedDate: occurrence.date });
    }

    return transaction;
  };

  return { list, saveAll, getById, create, update, remove, pendingOccurrences, confirmOccurrence };
}
