export type TransactionType = 'income' | 'expense';

export type Transaction = {
  id: string;
  date: string; // ISO yyyy-mm-dd
  type: TransactionType;
  category: string;
  amount: number;
  note?: string;
};
