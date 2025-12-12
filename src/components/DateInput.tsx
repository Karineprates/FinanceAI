import { useEffect, useMemo, useRef, useState } from 'react';

type DateInputProps = {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
};

function formatISO(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseISO(val: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return null;
  const dt = new Date(`${val}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const months = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function DateInput({ label, value, onChange, placeholder = 'dd/mm/aaaa', id, disabled }: DateInputProps) {
  const [open, setOpen] = useState(false);
  const initialDate = useMemo(() => parseISO(value) ?? new Date(), [value]);
  const [viewDate, setViewDate] = useState<Date>(initialDate);
  const ref = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!value) return;
    const dt = parseISO(value);
    if (dt) setViewDate(dt);
  }, [value]);

  const monthData = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const first = new Date(year, month, 1);
    const startDay = first.getDay(); // 0..6
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null; iso?: string }> = [];
    for (let i = 0; i < startDay; i += 1) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d += 1) {
      cells.push({ day: d, iso: formatISO(new Date(year, month, d)) });
    }
    return { cells, year, month };
  }, [viewDate]);

  const handleSelect = (iso?: string | null) => {
    if (!iso) return;
    onChange(iso);
    setOpen(false);
  };

  const displayValue = useMemo(() => {
    if (!value) return '';
    const dt = parseISO(value);
    if (!dt) return value;
    const d = String(dt.getDate()).padStart(2, '0');
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const y = dt.getFullYear();
    return `${d}/${m}/${y}`;
  }, [value]);

  const goMonth = (delta: number) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const todayIso = formatISO(new Date());

  return (
    <div ref={ref} className="date-input">
      {label && (
        <label htmlFor={id} style={{ display: 'block', marginBottom: 4, color: 'var(--muted)', fontSize: 13 }}>
          {label}
        </label>
      )}
      <div className="date-input__field" onClick={() => !disabled && setOpen((o) => !o)}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={displayValue}
          onChange={(e) => {
            const raw = e.target.value;
            // allows direct typing dd/mm/yyyy
            const parts = raw.split(/[\\/]/);
            if (parts.length === 3) {
              const [d, m, y] = parts;
              if (d.length === 2 && m.length === 2 && y.length === 4) {
                const iso = `${y}-${m}-${d}`;
                if (parseISO(iso)) onChange(iso);
              }
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => !disabled && setOpen(true)}
        />
        <span className="date-input__icon" aria-hidden>📅</span>
      </div>
      {open && !disabled && (
        <div className="date-input__popover">
          <div className="date-input__header">
            <span>{months[monthData.month]} de {monthData.year}</span>
            <div className="date-input__nav">
              <button type="button" className="secondary" onClick={() => goMonth(-1)} aria-label="Mês anterior">←</button>
              <button type="button" className="secondary" onClick={() => goMonth(1)} aria-label="Próximo mês">→</button>
            </div>
          </div>
          <div className="date-input__weekdays">
            {weekDays.map((w) => <span key={w}>{w}</span>)}
          </div>
          <div className="date-input__grid">
            {monthData.cells.map((cell, idx) => {
              const selected = cell.iso && cell.iso === value;
              const isToday = cell.iso === todayIso;
              return cell.day ? (
                <button
                  type="button"
                  key={idx}
                  className={`date-input__day${selected ? ' selected' : ''}${isToday ? ' today' : ''}`}
                  onClick={() => handleSelect(cell.iso)}
                >
                  {cell.day}
                </button>
              ) : (
                <span key={idx} />
              );
            })}
          </div>
          <div className="date-input__footer">
            <button type="button" className="secondary" onClick={() => handleSelect(null)}>Limpar</button>
            <button type="button" className="secondary" onClick={() => handleSelect(todayIso)}>Hoje</button>
          </div>
        </div>
      )}
    </div>
  );
}
