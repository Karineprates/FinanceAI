import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type MonthlyPoint = {
  month: string;
  income: number;
  expense: number;
  net: number;
};

export default function MonthlyChart({ data, meta }: { data: MonthlyPoint[]; meta?: number }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
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
        {typeof meta === 'number' && (
          <ReferenceLine
            y={meta}
            stroke="#f97316"
            strokeDasharray="4 3"
            label={{ value: 'Meta', position: 'insideTopRight', fill: '#f97316' }}
          />
        )}
        <Legend />
        <Bar dataKey="income" fill="#22c55e" name="Entradas" />
        <Bar dataKey="expense" fill="#ef4444" name="Saidas" />
      </BarChart>
    </ResponsiveContainer>
  );
}
