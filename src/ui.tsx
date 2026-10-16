import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { initials, pct } from "./derive";
import { STAGE_LABEL, type Kyb, type Stage } from "./types";

type FunnelRowLike = { label: string; count: number };

export function LinqMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 96.18) / 131.59} viewBox="191 152.67 131.59 96.18" fill="currentColor" aria-hidden>
      <path d="M251.773 157.934L277.89 187.63L266.03 198.138L243.5 172.519C241.636 170.399 238.41 170.198 236.297 172.069L210.774 194.683C208.661 196.556 208.461 199.791 210.325 201.912L232.854 227.531C234.718 229.652 237.944 229.853 240.057 227.982L242.709 225.632L253.178 237.537L246.462 243.488C240.042 249.175 230.246 248.562 224.579 242.119L194.881 208.345C189.214 201.902 189.825 192.068 196.243 186.381L229.89 156.567C236.31 150.88 246.107 151.492 251.773 157.934Z" />
      <path d="M247.564 203.386L270.094 229.005C271.96 231.126 275.184 231.326 277.297 229.455L284.587 222.997L295.056 234.902L283.704 244.959C277.286 250.647 267.487 250.034 261.821 243.592L232.118 209.819C226.452 203.375 227.062 193.542 233.48 187.854L244.832 177.797L255.301 189.702L248.011 196.16C245.898 198.031 245.698 201.269 247.562 203.39L247.564 203.386Z" />
      <path d="M289.01 159.407L318.713 193.18C324.379 199.624 323.769 209.457 317.351 215.145L310.636 221.095L300.167 209.19L302.82 206.841C304.933 204.97 305.133 201.732 303.269 199.611L280.739 173.992C278.873 171.872 275.649 171.671 273.537 173.542L270.883 175.891L260.414 163.986L267.13 158.036C273.547 152.348 283.346 152.961 289.012 159.403L289.01 159.407Z" />
      <path d="M294.195 206.175L318.998 234.376C320.053 235.574 319.683 237.631 318.174 238.968L311.78 244.632C310.271 245.969 308.193 246.083 307.137 244.884L282.335 216.683C281.279 215.485 281.65 213.428 283.158 212.089L289.553 206.425C291.061 205.088 293.14 204.975 294.195 206.175Z" />
    </svg>
  );
}

export function Card({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          <span className="spacer" />
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card stat">
      <div className="k">
        {icon}
        {label}
      </div>
      <div className="v">{value}</div>
      {sub && <div className="s">{sub}</div>}
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  return <span className="avatar">{initials(name)}</span>;
}

export function Who({ name, sub }: { name: string; sub?: ReactNode }) {
  return (
    <div className="who">
      <Avatar name={name} />
      <div>
        <b>{name}</b>
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

const STAGE_TONE: Record<Stage, string> = {
  conversation: "",
  interested: "white",
  signed_up: "orange",
  bank_added: "orange",
  verified: "orange",
  link_created: "orange",
  transacting: "green",
  lost: "red",
};

export function StagePill({ stage }: { stage: Stage }) {
  return <span className={`pill ${STAGE_TONE[stage]}`}>{STAGE_LABEL[stage]}</span>;
}

export function KybPill({ kyb }: { kyb: Kyb }) {
  if (kyb.status === "verified") return <span className="pill green">Tier {kyb.tier} verified</span>;
  if (kyb.status === "review") return <span className="pill orange">Needs review</span>;
  if (kyb.status === "queued") return <span className="pill orange">CAC check queued</span>;
  if (kyb.status === "failed") return <span className="pill red">Failed</span>;
  return <span className="pill">Not verified</span>;
}

export function Bars({ rows, flat = false }: { rows: FunnelRowLike[]; flat?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="bars">
      {rows.map((r, i) => (
        <div className="bar-row" key={r.label}>
          <span className="lbl">{r.label}</span>
          <span className="val">
            {r.count}
            {!flat && i > 0 && <small>{pct(r.count, rows[i - 1].count)}%</small>}
          </span>
          <div className="track">
            <div className={`fill ${flat ? "flat" : ""}`} style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Chips<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="chips">
      {options.map(([v, label]) => (
        <button key={v} className={`chip ${v === value ? "on" : ""}`} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
}

export function Modal({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {sub && <p className="hint">{sub}</p>}
          </div>
          <span className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Drawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer">{children}</aside>
    </>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
