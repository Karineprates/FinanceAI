import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { LegendProps, TooltipProps } from 'recharts';

type CategoryPoint = { category: string; total: number };

export default function CategoryChart({
  data,
  colors,
}: {
  data: CategoryPoint[];
  colors: string[];
}) {
  const palette = colors.length
    ? colors
    : ['#22c55e', '#f97316', '#3b82f6', '#a855f7', '#ef4444', '#eab308'];

  // Consolida categorias com a mesma escrita (case-insensitive) para manter cores consistentes
  const aggregated = data.reduce<Map<string, { category: string; value: number }>>((map, d) => {
    const key = d.category.trim().toLowerCase();
    const current = map.get(key);
    const value = Math.abs(d.total) + (current?.value ?? 0);
    const label = current?.category ?? d.category.trim();
    map.set(key, { category: label, value });
    return map;
  }, new Map());

  const chartData = Array.from(aggregated.values())
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = chartData.reduce((s, d) => s + d.value, 0);
  const money = (v: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(v);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="category" innerRadius={60} outerRadius={110} paddingAngle={2}>
          {chartData.map((_, idx) => (
            <Cell key={idx} fill={palette[idx % palette.length]} stroke="#0f172a" />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: 'var(--panel)',
            border: `1px solid var(--panel-border)`,
            borderRadius: 8,
            color: 'var(--text)',
          }}
          labelStyle={{ color: 'var(--text)' }}
          itemStyle={{ color: 'var(--text)' }}
          content={(props) => <CustomTooltip {...props} money={money} total={total} />}
        />
        <Legend
          verticalAlign="bottom"
          align="center"
          layout="horizontal"
          content={(props) => <CustomLegend {...props} data={chartData} total={total} palette={palette} />}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
  money,
  total,
}: TooltipProps<number, string> & { money: (v: number) => string; total: number }) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  const name = (item as any)?.payload?.category ?? label;
  const value = Number(item.value || 0);
  const pct = total ? ((value / total) * 100).toFixed(1) : '0';
  return (
    <div
      style={{
        background: '#0f172a',
        color: '#e2e8f0',
        padding: '8px 10px',
        borderRadius: 6,
        border: '1px solid #1e293b',
      }}
    >
      <div style={{ fontWeight: 600 }}>{name}</div>
      <div>Valor: {money(value)}</div>
      <div>Participação: {pct}%</div>
    </div>
  );
}

function CustomLegend({
  data,
  total,
  palette,
}: LegendProps & { data: { category: string; value: number }[]; total: number; palette: string[] }) {
  const items = data.map((d, idx) => {
    const pct = total ? Math.round((d.value / total) * 100) : 0;
    return { category: d.category, pct, color: palette[idx % palette.length] };
  });
  return (
    <ul
      style={{
        listStyle: 'none',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'center',
        padding: 0,
        margin: '8px 0 0',
      }}
    >
      {items.map((it, idx) => (
        <li
          key={idx}
          style={{
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text)',
            fontSize: 13,
            minWidth: 110,
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              background: it.color,
              borderRadius: 2,
              marginRight: 6,
            }}
          />
          <span>{it.category}</span>
          <span style={{ marginLeft: 6, color: 'var(--muted)' }}>({it.pct}%)</span>
        </li>
      ))}
    </ul>
  );
}
