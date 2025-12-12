import { create } from 'zustand';
import { persist } from "zustand/middleware";
import type { Transaction } from '../types';

type State = {
  transactions: Transaction[];
  add: (t: Transaction) => void;
  addMany: (t: Transaction[]) => void;
  remove: (id: string) => void;
  update: (id: string, patch: Partial<Transaction>) => void;
  clear: () => void;
};

export const useTransactionsStore = create<State>()(
  persist(
    (set) => ({
      transactions: [],
      add: (t) => set((s) => ({ transactions: [...s.transactions, t] })),
      addMany: (t) => set((s) => ({ transactions: [...s.transactions, ...t] })),
      remove: (id) => set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),
      update: (id, patch) =>
        set((s) => ({
          transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      clear: () => set({ transactions: [] }),
    }),
    { name: 'finance-ai-tx' }
  )
);

// Helpers
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function getTotals(tx: Transaction[]) {
  const income = tx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = tx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  return { income, expense, balance: income - expense };
}

export function getMonthlySeries(tx: Transaction[]) {
  const series = months.map((m) => ({ month: m, income: 0, expense: 0, net: 0 }));
  tx.forEach((t) => {
    const monthIdx = new Date(t.date).getMonth();
    const target = series[monthIdx];
    if (t.type === 'income') target.income += t.amount;
    else target.expense += t.amount;
    target.net = target.income - target.expense;
  });
  return series;
}

export function getCategoryTotals(tx: Transaction[]) {
  const totals: Record<string, number> = {};
  tx.forEach((t) => {
    totals[t.category] = (totals[t.category] || 0) + (t.type === 'income' ? t.amount : -t.amount);
  });
  return Object.entries(totals)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
}

export function getCategories(tx: Transaction[]) {
  return Array.from(new Set(tx.map((t) => t.category))).sort();
}
