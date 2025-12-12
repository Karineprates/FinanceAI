import type { Transaction } from '../types';

type StatCategory = { category: string; total: number };
type Stats = {
  incomeMonth: number;
  expenseMonth: number;
  netMonth: number;
  incomePrevMonth: number;
  expensePrevMonth: number;
  netPrevMonth: number;
  topExpensesMonth: StatCategory[];
  topExpensesLast30: StatCategory[];
  biggestExpense?: Transaction;
  avgDailyExpense30: number;
  dayPeak?: string;
  incomeWeek: number;
  expenseWeek: number;
  daysInMonth: number;
  dayOfMonth: number;
};

const money = (v: number, frac = 0) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: frac, maximumFractionDigits: frac }).format(
    v,
  );

const dayNames = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

export function buildStats(tx: Transaction[]): Stats {
  const now = new Date();
  const currentMonthKey = dateKey(now);
  const prevMonthKey = dateKey(addMonths(now, -1));
  const start30 = Date.now() - 30 * 864e5;
  const start7 = Date.now() - 7 * 864e5;

  let incomeMonth = 0;
  let expenseMonth = 0;
  let incomePrevMonth = 0;
  let expensePrevMonth = 0;
  let incomeWeek = 0;
  let expenseWeek = 0;

  const byCatMonth: Record<string, number> = {};
  const byCat30: Record<string, number> = {};
  let biggestExpense: Transaction | undefined;
  let sumExpense30 = 0;
  let countExpense30 = 0;
  const spendByWeekday: Record<number, number> = {};

  tx.forEach((t) => {
    const monthKey = t.date.slice(0, 7);
    const isExpense = t.type === 'expense';
    const amount = t.amount;
    if (monthKey === currentMonthKey) {
      if (t.type === 'income') incomeMonth += amount;
      else expenseMonth += amount;
      byCatMonth[t.category] = (byCatMonth[t.category] || 0) + (isExpense ? amount : 0);
    }
    if (monthKey === prevMonthKey) {
      if (t.type === 'income') incomePrevMonth += amount;
      else expensePrevMonth += amount;
    }
    const time = new Date(t.date).getTime();
    if (time >= start30) {
      if (isExpense) {
        sumExpense30 += amount;
        countExpense30 += 1;
      }
      byCat30[t.category] = (byCat30[t.category] || 0) + (isExpense ? amount : 0);
      const wd = new Date(t.date).getDay();
      spendByWeekday[wd] = (spendByWeekday[wd] || 0) + (isExpense ? amount : 0);
      if (isExpense) {
        if (!biggestExpense || amount > biggestExpense.amount) biggestExpense = t;
      }
    }
    if (time >= start7) {
      if (t.type === 'income') incomeWeek += amount;
      else expenseWeek += amount;
    }
  });

  const topExpensesMonth = sortedEntries(byCatMonth);
  const topExpensesLast30 = sortedEntries(byCat30);
  const avgDailyExpense30 = countExpense30 ? sumExpense30 / 30 : 0;
  const dayPeakKey =
    Object.entries(spendByWeekday).sort((a, b) => b[1] - a[1])[0]?.[0];
  const dayPeak = dayPeakKey !== undefined ? dayNames[Number(dayPeakKey)] : undefined;

  return {
    incomeMonth,
    expenseMonth,
    netMonth: incomeMonth - expenseMonth,
    incomePrevMonth,
    expensePrevMonth,
    netPrevMonth: incomePrevMonth - expensePrevMonth,
    topExpensesMonth,
    topExpensesLast30,
    biggestExpense,
    avgDailyExpense30,
    dayPeak,
    incomeWeek,
    expenseWeek,
    daysInMonth: daysInMonth(now),
    dayOfMonth: now.getDate(),
  };
}

