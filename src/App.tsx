import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import type { RefObject } from 'react';
import type { Transaction } from './types';
import {
  getCategories,
  getCategoryTotals,
  getMonthlySeries,
  getTotals,
  useTransactionsStore,
} from './store/transactions';
import { exportCsv, importCsv, exportJson, importJson, exportBackup, importBackup } from './utils/csv';
import { getInsights } from './utils/ai';
import InsightsTrend from './components/InsightsTrend';
import { FixedSizeList as List } from 'react-window';
import { DateInput } from './components/DateInput';
import { FiMoon, FiSun } from 'react-icons/fi';

const colors = ['#22c55e', '#f97316', '#3b82f6', '#a855f7', '#ef4444', '#eab308'];
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFmt = new Intl.DateTimeFormat('pt-BR');
const numberMask = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const FILTERS_KEY = 'finance-ai-filters';
const toastIcon: Record<'success' | 'error' | 'info', string> = {
  success: '[OK]',
  error: '[!]',
  info: '[i]',
};

const MonthlyChart = lazy(() => import('./components/MonthlyChart'));
const CategoryChart = lazy(() => import('./components/CategoryChart'));

function formatDate(value: string) {
  if (!value) return '';
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : dateFmt.format(parsed);
}

function App() {
  const { transactions, add, addMany, remove, update } = useTransactionsStore();
  const [insights, setInsights] = useState<string[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [insightsGeneratedAt, setInsightsGeneratedAt] = useState<string | null>(null);
  const [insightsDuration, setInsightsDuration] = useState<number | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof localStorage === 'undefined') return 'dark';
    const saved = localStorage.getItem('finance-theme');
    return saved === 'light' ? 'light' : 'dark';
  });
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([]);
  const [importing, setImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{
    source: 'import' | 'backup';
    added: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const savedFilters = loadSavedFilters();
  const [selectedMonth, setSelectedMonth] = useState(() => savedFilters.selectedMonth || '');
  const [selectedCategory, setSelectedCategory] = useState(
    () => savedFilters.selectedCategory || '',
  );
  const [dateFrom, setDateFrom] = useState(() => savedFilters.dateFrom || '');
  const [dateTo, setDateTo] = useState(() => savedFilters.dateTo || '');
  const [search, setSearch] = useState(() => savedFilters.search || '');
  const [searchInput, setSearchInput] = useState(() => savedFilters.search || '');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [lastEditedId, setLastEditedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const [trendPeriod, setTrendPeriod] = useState<3 | 6 | 12>(12);
  const [sortBy, setSortBy] = useState<'date' | 'type' | 'category' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [isMobileHeader, setIsMobileHeader] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 900 : false,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTransactions, setShowTransactions] = useState(true);
  const [metaMensal, setMetaMensal] = useState<number | null>(() => {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('finance-meta');
    const num = raw ? Number(raw) : NaN;
    return Number.isFinite(num) ? num : null;
  });
  const [metaDespesa, setMetaDespesa] = useState<number | null>(() => {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('finance-meta-despesa');
    const num = raw ? Number(raw) : NaN;
    return Number.isFinite(num) ? num : null;
  });

  const months = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => {
      if (t.date?.length >= 7) set.add(t.date.slice(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (selectedMonth && !t.date.startsWith(selectedMonth)) return false;
      if (selectedCategory && t.category !== selectedCategory) return false;
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo && t.date > dateTo) return false;
      if (term) {
        if (
          !t.category.toLowerCase().includes(term) &&
          !(t.note || '').toLowerCase().includes(term)
        )
          return false;
      }
      return true;
    });
  }, [transactions, selectedMonth, selectedCategory, dateFrom, dateTo, search]);

  const totals = useMemo(() => getTotals(filteredTransactions), [filteredTransactions]);
  const monthlySeries = useMemo(() => getMonthlySeries(filteredTransactions), [filteredTransactions]);
  const monthlySeriesFiltered = useMemo(() => {
    if (!monthlySeries.length) return [];
    return monthlySeries.slice(-trendPeriod);
  }, [monthlySeries, trendPeriod]);
  const categoryTotals = useMemo(
    () => getCategoryTotals(filteredTransactions),
    [filteredTransactions],
  );
  const categories = useMemo(() => getCategories(transactions), [transactions]);

  const runInsights = useCallback(async () => {
    setInsightsLoading(true);
    setInsightsError(null);
    setInsightsDuration(null);
    try {
      const res = await getInsights(filteredTransactions);
      setInsights(res.data);
      if (res.durationMs !== undefined) setInsightsDuration(res.durationMs);
      if (res.error) setInsightsError(res.error);
      setInsightsGeneratedAt(new Date().toLocaleTimeString('pt-BR'));
    } catch (err) {
      setInsights(buildFallbackInsight(filteredTransactions));
      setInsightsError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setInsightsLoading(false);
    }
  }, [filteredTransactions]);

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('finance-theme', theme);
        if (metaMensal !== null) localStorage.setItem('finance-meta', String(metaMensal));
        if (metaDespesa !== null) localStorage.setItem('finance-meta-despesa', String(metaDespesa));
      } catch {
        // ignore
      }
    }
  }, [theme, metaMensal, metaDespesa]);

  useEffect(() => {
    const onResize = () => {
      setIsMobileHeader(window.innerWidth < 900);
      if (window.innerWidth >= 900) setMenuOpen(false);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    runInsights();
  }, [runInsights]);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    const payload = { selectedMonth, selectedCategory, dateFrom, dateTo, search };
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(payload));
      const params = new URLSearchParams();
      if (selectedMonth) params.set('month', selectedMonth);
      if (selectedCategory) params.set('category', selectedCategory);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      if (search) params.set('q', search);
      const qs = params.toString();
      const newUrl = qs ? `?${qs}` : window.location.pathname;
      window.history.replaceState(null, '', newUrl);
    } catch {
      // ignore storage errors
    }
  }, [selectedMonth, selectedCategory, dateFrom, dateTo, search]);

  const handleImportFile = async (file?: File | null) => {
    if (!file) return;
    setImporting(true);
    setImportFeedback(null);
    const isJson = file.name.toLowerCase().endsWith('.json') || file.type.includes('json');
    const { data, errors } = isJson ? await importJson(file) : await importCsv(file);
    const result = data.length ? mergeTransactions(transactions, data) : { merged: transactions, added: 0, skipped: 0 };
    if (data.length) {
      useTransactionsStore.getState().clear();
      addMany(result.merged);
    }
    pushToast(
      `Importei ${data.length} registro(s). Adicionados ${result.added}, ignorados ${result.skipped}.`,
      'success',
    );
    setImportFeedback({ source: 'import', added: result.added, skipped: result.skipped, errors });
    if (errors.length) pushToast(`Importacao com ${errors.length} erro(s).`, 'error');
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRestoreBackup = async (file?: File | null) => {
    if (!file) return;
    setImporting(true);
    const { data, errors } = await importBackup(file);
    const result = mergeTransactions([], data);
    if (data.length) {
      useTransactionsStore.getState().clear();
      addMany(result.merged);
      pushToast(`Backup restaurado com ${result.merged.length} registros (ignorado ${result.skipped}).`, 'success');
    }
    setImportFeedback({ source: 'backup', added: result.added, skipped: result.skipped, errors });
    if (errors.length) pushToast(`Backup com ${errors.length} erro(s).`, 'error');
    setImporting(false);
    if (backupInputRef.current) backupInputRef.current.value = '';
  };

  const clearFilters = () => {
    setSelectedMonth('');
    setSelectedCategory('');
    setDateFrom('');
    setDateTo('');
    setSearch('');
  };

  const pushToast = (
    message: string,
    type: 'success' | 'error' | 'info' = 'info',
    durationMs = 4000,
  ) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, durationMs);
  };

  const handleSortChange = useCallback(
    (field: 'date' | 'type' | 'category' | 'amount') => {
      if (sortBy === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(field);
        setSortDir(field === 'date' ? 'desc' : 'asc');
      }
    },
    [sortBy],
  );

  return (
    <div className="page">
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src={theme === 'dark' ? '/logo-dark.svg' : '/logo-light.svg'}
            alt="FinanceAI Dashboard"
            style={{
              height: 72,
              width: 'auto',
              display: 'block',
            }}
          />
          <span style={{ position: 'absolute', left: -9999 }}>FinanceAI Dashboard</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: isMobileHeader ? 'nowrap' : 'wrap', alignItems: 'center' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            style={{ display: 'none' }}
            onChange={(e) => handleImportFile(e.target.files?.[0])}
          />
          <input
            ref={backupInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => handleRestoreBackup(e.target.files?.[0])}
          />
          <div style={{ position: 'relative' }}>
            <button
              className="secondary"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Abrir menu de ações"
              style={{ width: 44, padding: '10px 0', textAlign: 'center' }}
            >
              ☰
            </button>
            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  marginTop: 8,
                  background: 'var(--panel)',
                  border: `1px solid var(--panel-border)`,
                  borderRadius: 10,
                  padding: 10,
                  display: 'grid',
                  gap: 8,
                  minWidth: 200,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
                  zIndex: 50,
                }}
              >
                <button
                  className="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  aria-label="Importar CSV ou JSON"
                >
                  {importing ? 'Importando...' : 'Importar CSV/JSON'}
                </button>
                <button className="secondary" onClick={() => exportCsv(transactions)} aria-label="Exportar CSV">
                  Exportar CSV
                </button>
                <button className="secondary" onClick={() => exportJson(transactions)} aria-label="Exportar JSON">
                  Exportar JSON
                </button>
                <button className="secondary" onClick={() => exportBackup(transactions)} aria-label="Exportar backup">
                  Backup
                </button>
                <button
                  className="secondary"
                  onClick={() => backupInputRef.current?.click()}
                  aria-label="Restaurar backup"
                >
                  Restaurar
                </button>
              </div>
            )}
          </div>
          <button
            className="secondary"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label="Alternar tema claro ou escuro"
            style={{ width: 44, padding: '10px 0', textAlign: 'center' }}
          >
            {theme === 'dark' ? <FiSun /> : <FiMoon />}
          </button>
        </div>
      </header>

      <div className="panel filters-panel" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="filter-item">
          <label style={{ display: 'block', marginBottom: 4, color: '#94a3b8' }}>Mes</label>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} aria-label="Filtro de mês">
            <option value="">Todos</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-item">
          <label style={{ display: 'block', marginBottom: 4, color: '#94a3b8' }}>Categoria</label>
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} aria-label="Filtro de categoria">
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-item">
          <DateInput label="De" value={dateFrom} onChange={setDateFrom} id="filter-from" />
        </div>
        <div className="filter-item">
          <DateInput label="Até" value={dateTo} onChange={setDateTo} id="filter-to" />
        </div>
        <div className="filter-item" style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'block', marginBottom: 4, color: '#94a3b8' }}>Busca</label>
          <input
            type="text"
            placeholder="Categoria ou nota"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar categoria ou nota"
          />
        </div>
        <div style={{ alignSelf: 'flex-end' }}>
          <button className="secondary" onClick={clearFilters} aria-label="Limpar filtros">
            Limpar filtros
          </button>
        </div>
      </div>

      {importFeedback && (
        <div className="panel">
          <strong>{importFeedback.source === 'backup' ? 'Backup' : 'Importacao'}:</strong>{' '}
          <span>
            {importFeedback.added} adicionado(s), {importFeedback.skipped} ignorado(s).
          </span>{' '}
          {importFeedback.errors.length > 0 && (
            <span>
              {importFeedback.errors.length} erro(s): {importFeedback.errors.slice(0, 2).join(' | ')}
              {importFeedback.errors.length > 2 ? ' ...' : ''}
            </span>
          )}
        </div>
      )}

      <div className="cards">
        <StatCard label="Saldo" value={totals.balance} accent="#38bdf8" />
        <StatCard label="Entradas" value={totals.income} accent="#22c55e" />
        <StatCard label="Saidas" value={totals.expense} accent="#ef4444" />
      </div>

      <div className="grid two">
        <div className="panel">
          <h3>Adicionar transações</h3>
      <TransactionForm onSubmit={add} categories={categories} notify={pushToast} />
        </div>
        <div className="panel">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>
                Insights {' '}
                {insightsDuration !== null && (
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: 'rgba(34, 197, 94, 0.12)',
                      color: '#22c55e',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {insightsDuration.toFixed(0)} ms
                  </span>
                )}
              </h3>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>
                {insightsGeneratedAt ? `Gerados às ${insightsGeneratedAt}` : 'Gerados localmente'}
              </span>
            </div>
            <button className="secondary" onClick={runInsights} disabled={insightsLoading}>
              {insightsLoading ? 'Calculando...' : 'Recalcular'}
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
              color: 'var(--muted)',
              fontSize: 13,
              marginBottom: 8,
            }}
          >
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(15, 23, 42, 0.06)',
                border: '1px solid var(--border)',
              }}
            >
              Mês: {selectedMonth || 'todos'}
            </span>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(15, 23, 42, 0.06)',
                border: '1px solid var(--border)',
              }}
            >
              Categoria: {selectedCategory || 'todas'}
            </span>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(15, 23, 42, 0.06)',
                border: '1px solid var(--border)',
              }}
            >
              Intervalo: {dateFrom || 'início'} → {dateTo || 'hoje'}
            </span>
          </div>
          {insightsError && (
            <p className="empty" style={{ color: '#f59e0b' }}>
              {insightsError} (usando logica local)
            </p>
          )}
          {insightsLoading ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <SkeletonBlock height={60} />
              <SkeletonBlock height={60} />
              <SkeletonBlock height={60} />
            </div>
          ) : !insightsLoading && insights.length === 0 ? (
            <p className="empty">Sem insights ainda.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <InsightCard
                title="Visão geral"
                emoji="📊"
                items={insights.slice(0, 4)}
                accent="#38bdf8"
              />
              <InsightCard
                title="Alertas"
                emoji="⚠️"
                items={insights.slice(4, 8)}
                accent="#f97316"
              />
              <InsightCard
                title="Sugestões e projeções"
                emoji="💡"
                items={insights.slice(8)}
                accent="#a855f7"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid two">
        <div className="panel" style={{ minHeight: 320 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <h3>Série mensal</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <PeriodButtons value={trendPeriod} onChange={setTrendPeriod} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ color: 'var(--muted)', fontSize: 13 }}>Meta gasto:</label>
                <input
                  type="number"
                  value={metaDespesa ?? ''}
                  onChange={(e) => setMetaDespesa(e.target.value ? Number(e.target.value) : null)}
                  placeholder="R$"
                  style={{ width: 110 }}
                />
              </div>
            </div>
          </div>
          {filteredTransactions.length === 0 ? (
            <SkeletonBlock height={220} />
          ) : (
            <Suspense fallback={<p className="empty">Carregando grafico...</p>}>
              <MonthlyChart data={monthlySeriesFiltered} meta={metaDespesa ?? undefined} />
            </Suspense>
          )}
        </div>

        <div className="panel" style={{ minHeight: 320 }}>
          <h3>Categorias</h3>
          {categoryTotals.length === 0 ? (
            <SkeletonBlock height={220} />
          ) : (
            <Suspense fallback={<p className="empty">Carregando grafico...</p>}>
              <CategoryChart data={categoryTotals} colors={colors} />
            </Suspense>
          )}
        </div>
        <div className="panel" style={{ minHeight: 320 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>Tendência do saldo</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <PeriodButtons value={trendPeriod} onChange={setTrendPeriod} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ color: 'var(--muted)', fontSize: 13 }}>Meta (saldo):</label>
                <input
                  type="number"
                  value={metaMensal ?? ''}
                  onChange={(e) => setMetaMensal(e.target.value ? Number(e.target.value) : null)}
                  placeholder="R$"
                  style={{ width: 120 }}
                />
              </div>
            </div>
          </div>
          {monthlySeriesFiltered.length === 0 ? (
            <SkeletonBlock height={220} />
          ) : (
            <Suspense fallback={<p className="empty">Carregando grafico...</p>}>
              <InsightsTrend data={monthlySeriesFiltered} meta={metaMensal ?? undefined} />
            </Suspense>
          )}
        </div>
      </div>

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>Transacoes</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>{transactions.length} item(s)</span>
            <button className="secondary" onClick={() => setShowTransactions((v) => !v)} style={{ marginBottom: 8 }}>
              {showTransactions ? 'Ocultar' : 'Mostrar'}
            </button>
            {transactions.length > 0 && (
              <button className="secondary" onClick={() => useTransactionsStore.getState().clear()} style={{ marginBottom: 8 }}>
                Limpar tudo
              </button>
            )}
          </div>
        </div>
        {showTransactions ? (
          filteredTransactions.length === 0 ? (
            <p className="empty">Sem transacoes para os filtros atuais.</p>
          ) : (
            <TransactionsTable
              transactions={filteredTransactions}
              onDelete={remove}
              onEdit={setEditing}
              highlightId={lastEditedId}
              notify={pushToast}
              sortBy={sortBy}
              sortDir={sortDir}
              onSortChange={handleSortChange}
            />
          )
        ) : (
          <p className="empty">Lista ocultada. Clique em "Mostrar" para ver novamente.</p>
        )}
      </div>

      {editing && (
        <EditTransactionModal
          transaction={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSave={(t) => {
            update(t.id, t);
            pushToast('Transacao atualizada.', 'success');
            setLastEditedId(t.id);
            setEditing(null);
          }}
        />
      )}

      {toasts.length > 0 && (
        <div className="toasts">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.type}`}>
              <span style={{ marginRight: 8 }}>{toastIcon[t.type]}</span>
              <span>{t.message}</span>
              <button
                className="secondary"
                style={{ marginLeft: 8, padding: '4px 8px' }}
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              >
                Fechar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="card">
      <h3>{label}</h3>
      <div className="value" style={{ color: accent }}>
        {currency.format(value)}
      </div>
    </div>
  );
}

function TransactionForm({
  onSubmit,
  categories,
  initial,
  onCancel,
  notify,
}: {
  onSubmit: (t: Transaction) => void;
  categories: string[];
  initial?: Transaction;
  onCancel?: () => void;
  notify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const dateInputId = useMemo(() => `date-${crypto.randomUUID()}`, []);
  const categoryRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState(() => ({
    type: (initial?.type ?? 'income') as Transaction['type'],
    category: initial?.category ?? '',
    amount: initial ? String(initial.amount) : '',
    date: initial?.date ?? '',
    note: initial?.note ?? '',
  }));
  const [errors, setErrors] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm({
      type: (initial?.type ?? 'income') as Transaction['type'],
      category: initial?.category ?? '',
      amount: initial ? String(initial.amount) : '',
      date: initial?.date ?? '',
      note: initial?.note ?? '',
    });
    categoryRef.current?.focus();
  }, [initial]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateForm(form);
    if (validation) {
      setErrors(validation);
      notify?.(validation, 'error');
      return;
    }
    setErrors(null);
    setSubmitting(true);
    const amountNum = parseAmount(form.amount);

    const tx: Transaction = {
      id: initial?.id ?? crypto.randomUUID(),
      date: form.date,
      type: form.type,
      category: form.category.trim(),
      amount: amountNum,
      note: form.note.trim(),
    };
    onSubmit(tx);
    notify?.(initial ? 'Transacao atualizada.' : 'Transacao adicionada.', 'success');
    setSubmitting(false);
    if (initial) onCancel?.();
    else setForm((s) => ({ ...s, amount: '', note: '' }));
  };

  return (
    <form onSubmit={submit}>
      <select
        value={form.type}
        onChange={(e) => setForm({ ...form, type: e.target.value as Transaction['type'] })}
      >
        <option value="income">Entrada</option>
        <option value="expense">Saida</option>
      </select>
      <CategoryAutocomplete
        value={form.category}
        options={categories}
        placeholder="Categoria"
        onChange={(val) => setForm({ ...form, category: val })}
        inputRef={categoryRef}
      />
      <input
        type="text"
        placeholder="Valor"
        inputMode="decimal"
        value={form.amount}
        onChange={(e) => {
          const val = e.target.value.replace(/[^\d.,-]/g, '');
          setForm({ ...form, amount: val });
        }}
        onBlur={() => {
          const num = parseAmount(form.amount);
          if (!Number.isNaN(num)) {
            setForm((s) => ({ ...s, amount: numberMask.format(num) }));
          }
        }}
      />
      <input
        type="hidden"
        value={form.date}
      />
      <DateInput label="Data" value={form.date} onChange={(val) => setForm({ ...form, date: val })} id={dateInputId} />
      <textarea
        placeholder="Nota (opcional)"
        value={form.note}
        onChange={(e) => setForm({ ...form, note: e.target.value })}
      />
      {errors && <p className="empty" style={{ color: '#ef4444' }}>{errors}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : initial ? 'Salvar alteracoes' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}

function TransactionsTable({
  transactions,
  onDelete,
  onEdit,
  notify,
  highlightId,
  sortBy,
  sortDir,
  onSortChange,
}: {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (t: Transaction) => void;
  notify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  highlightId?: string | null;
  sortBy: 'date' | 'type' | 'category' | 'amount';
  sortDir: 'asc' | 'desc';
  onSortChange: (field: 'date' | 'type' | 'category' | 'amount') => void;
}) {
  const sorted = useMemo(
    () => {
      const arr = [...transactions];
      arr.sort((a, b) => {
        let res = 0;
        if (sortBy === 'date') res = new Date(a.date).getTime() - new Date(b.date).getTime();
        else if (sortBy === 'amount') res = a.amount - b.amount;
        else if (sortBy === 'category') res = a.category.localeCompare(b.category);
        else res = a.type.localeCompare(b.type);
        return sortDir === 'asc' ? res : -res;
      });
      return arr;
    },
    [transactions, sortBy, sortDir],
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(900);
  const [viewportWidth, setViewportWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useLayoutEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.clientWidth);
      } else {
        setWidth(window.innerWidth - 60);
      }
      setViewportWidth(window.innerWidth);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const t = sorted[index];
    return (
      <div
        style={{
          ...style,
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr 1.5fr 1.2fr 1.5fr 1fr',
          alignItems: 'center',
          padding: '0 10px',
          background: index % 2 === 0 ? 'rgba(15,23,42,0.04)' : 'transparent',
        }}
        className={highlightId === t.id ? 'row-highlight' : ''}
      >
        <div>{formatDate(t.date)}</div>
        <div>
          <span className={`badge ${t.type}`}>{t.type === 'income' ? 'Entrada' : 'Saida'}</span>
        </div>
        <div>{t.category}</div>
        <div>{currency.format(t.amount)}</div>
        <div>{t.note || '-'}</div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button className="secondary" onClick={() => onEdit(t)}>
            Editar
          </button>
          <button
            className="secondary"
            onClick={() => {
              onDelete(t.id);
              notify?.('Transacao removida.', 'info');
            }}
          >
            Excluir
          </button>
        </div>
      </div>
    );
  };

  const listHeight = Math.min(480, Math.max(120, sorted.length * 56));

  return (
    <div ref={containerRef}>
      {viewportWidth < 768 ? (
        <div className="tx-cards">
          {sorted.map((t) => (
            <div key={t.id} className={`tx-card ${highlightId === t.id ? 'row-highlight' : ''}`}>
              <div className="tx-row">
                <span className="tx-label">Data</span>
                <span>{formatDate(t.date)}</span>
              </div>
              <div className="tx-row">
                <span className="tx-label">Tipo</span>
                <span className={`badge ${t.type}`}>{t.type === 'income' ? 'Entrada' : 'Saida'}</span>
              </div>
              <div className="tx-row">
                <span className="tx-label">Categoria</span>
                <span>{t.category}</span>
              </div>
              <div className="tx-row">
                <span className="tx-label">Valor</span>
                <span>{currency.format(t.amount)}</span>
              </div>
              <div className="tx-row">
                <span className="tx-label">Nota</span>
                <span>{t.note || '-'}</span>
              </div>
              <div className="tx-actions">
                <button className="secondary" onClick={() => onEdit(t)}>
                  Editar
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    onDelete(t.id);
                    notify?.('Transacao removida.', 'info');
                  }}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr 1.5fr 1.2fr 1.5fr 1fr',
              padding: '0 10px 6px',
              color: 'var(--muted)',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {[
              { label: 'Data', field: 'date' },
              { label: 'Tipo', field: 'type' },
              { label: 'Categoria', field: 'category' },
              { label: 'Valor', field: 'amount' },
              { label: 'Nota', field: null },
              { label: '', field: null },
            ].map((col, idx) => (
              <div
                key={idx}
                style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: col.field ? 'pointer' : 'default' }}
                onClick={() => col.field && onSortChange(col.field as 'date' | 'type' | 'category' | 'amount')}
              >
                <span>{col.label}</span>
                {col.field === sortBy && <span style={{ fontSize: 12 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
              </div>
            ))}
          </div>
      {sorted.length <= 15 ? (
        <table>
          <tbody>
            {sorted.map((t) => (
              <tr key={t.id} className={highlightId === t.id ? 'row-highlight' : ''}>
                <td>{formatDate(t.date)}</td>
                    <td>
                      <span className={`badge ${t.type}`}>{t.type === 'income' ? 'Entrada' : 'Saida'}</span>
                    </td>
                    <td>{t.category}</td>
                    <td>{currency.format(t.amount)}</td>
                    <td>{t.note || '-'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="secondary" onClick={() => onEdit(t)}>
                        Editar
                      </button>
                      <button
                        className="secondary"
                        onClick={() => {
                          onDelete(t.id);
                          notify?.('Transacao removida.', 'info');
                        }}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <List height={listHeight} itemCount={sorted.length} itemSize={56} width={width}>
              {Row}
            </List>
          )}
        </>
      )}
    </div>
  );
}

function EditTransactionModal({
  transaction,
  categories,
  onClose,
  onSave,
}: {
  transaction: Transaction;
  categories: string[];
  onClose: () => void;
  onSave: (t: Transaction) => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Editar transacao</h3>
          <button className="secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
        <TransactionForm
          initial={transaction}
          categories={categories}
          onSubmit={onSave}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}

function InsightCard({
  title,
  emoji,
  items,
  accent,
}: {
  title: string;
  emoji: string;
  items: string[];
  accent: string;
}) {
  if (!items.length) return null;
  return (
    <div
      style={{
        border: `1px solid ${accent}`,
        borderRadius: 10,
        padding: 12,
        background: 'var(--panel)',
        color: 'var(--text)',
        boxShadow: '0 8px 22px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: accent }}>
        <span>{emoji}</span>
        <strong>{title}</strong>
      </div>
      <ul
        style={{
          margin: 0,
          paddingLeft: 18,
          fontSize: 14,
          lineHeight: 1.45,
          wordBreak: 'break-word',
          whiteSpace: 'normal',
        }}
      >
        {items.map((item, idx) => (
          <li key={idx} style={{ marginBottom: 6 }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SkeletonBlock({ height }: { height: number }) {
  return <div className="skeleton" style={{ height }} aria-hidden="true" />;
}

function PeriodButtons({
  value,
  onChange,
}: {
  value: 3 | 6 | 12;
  onChange: (v: 3 | 6 | 12) => void;
}) {
  const options: Array<{ label: string; v: 3 | 6 | 12 }> = [
    { label: '3m', v: 3 },
    { label: '6m', v: 6 },
    { label: '12m', v: 12 },
  ];
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map((opt) => (
        <button
          key={opt.v}
          className="secondary"
          onClick={() => onChange(opt.v)}
          aria-label={`Período ${opt.label}`}
          style={{
            padding: '6px 10px',
            minHeight: 32,
            borderColor: value === opt.v ? '#38bdf8' : 'var(--border)',
            color: value === opt.v ? '#38bdf8' : 'var(--text)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function CategoryAutocomplete({
  value,
  options,
  placeholder,
  onChange,
  inputRef,
}: {
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (val: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(value);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setInput(value);
  }, [value]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', onClickOutside);
    return () => document.removeEventListener('click', onClickOutside);
  }, []);

  const filtered = options.filter((opt) => opt.toLowerCase().includes(input.toLowerCase()));

  return (
    <div className="autocomplete" ref={containerRef}>
      <input
        type="text"
        placeholder={placeholder}
        value={input}
        ref={inputRef}
        onChange={(e) => {
          const val = e.target.value;
          setInput(val);
          onChange(val);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        aria-label={placeholder}
      />
      {open && filtered.length > 0 && (
        <ul className="autocomplete-list">
          {filtered.map((opt) => (
            <li
              key={opt}
              onMouseDown={(e) => {
                e.preventDefault();
                setInput(opt);
                onChange(opt);
                setOpen(false);
              }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function buildFallbackInsight(tx: Transaction[]): string[] {
  if (!tx.length) return ['Adicione transacoes para ver insights.'];
  const last30 = tx.filter((t) => Date.now() - new Date(t.date).getTime() < 30 * 864e5);
  const expense30 = last30
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const byCat: Record<string, number> = {};
  tx.forEach((t) => {
    byCat[t.category] = (byCat[t.category] || 0) + (t.type === 'income' ? t.amount : -t.amount);
  });
  const topCat = Object.entries(byCat).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  return [
    `Gasto nos ultimos 30 dias: ${currency.format(expense30)}`,
    topCat ? `Maior impacto: ${topCat[0]} (${currency.format(topCat[1])})` : '',
    expense30 > 2000 ? 'Atencao: despesas altas no ultimo mes.' : 'Gastos recentes sob controle.',
  ].filter(Boolean);
}

function validateForm(form: { date: string; category: string; amount: string }) {
  if (!form.category.trim()) return 'Informe a categoria.';
  if (!form.date || !/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return 'Informe uma data valida (YYYY-MM-DD).';
  const num = parseAmount(form.amount);
  if (Number.isNaN(num) || num === 0) return 'Informe um valor numerico.';
  return null;
}

function parseAmount(val: string) {
  if (!val) return NaN;
  const clean = val.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  return Number(clean);
}

function loadSavedFilters() {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const fromUrl = {
    selectedMonth: params.get('month') || undefined,
    selectedCategory: params.get('category') || undefined,
    dateFrom: params.get('from') || undefined,
    dateTo: params.get('to') || undefined,
    search: params.get('q') || undefined,
  };
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    const fromStorage = raw ? JSON.parse(raw) : {};
    return { ...fromStorage, ...Object.fromEntries(Object.entries(fromUrl).filter(([, v]) => v)) };
  } catch {
    return { ...Object.fromEntries(Object.entries(fromUrl).filter(([, v]) => v)) };
  }
}

function mergeTransactions(existing: Transaction[], incoming: Transaction[]) {
  const byId = new Map<string, Transaction>();
  const byKey = new Map<string, Transaction>();
  const makeKey = (t: Transaction) => `${t.date}|${t.category}|${t.amount}|${t.note || ''}`;
  existing.forEach((t) => {
    byId.set(t.id, t);
    byKey.set(makeKey(t), t);
  });
  let added = 0;
  let skipped = 0;
  incoming.forEach((t) => {
    if (byId.has(t.id)) {
      skipped += 1;
      return;
    }
    const key = makeKey(t);
    if (byKey.has(key)) {
      skipped += 1;
      return;
    }
    byId.set(t.id, t);
    byKey.set(key, t);
    added += 1;
  });
  return { merged: Array.from(byId.values()), added, skipped };
}

export default App;
