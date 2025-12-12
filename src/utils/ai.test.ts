import { describe, expect, it } from 'vitest';
import { getInsights } from './ai';
import type { Transaction } from '../types';

const txBase = (over?: Partial<Transaction>): Transaction => ({
  id: over?.id ?? '1',
  date: over?.date ?? '2024-12-01',
  type: over?.type ?? 'expense',
  category: over?.category ?? 'Teste',
  amount: over?.amount ?? 100,
  note: over?.note ?? '',
});

describe('getInsights (local)', () => {
  it('retorna mensagem para lista vazia', async () => {
    const res = await getInsights([]);
    expect(res.data[0]).toContain('Adicione transacoes');
  });

  it('gera insights com saldo positivo e categoria dominante', async () => {
    const tx: Transaction[] = [
      txBase({ id: '1', type: 'income', category: 'Salario', amount: 3000, date: '2024-12-01' }),
      txBase({ id: '2', type: 'expense', category: 'Mercado', amount: 500, date: '2024-12-02' }),
      txBase({ id: '3', type: 'expense', category: 'Mercado', amount: 200, date: '2024-12-03' }),
    ];
    const res = await getInsights(tx);
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data.join(' ')).toMatch(/Mercado/i);
  });

  it('alerta quando gastos > entradas', async () => {
    const tx: Transaction[] = [
      txBase({ id: '1', type: 'income', category: 'Salario', amount: 1000, date: '2024-12-01' }),
      txBase({ id: '2', type: 'expense', category: 'Viagem', amount: 1500, date: '2024-12-02' }),
    ];
    const res = await getInsights(tx);
    expect(res.data.join(' ')).toMatch(/gastou .* a mais do que entrou/i);
  });
});
