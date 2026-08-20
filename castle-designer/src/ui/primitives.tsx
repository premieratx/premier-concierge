import type { ReactNode } from 'react';

export const usd = (n: number, digits = 0) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });

export const num = (n: number, digits = 0) =>
  n.toLocaleString('en-US', { maximumFractionDigits: digits });

export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-[11px] text-slate-600">{subtitle}</p>}
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

export function Row({
  label,
  value,
  emphasis = false,
  muted = false,
}: {
  label: string;
  value: ReactNode;
  emphasis?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className={muted ? 'text-slate-600' : 'text-slate-400'}>{label}</span>
      <span
        className={`font-mono tabular-nums ${
          emphasis ? 'text-base font-semibold text-slate-50' : 'text-slate-200'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function Button({
  children,
  onClick,
  active = false,
  disabled = false,
  title,
  tone = 'default',
}: {
  children: ReactNode;
  onClick?(): void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  tone?: 'default' | 'accent';
}) {
  const base =
    'rounded px-2.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-35';
  const style = active
    ? tone === 'accent'
      ? 'bg-amber-500 text-slate-950'
      : 'bg-sky-500 text-slate-950'
    : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700 hover:text-slate-50';
  return (
    <button type="button" className={`${base} ${style}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

export function Meter({
  value,
  label,
  detail,
  danger,
}: {
  /** Fraction of the budget consumed. Values above 1 are the point. */
  value: number;
  label: string;
  detail: string;
  danger: boolean;
}) {
  const pct = Math.min(100, value * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <span
          className={`font-mono text-sm tabular-nums ${danger ? 'text-rose-400' : 'text-slate-200'}`}
        >
          {detail}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${
            danger ? 'bg-rose-500' : value > 0.8 ? 'bg-amber-400' : 'bg-emerald-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Pill({ children, tone }: { children: ReactNode; tone: 'error' | 'warning' | 'pass' }) {
  const styles = {
    error: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
    warning: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
    pass: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  } as const;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${styles[tone]}`}
    >
      {children}
    </span>
  );
}
