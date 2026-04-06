import { useState, useEffect, useCallback, useRef } from 'react';

const ONBOARDING_KEY = 'gridfinity-onboarding-done';

interface Step {
  title: string;
  description: string;
  selector: string;
}

const STEPS: Step[] = [
  {
    title: 'Toolbar: Views & Export',
    description: 'Switch between 2D, Split, and 3D views. Choose render modes (Solid, X-Ray, Blueprint), camera presets (Iso, Front, Top), toggle dimensions and section view. Export your layout as .3mf files ready for Bambu Studio, PrusaSlicer, or Cura.',
    selector: '[data-onboarding="toolbar"]',
  },
  {
    title: 'Choose Your Baseplate',
    description: 'Select a printer preset (Bambu Lab A1, P1S, etc.) or set custom grid dimensions to match your build plate.',
    selector: '[data-onboarding="baseplate"]',
  },
  {
    title: 'Add Bins',
    description: 'Click a bin preset to enter placement mode, then click on the grid to place it. You can also drag presets directly onto the grid.',
    selector: '[data-onboarding="add-bin"]',
  },
  {
    title: 'Configure Bins',
    description: 'Select a placed bin to configure dimensions, dividers, magnets, label shelf, and more. Use Shift+Click to multi-select.',
    selector: '[data-onboarding="bins"]',
  },
];

export default function OnboardingOverlay() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!localStorage.getItem(ONBOARDING_KEY)) {
      setVisible(true);
    }
  }, []);

  const updateTarget = useCallback(() => {
    if (!visible) return;
    const el = document.querySelector(STEPS[step]?.selector);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
    rafRef.current = requestAnimationFrame(updateTarget);
  }, [visible, step]);

  useEffect(() => {
    if (visible) {
      rafRef.current = requestAnimationFrame(updateTarget);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [visible, updateTarget]);

  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      if (e.key === 'ArrowLeft') prev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  function finish() {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  const current = STEPS[step];
  const pad = 8;

  // Tooltip position: prefer right of target, fallback to bottom
  let tooltipStyle: React.CSSProperties = {
    position: 'fixed', zIndex: 10001,
    width: 320, padding: 20, borderRadius: 12,
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  };

  if (targetRect) {
    const rightSpace = window.innerWidth - targetRect.right;
    if (rightSpace > 350) {
      tooltipStyle.left = targetRect.right + 16;
      tooltipStyle.top = Math.max(16, targetRect.top);
    } else {
      tooltipStyle.left = Math.max(16, targetRect.left);
      tooltipStyle.top = targetRect.bottom + 16;
    }
  } else {
    tooltipStyle.left = '50%';
    tooltipStyle.top = '50%';
    tooltipStyle.transform = 'translate(-50%, -50%)';
  }

  return (
    <div className="fixed inset-0" style={{ zIndex: 10000 }}>
      {/* Backdrop with cutout */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <mask id="onboarding-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - pad}
                y={targetRect.top - pad}
                width={targetRect.width + pad * 2}
                height={targetRect.height + pad * 2}
                rx={8}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%" height="100%"
          fill="rgba(0,0,0,0.35)"
          mask="url(#onboarding-mask)"
        />
      </svg>

      {/* Highlight border around target */}
      {targetRect && (
        <div
          className="animate-glow-pulse"
          style={{
            position: 'fixed',
            left: targetRect.left - pad,
            top: targetRect.top - pad,
            width: targetRect.width + pad * 2,
            height: targetRect.height + pad * 2,
            borderRadius: 8,
            border: '2px solid var(--accent)',
            pointerEvents: 'none',
            zIndex: 10001,
          }}
        />
      )}

      {/* Tooltip */}
      <div style={tooltipStyle}>
        {/* Step counter */}
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 8, fontFamily: 'JetBrains Mono, monospace' }}>
          STEP {step + 1} OF {STEPS.length}
        </div>

        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          {current.title}
        </h3>

        <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 20 }}>
          {current.description}
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={finish}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, color: 'var(--text-secondary)', opacity: 0.6,
            }}
          >
            Skip tour
          </button>

          <div className="flex" style={{ gap: 8 }}>
            {step > 0 && (
              <button
                onClick={prev}
                className="rounded transition-colors hover:brightness-125"
                style={{
                  padding: '8px 16px', fontSize: 12,
                  background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)',
                }}
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="rounded font-medium transition-colors hover:brightness-125"
              style={{
                padding: '8px 20px', fontSize: 12,
                background: 'var(--accent)', color: 'var(--bg-primary)',
              }}
            >
              {step === STEPS.length - 1 ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center" style={{ gap: 6, marginTop: 14 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i === step ? 'var(--accent)' : 'var(--border)',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_KEY);
}