export function buildInsights(stats: Stats): string[] {
  const items: string[] = [];
  const { incomeMonth, expenseMonth, netMonth, incomePrevMonth, expensePrevMonth, netPrevMonth } = stats;
  const expenseDelta =
    expensePrevMonth > 0 ? ((expenseMonth - expensePrevMonth) / expensePrevMonth) * 100 : null;

  // Básicos
  if (expenseMonth > 0) {
    const deltaTxt =
      expenseDelta === null ? '' : `, ${expenseDelta >= 0 ? '+' : ''}${expenseDelta.toFixed(1)}% vs mês anterior`;
    items.push(`Gasto no mês: ${money(expenseMonth)}${deltaTxt}.`);
  }
  if (stats.topExpensesMonth.length) {
    const top = stats.topExpensesMonth.slice(0, 3).map((c) => `${c.category} (${money(c.total)})`);
    items.push(`Maiores despesas: ${top.join(', ')}.`);
  }
  if (stats.dayPeak) {
    items.push(`Gasto mais alto tende a ocorrer nas ${stats.dayPeak}.`);
  }
  if (stats.biggestExpense) {
    items.push(`Maior gasto único: ${money(stats.biggestExpense.amount)} em ${stats.biggestExpense.category}.`);
  }
  if (stats.avgDailyExpense30 > 0) {
    items.push(`Média diária (30d): ${money(stats.avgDailyExpense30, 2)}.`);
  }
  if (incomeMonth > 0) {
    const rate = (expenseMonth / incomeMonth) * 100;
    items.push(`Taxa de consumo: ${rate.toFixed(1)}% das entradas do mês já foram gastas.`);
  }

  // Alertas
  if (stats.topExpensesMonth.length && stats.topExpensesMonth[0].total > 0 && stats.expensePrevMonth > 0) {
    const cat = stats.topExpensesMonth[0];
    const prevCat = stats.topExpensesLast30.find((c) => c.category === cat.category);
    if (prevCat && prevCat.total > 0) {
      const delta = ((cat.total - prevCat.total) / prevCat.total) * 100;
      if (delta > 10) items.push(`Alerta: ${cat.category} subiu ${delta.toFixed(1)}% vs último período.`);
    }
  }
  if (stats.expenseWeek > stats.incomeWeek && stats.expenseWeek - stats.incomeWeek > 0) {
    items.push(`Alerta: você gastou ${money(stats.expenseWeek - stats.incomeWeek)} a mais do que entrou na última semana.`);
  }
  if (stats.biggestExpense && stats.avgDailyExpense30 > 0 && stats.biggestExpense.amount > stats.avgDailyExpense30 * 3) {
    items.push(`Despesa fora do padrão: ${money(stats.biggestExpense.amount)} em ${stats.biggestExpense.category}.`);
  }
  const top2Share = topShare(stats.topExpensesMonth, expenseMonth);
  if (top2Share && top2Share > 0.7) {
    items.push(`Concentração alta: ${Math.round(top2Share * 100)}% do gasto em duas categorias.`);
  }

  // Sugestões
  if (stats.topExpensesMonth.length) {
    const cat = stats.topExpensesMonth[0];
    const cut = cat.total * 0.2;
    items.push(`Sugestão: reduzir ${cat.category} em 20% economiza ${money(cut)} este mês.`);
  }
  if (netMonth > 0) {
    const weeklySave = netMonth / 4;
    items.push(`Reserva: seu excedente sugere guardar ${money(weeklySave)} por semana.`);
  }

  // Previsões simples
  const forecast = forecastMonthEnd(stats);
  if (forecast !== null) {
    items.push(`Projeção de saldo no fim do mês: ${money(forecast)}.`);
  }

  return items.slice(0, 12);
}

function topShare(cats: StatCategory[], expenseTotal: number) {
  if (!expenseTotal) return null;
  const top2 = cats.slice(0, 2).reduce((s, c) => s + c.total, 0);
  return top2 / expenseTotal;
}

function forecastMonthEnd(stats: Stats) {
  const { netMonth, dayOfMonth, daysInMonth } = stats;
  if (dayOfMonth === 0) return null;
  const pace = netMonth / dayOfMonth;
  return Math.round(netMonth + pace * (daysInMonth - dayOfMonth));
}

function sortedEntries(obj: Record<string, number>): StatCategory[] {
  return Object.entries(obj)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(d: Date, n: number) {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + n);
  return copy;
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}
