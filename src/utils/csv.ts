import Papa from 'papaparse';
import type { Transaction } from '../types';

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_ROWS = 2000;

export function exportCsv(tx: Transaction[]) {
  const csv = Papa.unparse(tx);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'transactions.csv';
  a.click();
  URL.revokeObjectURL(url);
}

type ImportResult = { data: Transaction[]; errors: string[] };

export function importCsv(file: File): Promise<ImportResult> {
  if (file.size > MAX_FILE_BYTES) {
    return Promise.resolve({
      data: [],
      errors: [`Arquivo excede ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB.`],
    });
  }

  return new Promise((resolve) => {
    Papa.parse<Record<string, string | number | undefined>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (result) => {
        const errors: string[] = [];
        const transactions: Transaction[] = [];
        if (result.data.length > MAX_ROWS) {
          errors.push(`Arquivo com muitas linhas. Considerar máximo de ${MAX_ROWS}.`);
          result.data.length = MAX_ROWS;
        }

        result.data.forEach((row, idx) => {
          const line = idx + 2; // header is line 1
          const rawType = String(row.type ?? row.Type ?? '').trim().toLowerCase();
          const rawDate = String(row.date ?? row.Date ?? '').trim();
          const rawCategory = String(row.category ?? row.Category ?? '').trim();
          const rawAmount = row.amount ?? (row as Record<string, unknown>).Amount;
          const amount = typeof rawAmount === 'number' ? rawAmount : Number(rawAmount);
          const note = String(row.note ?? row.Note ?? '').trim();
          const id = (row.id ?? (row as Record<string, unknown>).ID ?? '').toString().trim();

          if (!rawDate || !rawCategory || !rawType || Number.isNaN(amount)) {
            errors.push(`Linha ${line}: dados obrigatorios ausentes ou invalidos.`);
            return;
          }

          if (rawType !== 'income' && rawType !== 'expense') {
            errors.push(`Linha ${line}: tipo deve ser income ou expense (valor recebido: ${rawType}).`);
            return;
          }

          if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
            errors.push(`Linha ${line}: data deve estar em YYYY-MM-DD (recebido: ${rawDate}).`);
            return;
          }

          transactions.push({
            id: id || crypto.randomUUID(),
            date: rawDate,
            type: rawType as Transaction['type'],
            category: rawCategory,
            amount,
            note,
          });
        });

        resolve({ data: transactions, errors });
      },
      error: (err) => {
        resolve({ data: [], errors: [err.message] });
      },
    });
  });
}

export function exportJson(tx: Transaction[]) {
  const json = JSON.stringify(tx, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'transactions.json';
  a.click();
  URL.revokeObjectURL(url);
}

export async function importJson(file: File): Promise<ImportResult> {
  if (file.size > MAX_FILE_BYTES) {
    return {
      data: [],
      errors: [`Arquivo excede ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB.`],
    };
  }
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('JSON deve ser uma lista de transacoes.');
    const errors: string[] = [];
    const transactions: Transaction[] = [];
    parsed.slice(0, MAX_ROWS).forEach((row: any, idx: number) => {
      const line = idx + 1;
      const rawType = String(row.type ?? '').trim().toLowerCase();
      const rawDate = String(row.date ?? '').trim();
      const rawCategory = String(row.category ?? '').trim();
      const amount = Number(row.amount);
      const note = String(row.note ?? '').trim();
      const id = String(row.id ?? '').trim();

      if (!rawDate || !rawCategory || !rawType || Number.isNaN(amount)) {
        errors.push(`Item ${line}: dados obrigatorios ausentes ou invalidos.`);
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        errors.push(`Item ${line}: data deve estar em YYYY-MM-DD (recebido: ${rawDate}).`);
        return;
      }
      if (rawType !== 'income' && rawType !== 'expense') {
        errors.push(`Item ${line}: tipo deve ser income ou expense (valor recebido: ${rawType}).`);
        return;
      }

      transactions.push({
        id: id || crypto.randomUUID(),
        date: rawDate,
        type: rawType as Transaction['type'],
        category: rawCategory,
        amount,
        note,
      });
    });
    if (parsed.length > MAX_ROWS) {
      errors.push(`Arquivo truncado para ${MAX_ROWS} registros.`);
    }
    return { data: transactions, errors };
  } catch (err) {
    return { data: [], errors: [(err as Error).message || 'JSON invalido'] };
  }
}

// Backup com metadados
type BackupPayload = { version: number; exportedAt: string; transactions: Transaction[] };

export function exportBackup(tx: Transaction[]) {
  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions: tx,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-financeai-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importBackup(file: File): Promise<ImportResult> {
  if (file.size > MAX_FILE_BYTES) {
    return {
      data: [],
      errors: [`Arquivo excede ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB.`],
    };
  }
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as BackupPayload;
    if (!parsed || parsed.version === undefined || !Array.isArray(parsed.transactions)) {
      throw new Error('Backup inválido ou corrompido.');
    }
    return { data: parsed.transactions.slice(0, MAX_ROWS), errors: [] };
  } catch (err) {
    return { data: [], errors: [(err as Error).message || 'Backup inválido'] };
  }
}
