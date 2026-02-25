import { useRef, useCallback, memo } from 'react';
import { useStore, type Bin } from '../store/useStore';
import { GF, BIN_GROUPS } from '../gridfinity/constants';

interface Props {
  bin: Bin;
}

export default memo(function BinConfigurator({ bin }: Props) {
  const updateBin = useStore((s) => s.updateBin);

  function update(updates: Partial<Bin>) {
    updateBin(bin.id, updates);
  }

  function clampUpdate(key: keyof Bin, value: number, min: number, max: number) {
    const clamped = Math.min(max, Math.max(min, value));
    update({ [key]: clamped } as any);
  }

  const outerW = bin.w * GF.CELL_SIZE - GF.TOLERANCE;
  const outerD = bin.d * GF.CELL_SIZE - GF.TOLERANCE;
  const totalH = bin.h * GF.HEIGHT_UNIT + GF.BASE_TOTAL_HEIGHT;

  return (
    <div className="animate-slide-up" style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <SectionHeader>BIN CONFIGURATION</SectionHeader>

      <Field label="Label">
        <input
          type="text" value={bin.label}
          onChange={(e) => update({ label: e.target.value })}
          className="w-full rounded"
          style={{
            background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', height: 32, padding: '4px 10px', fontSize: 13,
          }}
          aria-label="Bin label"
        />
      </Field>

      <SectionHeader sub>DIMENSIONS</SectionHeader>
      <div className="flex items-center" style={{ gap: 8 }}>
        <NumInput label="W" value={bin.w} min={1} max={10} onChange={(v) => update({ w: v })} onClamp={(v) => clampUpdate('w', v, 1, 10)} />
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>x</span>
        <NumInput label="D" value={bin.d} min={1} max={10} onChange={(v) => update({ d: v })} onClamp={(v) => clampUpdate('d', v, 1, 10)} />
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>x</span>
        <NumInput label="H" value={bin.h} min={1} max={12} onChange={(v) => update({ h: v })} onClamp={(v) => clampUpdate('h', v, 1, 12)} />
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 6 }}>
        {outerW.toFixed(1)} x {outerD.toFixed(1)} x {totalH.toFixed(2)}mm
      </p>
      <button
        onClick={() => update({ w: bin.d, d: bin.w })}
        className="rounded transition-colors hover:brightness-125"
        style={{
          marginTop: 6, padding: '6px 12px', fontSize: 12,
          background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
        }}
        aria-label="Rotate bin, swap width and depth"
      >
        Rotate W/D
      </button>

      <SectionHeader sub>GEOMETRY</SectionHeader>
      <Field label={`Corner R: ${bin.cornerRadius.toFixed(2)}mm`}>
        <DebouncedSlider
          min={0} max={GF.BIN_CORNER_RADIUS} step={0.25}
          value={bin.cornerRadius}
          onChange={(v) => update({ cornerRadius: v })}
          ariaLabel="Corner radius"
        />
      </Field>
      <div className="flex" style={{ gap: 10 }}>
        <Field label="Wall (mm)">
          <input
            type="number" min={0.4} max={3} step={0.1}
            value={bin.wallThickness}
            onChange={(e) => update({ wallThickness: Number(e.target.value) })}
            onBlur={(e) => clampUpdate('wallThickness', Number(e.target.value), 0.4, 3)}
            className="rounded text-center"
            style={{
              width: 72, height: 32, padding: '4px 8px', fontSize: 14,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
            aria-label="Wall thickness"
          />
        </Field>
        <Field label="Bottom (mm)">
          <input
            type="number" min={0.4} max={3} step={0.1}
            value={bin.bottomThickness}
            onChange={(e) => update({ bottomThickness: Number(e.target.value) })}
            onBlur={(e) => clampUpdate('bottomThickness', Number(e.target.value), 0.4, 3)}
            className="rounded text-center"
            style={{
              width: 72, height: 32, padding: '4px 8px', fontSize: 14,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
            aria-label="Bottom thickness"
          />
        </Field>
      </div>

      <SectionHeader sub>FEATURES</SectionHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Toggle label="Label Shelf" checked={bin.labelShelf} onChange={(v) => update({ labelShelf: v })} />
        {bin.labelShelf && (
          <Field label="Shelf Width (mm)">
            <input
              type="number" min={5} max={30} step={1}
              value={bin.labelWidth}
              onChange={(e) => update({ labelWidth: Number(e.target.value) })}
              onBlur={(e) => clampUpdate('labelWidth', Number(e.target.value), 5, 30)}
              className="rounded text-center"
              style={{
                width: 72, height: 32, padding: '4px 8px', fontSize: 14,
                background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                fontFamily: 'JetBrains Mono, monospace',
              }}
              aria-label="Label shelf width"
            />
          </Field>
        )}
        <Toggle label="Magnet Holes" checked={bin.magnets} onChange={(v) => update({ magnets: v })} />
        <Toggle label="Screw Holes (M3)" checked={bin.screws} onChange={(v) => update({ screws: v })} />
      </div>

      <SectionHeader sub>DIVIDERS</SectionHeader>
      <div className="flex" style={{ gap: 10 }}>
        <NumInput label="X" value={bin.dividersX} min={0} max={9} onChange={(v) => update({ dividersX: v })} onClamp={(v) => clampUpdate('dividersX', v, 0, 9)} />
        <NumInput label="Y" value={bin.dividersY} min={0} max={9} onChange={(v) => update({ dividersY: v })} onClamp={(v) => clampUpdate('dividersY', v, 0, 9)} />
      </div>

      <SectionHeader sub>COLOR</SectionHeader>
      <div className="flex" style={{ gap: 6, marginTop: 8 }} role="radiogroup" aria-label="Bin color">
        {['#00d4aa', '#4488ff', '#ff6644', '#ffaa00', '#aa44ff', '#ff44aa'].map((c) => (
          <button
            key={c} onClick={() => update({ color: c })}
            className="transition-transform"
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: c,
              border: bin.color === c ? '2px solid white' : '2px solid transparent',
              transform: bin.color === c ? 'scale(1.15)' : 'scale(1)',
              boxShadow: bin.color === c ? '0 0 8px rgba(255,255,255,0.2)' : 'none',
            }}
            role="radio" aria-checked={bin.color === c} aria-label={`Color ${c}`}
          />
        ))}
      </div>

      <SectionHeader sub>GROUP</SectionHeader>
      <div className="flex flex-wrap" style={{ gap: 4, marginTop: 4 }}>
        {BIN_GROUPS.map((g) => {
          const isActive = (bin.group || '') === g.id;
          return (
            <button
              key={g.id}
              onClick={() => update({ group: g.id })}
              className="rounded transition-colors hover:brightness-125"
              style={{
                padding: '4px 10px', fontSize: 11,
                background: isActive
                  ? (g.color ? g.color + '33' : 'var(--bg-tertiary)')
                  : 'var(--bg-tertiary)',
                border: isActive
                  ? `1px solid ${g.color || 'var(--accent)'}`
                  : '1px solid var(--border)',
                color: isActive
                  ? (g.color || 'var(--text-primary)')
                  : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {g.color && (
                <span style={{
                  display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                  background: g.color, marginRight: 4, verticalAlign: 'middle',
                }} />
              )}
              {g.label}
            </button>
          );
        })}
      </div>
    </div>
  );
});

function SectionHeader({ children, sub }: { children: React.ReactNode; sub?: boolean }) {
  return (
    <h4
      className="font-bold uppercase"
      style={{
        fontSize: 11, letterSpacing: '0.05em',
        color: 'rgba(255,255,255,0.5)',
        marginTop: sub ? 16 : 0,
        marginBottom: 8,
      }}
    >
      {children}
    </h4>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label className="block" style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function NumInput({ label, value, min, max, onChange, onClamp }: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void; onClamp?: (v: number) => void;
}) {
  return (
    <div className="flex items-center" style={{ gap: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}:</span>
      <input
        type="number" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onBlur={(e) => onClamp?.(Number(e.target.value))}
        className="rounded text-center"
        style={{
          width: 52, height: 32, padding: '4px 8px', fontSize: 14,
          background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)',
          fontFamily: 'JetBrains Mono, monospace',
        }}
        aria-label={`${label} dimension`}
      />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center cursor-pointer" style={{ gap: 8 }}>
      <input
        type="checkbox" className="custom-check"
        checked={checked} onChange={(e) => onChange(e.target.checked)}
      />
      <span style={{ fontSize: 13 }}>{label}</span>
    </label>
  );
}

function DebouncedSlider({ value, onChange, ariaLabel, ...props }: {
  min: number; max: number; step: number; value: number;
  onChange: (v: number) => void; ariaLabel?: string;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 100);
  }, [onChange]);

  return (
    <input
      type="range" defaultValue={value} key={value}
      onChange={handleChange}
      min={props.min} max={props.max} step={props.step}
      className="w-full custom-slider"
      aria-label={ariaLabel}
    />
  );
}
