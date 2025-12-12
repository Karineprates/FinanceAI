import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type MonthlyPoint = { month: string; income: number; expense: number; net: number };

export default function InsightsTrend({ data, meta }: { data: MonthlyPoint[]; meta?: number }) {
  if (!data.length) return <p className="empty">Sem dados para tendência.</p>;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.6} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
        <XAxis dataKey="month" stroke="var(--muted)" />
        <YAxis stroke="var(--muted)" />
        <Tooltip
          contentStyle={{
            background: 'var(--panel)',
            border: `1px solid var(--panel-border)`,
            borderRadius: 8,
            color: 'var(--text)',
          }}
          labelStyle={{ color: 'var(--text)' }}
          itemStyle={{ color: 'var(--text)' }}
        />
        <ReferenceLine y={0} stroke="#e11d48" strokeDasharray="4 3" />
        {typeof meta === 'number' && (
          <ReferenceLine y={meta} stroke="#f97316" strokeDasharray="4 3" label={{ value: 'Meta', position: 'insideTopRight', fill: '#f97316' }} />
        )}
        <Area
          type="monotone"
          dataKey="net"
          name="Saldo"
          stroke="#22c55e"
          fillOpacity={1}
          fill="url(#netGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
