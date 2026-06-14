import ClayCard from './ui/ClayCard';

function Tank({ children, uv }) {
  return (
    <div className={`relative mx-auto grid place-items-center overflow-hidden rounded-[18px] ${uv ? 'purify-uv' : 'clay-raised-sm'}`}
         style={{ width: 84, height: 104, background: uv ? 'linear-gradient(145deg,#ede9fe,#ddd6fe)' : 'linear-gradient(145deg,#eaf6ff,#d3ecfb)' }}>
      <div className="purify-fill" style={uv ? { background: 'linear-gradient(#c4b5fd,#8b5cf6)', opacity: 0.3 } : undefined} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

const Pipe = () => <div className="purify-pipe relative hidden sm:block self-start mt-12 h-3.5 w-8 overflow-hidden rounded-lg" style={{ background: '#d3ecfb', boxShadow: 'inset 2px 2px 4px #bcd7e8' }} />;

const Stage = ({ step, label, uv, children }) => (
  <div className="text-center" style={{ flex: 1, minWidth: 110 }}>
    <div className="mb-3"><Tank uv={uv}>{children}</Tank></div>
    <div className="text-[11px] font-extrabold tracking-wide" style={{ color: uv ? '#a78bfa' : '#7dd3fc' }}>STEP {step}</div>
    <div className="font-display font-semibold text-sm" style={{ color: uv ? '#7c3aed' : '#0369a1' }}>{label}</div>
  </div>
);

export default function PurifyProcess() {
  return (
    <section className="max-w-5xl mx-auto px-4 py-14">
      <h2 className="text-center text-3xl font-bold text-clay-ink mb-1">How We Purify Your Water</h2>
      <p className="text-center text-clay-muted font-semibold mb-7">Every drop passes through 5 stages before it reaches your door</p>
      <ClayCard className="p-8">
        <div className="flex flex-wrap items-end justify-center sm:justify-between gap-5">
          <Stage step="1" label="Source Water">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="#bae6fd" stroke="#0284c7" strokeWidth="2"><path d="M12 3C12 3 6 9 6 13.5a6 6 0 0 0 12 0C18 9 12 3 12 3z" /></svg>
          </Stage>
          <Pipe />
          <Stage step="2" label="Sediment Filter">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="#bae6fd" stroke="#0284c7" strokeWidth="2"><rect x="6" y="3" width="12" height="18" rx="3" /><path d="M6 9h12M6 14h12" strokeDasharray="2 2" /></svg>
          </Stage>
          <Pipe />
          <Stage step="3" label="Carbon Filter">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="#bae6fd" stroke="#0284c7" strokeWidth="2"><circle cx="12" cy="12" r="8" /><circle cx="9" cy="10" r="1.4" fill="#0284c7" /><circle cx="14" cy="13" r="1.4" fill="#0284c7" /><circle cx="11" cy="15" r="1.4" fill="#0284c7" /></svg>
          </Stage>
          <Pipe />
          <Stage step="4" label="UV Sterilizer" uv>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="#ddd6fe" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" /><circle cx="12" cy="12" r="3" /></svg>
          </Stage>
          <Pipe />
          <Stage step="5" label="Pure & Ready">
            <div className="relative" style={{ width: 52, height: 88 }}>
              <div className="absolute left-1/2 -top-1.5 -translate-x-1/2 h-2.5 w-6 rounded bg-clay-skydeep" />
              <div className="absolute inset-0 overflow-hidden rounded-[12px] border-[3px] border-clay-sky bg-clay-surface">
                <div className="purify-bottlefill absolute inset-x-0 bottom-0" style={{ background: 'linear-gradient(#7dd3fc,#0ea5e9)' }} />
                <div className="absolute top-2 left-2 w-2 h-9 rounded bg-white/60 z-10" />
              </div>
            </div>
          </Stage>
        </div>
      </ClayCard>
    </section>
  );
}
