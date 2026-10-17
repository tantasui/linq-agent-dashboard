import { STAGES, type Data, type FollowUp, type Merchant, type Stage } from "./types";

const DAY = 86_400_000;

let n = 0;
const fid = () => `fu_${Date.now().toString(36)}${(n++).toString(36)}`;

export const stageIndex = (s: Stage) => (s === "lost" ? -1 : STAGES.indexOf(s));
export const reached = (m: Merchant, s: Stage) => m.stage !== "lost" && stageIndex(m.stage) >= stageIndex(s);
export const enteredAt = (m: Merchant, s: Stage) => m.history.find((h) => h.stage === s)?.at;

export const volume = (m: Merchant, since = 0) =>
  m.payments.filter((p) => p.at >= since).reduce((a, p) => a + p.amountNgn, 0);
export const lastPaymentAt = (m: Merchant) => m.payments[m.payments.length - 1]?.at;
export const isRepeat = (m: Merchant) => m.payments.length >= 2;
// Retained: transacting for 30+ days and paid within the last 14.
export const isRetained = (m: Merchant, now: number) => {
  const first = m.payments[0]?.at;
  const last = lastPaymentAt(m);
  return !!first && !!last && now - first >= 30 * DAY && now - last <= 14 * DAY;
};
export const isDormant = (m: Merchant, now: number) => {
  const last = lastPaymentAt(m);
  return !!last && now - last > 14 * DAY;
};

/** The follow-up a merchant needs, given where it is stuck. */
export function followUpsFor(m: Merchant, now: number): FollowUp[] {
  const base = { merchantId: m.id, agentId: m.agentId, status: "open" as const };
  const since = m.history[m.history.length - 1]?.at ?? m.createdAt;
  const due = Math.max(since + DAY, now - 2 * DAY);
  if (m.kyb.status === "review" || m.kyb.status === "failed")
    return [{ ...base, id: fid(), trigger: "kyb_review", priority: "high", due }];
  switch (m.stage) {
    case "signed_up":
      return [{ ...base, id: fid(), trigger: "no_bank", priority: "high", due }];
    case "bank_added":
      return [{ ...base, id: fid(), trigger: "not_verified", priority: "high", due }];
    case "verified":
      return [{ ...base, id: fid(), trigger: "no_link", priority: "medium", due }];
    case "link_created":
      return [{ ...base, id: fid(), trigger: "no_payment", priority: "high", due }];
    case "transacting":
      return isDormant(m, now) ? [{ ...base, id: fid(), trigger: "dormant", priority: "medium", due: now }] : [];
    default:
      return [];
  }
}

export interface FunnelRow {
  label: string;
  count: number;
}

export function funnels(data: Data, merchants: Merchant[], now: number) {
  const ids = new Set(merchants.map((m) => m.id));
  const conversations = data.interactions.filter((i) => ids.has(i.merchantId)).length;
  const c = (s: Stage) => merchants.filter((m) => reached(m, s)).length;
  const acquisition: FunnelRow[] = [
    { label: "Conversations", count: conversations },
    { label: "Businesses reached", count: merchants.length },
    { label: "Interested", count: c("interested") },
    { label: "Signed up", count: c("signed_up") },
    { label: "Bank account added", count: c("bank_added") },
    { label: "Verified (KYB)", count: c("verified") },
  ];
  const activation: FunnelRow[] = [
    { label: "Verified", count: c("verified") },
    { label: "Payment link created", count: c("link_created") },
    { label: "First payment", count: c("transacting") },
    { label: "Repeat (2+ payments)", count: merchants.filter(isRepeat).length },
    { label: "Retained (30d+, active)", count: merchants.filter((m) => isRetained(m, now)).length },
  ];
  return { acquisition, activation };
}

export function tally(values: (string | undefined)[]) {
  const map = new Map<string, number>();
  for (const v of values) if (v) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const naira = (v: number, compact = false) => {
  if (compact && v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (compact && v >= 1_000) return `₦${Math.round(v / 1_000)}K`;
  return `₦${v.toLocaleString("en-NG")}`;
};

export function ago(t: number, now = Date.now()) {
  const d = now - t;
  if (d < 0) {
    const f = -d;
    if (f < DAY) return "today";
    if (f < 2 * DAY) return "tomorrow";
    return `in ${Math.round(f / DAY)}d`;
  }
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < DAY) return `${Math.floor(d / 3_600_000)}h ago`;
  if (d < 2 * DAY) return "yesterday";
  return `${Math.floor(d / DAY)}d ago`;
}

export const date = (t: number) =>
  new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

// ---------------------------------------------------------------- board

export type ColumnKey = "talked" | "signed" | "verified" | "link" | "paid" | "regular";

/** Board columns. Colour runs from grey to deep cobalt as a business gets closer to paying. */
export const COLUMNS: { key: ColumnKey; label: string; hint: string; color: string }[] = [
  { key: "talked", label: "Talked", hint: "Visited, not signed up", color: "#c4cad3" },
  { key: "signed", label: "Signed up", hint: "Account made, setting up", color: "#9aa3b0" },
  { key: "verified", label: "Verified", hint: "KYB passed, no pay link", color: "#8fb3f6" },
  { key: "link", label: "Pay link", hint: "Ready, waiting for a payment", color: "#6b9cf5" },
  { key: "paid", label: "First payment", hint: "1–2 payments so far", color: "#407ff2" },
  { key: "regular", label: "Regular", hint: "3+ payments", color: "#1b4fb3" },
];

export const REGULAR_AT = 3;

export function columnOf(m: Merchant): ColumnKey | null {
  switch (m.stage) {
    case "lost":
      return null;
    case "conversation":
    case "interested":
      return "talked";
    case "signed_up":
    case "bank_added":
      return "signed";
    case "verified":
      return "verified";
    case "link_created":
      return "link";
    case "transacting":
      return m.payments.length >= REGULAR_AT ? "regular" : "paid";
  }
}

export const daysInStage = (m: Merchant, now: number) =>
  Math.floor((now - (m.history[m.history.length - 1]?.at ?? m.createdAt)) / DAY);

/** The one thing blocking this business, if anything. */
export function blocker(m: Merchant, now: number): { text: string; tone: "red" | "orange" } | null {
  if (m.kyb.status === "review") return { text: "KYB review", tone: "orange" };
  if (m.kyb.status === "failed") return { text: "KYB failed", tone: "red" };
  if (m.stage === "signed_up") return { text: "No bank yet", tone: "orange" };
  if (m.stage === "bank_added") return { text: "Not verified", tone: "orange" };
  if (isDormant(m, now)) return { text: "Quiet 14d+", tone: "red" };
  const d = daysInStage(m, now);
  if (m.stage !== "transacting" && d >= 7) return { text: `Stuck ${d}d`, tone: "red" };
  return null;
}
