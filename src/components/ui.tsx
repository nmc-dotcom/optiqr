import type { CSSProperties, ReactNode } from "react";
import { C, FONT, MONO } from "../lib/brand";

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      className="rounded-lg p-5"
      style={{ background: C.paper, border: `1px solid ${C.line}`, ...style }}
    >
      {children}
    </div>
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className="text-xs font-semibold tracking-wide" style={{ color: C.inkSoft }}>
        {children}
      </span>
      {hint && (
        <span className="text-xs" style={{ color: C.inkSoft, opacity: 0.7 }}>
          {hint}
        </span>
      )}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  multiline,
  rows = 3,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  mono?: boolean;
}) {
  const base: CSSProperties = {
    background: C.cream,
    border: `1px solid ${C.line}`,
    color: C.ink,
    fontFamily: mono ? MONO : FONT,
  };
  const cls = "w-full rounded px-3 py-2 text-sm outline-none";
  return multiline ? (
    <textarea
      className={cls + " resize-y"}
      rows={rows}
      style={base}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  ) : (
    <input
      className={cls}
      style={base}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Seg({
  options,
  value,
  onChange,
  columns,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: any) => void;
  columns?: number;
}) {
  return (
    <div
      className="grid gap-1 rounded p-1"
      style={{
        background: C.cream,
        border: `1px solid ${C.line}`,
        gridTemplateColumns: `repeat(${columns || options.length}, minmax(0,1fr))`,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="rounded px-2 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: active ? C.green : "transparent",
              color: active ? C.paper : C.inkSoft,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        className="h-1 flex-1"
        style={{ accentColor: C.green }}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span
        className="w-16 text-right text-xs tabular-nums"
        style={{ color: C.inkSoft, fontFamily: MONO }}
      >
        {format ? format(value) : value}
      </span>
    </div>
  );
}

export function ColorField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2" style={{ opacity: disabled ? 0.4 : 1 }}>
      <input
        type="color"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 cursor-pointer rounded"
        style={{ border: `1px solid ${C.line}`, background: C.cream, padding: 2 }}
      />
      <input
        value={value.toUpperCase()}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value.trim();
          if (/^#?[0-9a-fA-F]{6}$/.test(v)) onChange(v.startsWith("#") ? v : "#" + v);
        }}
        className="w-24 rounded px-2 py-1.5 text-xs uppercase outline-none"
        style={{
          background: C.cream,
          border: `1px solid ${C.line}`,
          color: C.ink,
          fontFamily: MONO,
        }}
      />
    </div>
  );
}

export function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-xs"
      style={{ color: C.inkSoft }}
    >
      <span
        className="flex h-4 w-4 items-center justify-center rounded"
        style={{
          border: `1px solid ${checked ? C.green : C.line}`,
          background: checked ? C.green : C.cream,
          color: C.paper,
          fontSize: 10,
        }}
      >
        {checked ? "✓" : ""}
      </span>
      {children}
    </button>
  );
}
