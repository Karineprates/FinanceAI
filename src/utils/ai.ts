import type { Transaction } from '../types';
import { buildInsights, buildStats } from './insightsTemplates';

type InsightResult = {
  data: string[];
  source: 'api' | 'fallback';
  error?: string;
  durationMs?: number;
};

export async function getInsights(tx: Transaction[]): Promise<InsightResult> {
  if (!tx.length) return { data: ['Adicione transações para ver insights.'], source: 'api' };
  const stats = buildStats(tx);
  const groqKey = (import.meta.env.VITE_GROQ_API_KEY as string | undefined)?.trim();

  if (groqKey) {
    try {
      const start = performance.now();
      const data = await fetchGroqInsights(groqKey, stats);
      return { data, source: 'api', durationMs: performance.now() - start };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        data: buildInsights(stats),
        source: 'fallback',
        error: `Groq falhou: ${message}`,
      };
    }
  }

  const start = performance.now();
  const data = buildInsights(stats);
  return { data, source: 'api', durationMs: performance.now() - start };
}

async function fetchGroqInsights(apiKey: string, stats: ReturnType<typeof buildStats>) {
  const body = {
    model: import.meta.env.VITE_GROQ_MODEL || 'llama-3.1-8b-instant',
    messages: [
      {
        role: 'system',
        content:
          'Voce e um analista financeiro. Resuma em bullets curtos (max 8) insights, alertas e sugestoes com base nos dados fornecidos. Responda em portugues, conciso, sem emojis. Nao trunque frases ou palavras; entregue frases completas.',
      },
      {
        role: 'user',
        content: buildPrompt(stats),
      },
    ],
    max_tokens: 420,
    temperature: 0.2,
  };

  const resp = await fetch('/groq/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`Groq respondeu ${resp.status}${detail ? `: ${detail}` : ''}`);
  }
  const json = await resp.json();
  const text = json.choices?.[0]?.message?.content || '';
  return splitBullets(text);
}

function splitBullets(text: string) {
  return text
    .split(/\r?\n/)
    .map((s: string) => s.trim().replace(/^[\-\*\u2022]\s*/, ''))
    .filter((s: string) => s.length > 0)
    .slice(0, 10);
}

function buildPrompt(stats: ReturnType<typeof buildStats>) {
  const money = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
  const topCats = stats.topExpensesMonth
    .slice(0, 3)
    .map((c) => `${c.category} (${money(c.total)})`)
    .join(', ');
  const lines = [
    `Saldo liquido do mes: ${money(stats.netMonth)} (entradas ${money(stats.incomeMonth)}, gastos ${money(stats.expenseMonth)})`,
    `Mes anterior: saldo ${money(stats.netPrevMonth)}, gastos ${money(stats.expensePrevMonth)}`,
    `Top categorias: ${topCats || 'n/a'}`,
    `Maior gasto: ${stats.biggestExpense ? `${money(stats.biggestExpense.amount)} em ${stats.biggestExpense.category}` : 'n/a'}`,
    `Media diaria 30d (gastos): ${money(stats.avgDailyExpense30)}`,
    `Semana: entradas ${money(stats.incomeWeek)}, gastos ${money(stats.expenseWeek)}`,
    `Dia de pico de gasto: ${stats.dayPeak ?? 'n/a'}`,
  ];
  const base = lines.join('\n');
  return [
    'Use exatamente os valores fornecidos, sem truncar ou inventar numeros. Formate como bullets curtos em portugues, sem repetir cabecalho.',
    'Limite a 8 bullets: 3 visao geral, 3 alertas, 2 sugestoes/projecoes.',
    'Nao acrescente textos repetidos. Nao use emojis. Nao divida palavras.',
    'Se houver moeda, mantenha como R$ e numerico completo. Entregue frases completas, sem cortar o final.',
    base,
  ].join('\n');
}
