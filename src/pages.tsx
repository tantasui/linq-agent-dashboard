import {
  ArrowRight,
  BarChart3,
  CheckSquare,
  Columns3,
  History,
  List,
  MapPin,
  NotebookPen,
  Phone,
  Plus,
  Quote,
  Search,
  ShieldCheck,
  Store,
  TrendingUp,
  TriangleAlert,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  COLUMNS,
  ago,
  blocker,
  columnOf,
  date,
  daysInStage,
  enteredAt,
  funnels,
  initials,
  isDormant,
  naira,
  pct,
  reached,
  startOfDay,
  tally,
  volume,
  type ColumnKey,
} from "./derive";
import { nextStep, useOverlay } from "./overlays";
import { DAY } from "./seed";
import { useScope, useStore } from "./store";
import { NOTE_LABEL, STAGES, STAGE_LABEL, TRIGGER_LABEL, type FollowUp, type Merchant, type NoteCategory, type Stage } from "./types";
import { Bars, Card, Chips, Empty, KybPill, Stat, StagePill, Who } from "./ui";

export type Page =
  | "overview"
  | "agents"
  | "merchants"
  | "verification"
  | "funnel"
  | "followups"
  | "intel"
  | "territory"
  | "settings"
  | "workspace"
  | "history";

const ICON = 15;

function useWide(min = 1100) {
  const q = `(min-width: ${min}px)`;
  const [wide, setWide] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = () => setWide(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [q]);
  return wide;
}

function MerchantRow({ m, sub, right }: { m: Merchant; sub: string; right?: ReactNode }) {
  const open = useOverlay();
  return (
    <button className="li li-btn" onClick={() => open({ kind: "merchant", id: m.id })}>
      <div className="body"><Who name={m.businessName} sub={sub} /></div>
      {right ?? <StagePill stage={m.stage} />}
    </button>
  );
}

/** Spread of an agent's businesses across the board columns. */
function Spread({ ms }: { ms: Merchant[] }) {
  return (
    <div className="spread" aria-label="Businesses by stage">
      {COLUMNS.map((c) => {
        const n = ms.filter((m) => columnOf(m) === c.key).length;
        return n ? <i key={c.key} style={{ flex: n, background: c.color }} title={`${c.label}: ${n}`} /> : null;
      })}
      {ms.length === 0 && <i style={{ flex: 1, background: "var(--surface-3)" }} />}
    </div>
  );
}

/** The column holding the most blocked businesses, with the first few of them. */
function Leak({ ms, now }: { ms: Merchant[]; now: number }) {
  const open = useOverlay();
  const leak = COLUMNS.map((c) => ({ c, stuck: ms.filter((m) => columnOf(m) === c.key && blocker(m, now)) })).sort((a, b) => b.stuck.length - a.stuck.length)[0];
  if (!leak || leak.stuck.length === 0) return null;
  return (
    <section className="leak">
      <div className="leak-head">
        <TriangleAlert size={18} />
        <div>
          <b>Biggest leak: {leak.stuck.length} stuck in {leak.c.label}</b>
          <span>{leak.c.hint}. These need a nudge first.</span>
        </div>
      </div>
      <div className="leak-list">
        {leak.stuck.slice(0, 4).map((m) => (
          <button key={m.id} onClick={() => open({ kind: "merchant", id: m.id })}>
            <b>{m.businessName}</b>
            <span>{blocker(m, now)?.text}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- overview

export function Overview({ go }: { go: (p: Page) => void }) {
  const d = useScope();
  const open = useOverlay();
  const now = Date.now();
  const month = now - 30 * DAY;
  const week = now - 7 * DAY;
  const signed = d.merchants.filter((m) => reached(m, "signed_up"));
  const transacting = d.merchants.filter((m) => reached(m, "transacting"));
  const vol = d.merchants.reduce((s, m) => s + volume(m, month), 0);
  const openFu = d.followUps.filter((f) => f.status === "open").length;
  const review = d.merchants.filter((m) => m.kyb.status === "review").length;
  const { acquisition, activation } = funnels(d, d.merchants, now);

  const leaderboard = d.agents
    .map((a) => {
      const ms = d.merchants.filter((m) => m.agentId === a.id);
      return { a, ms, signed: ms.filter((m) => reached(m, "signed_up")).length, live: ms.filter((m) => reached(m, "transacting")).length, vol: ms.reduce((s, m) => s + volume(m, month), 0) };
    })
    .sort((x, y) => y.live - x.live || y.signed - x.signed);

  const activity = [
    ...d.interactions.slice(0, 40).map((i) => ({ at: i.at, who: d.agents.find((a) => a.id === i.agentId)?.name ?? "", what: `talked to ${d.merchants.find((m) => m.id === i.merchantId)?.businessName}`, id: i.merchantId })),
    ...d.merchants.flatMap((m) => m.payments.slice(-1).map((p) => ({ at: p.at, who: m.businessName, what: `received ${naira(p.amountNgn)} in ${p.token}`, id: m.id }))),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 7);

  return (
    <>
      <div className="grid g4">
        <Stat label="Businesses signed up" value={signed.length} sub={`+${d.merchants.filter((m) => (enteredAt(m, "signed_up") ?? 0) >= week).length} this week`} icon={<Store size={ICON} />} />
        <Stat label="Transacting" value={transacting.length} sub={`${pct(transacting.length, signed.length)}% of sign-ups`} icon={<TrendingUp size={ICON} />} />
        <Stat label="Volume, last 30 days" value={naira(vol, true)} sub={naira(vol)} icon={<Wallet size={ICON} />} />
        <Stat label="Open follow-ups" value={openFu} sub={review ? (review > 1 ? `${review} KYC checks need you` : "1 KYC check needs you") : "No checks waiting"} icon={<CheckSquare size={ICON} />} />
      </div>
      <Leak ms={d.merchants} now={now} />
      <div className="grid g2">
        <Card title="Acquisition" action={<button className="btn small ghost" onClick={() => go("funnel")}>Full funnel</button>}>
          <Bars rows={acquisition.slice(1)} />
        </Card>
        <Card title="Activation">
          <Bars rows={activation} />
        </Card>
      </div>
      <div className="grid g2">
        <Card title="Agents" action={<button className="btn small ghost" onClick={() => go("agents")}>All agents</button>}>
          <div className="list">
            {leaderboard.map(({ a, ms, signed, live, vol }) => (
              <button key={a.id} className="li li-btn" onClick={() => open({ kind: "agent", id: a.id })}>
                <div className="body">
                  <Who name={a.name} sub={`${signed} signed up · ${live} transacting`} />
                  <Spread ms={ms.filter((m) => m.stage !== "lost")} />
                </div>
                <span className="meta">{naira(vol, true)}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card title="Latest activity">
          <div className="list">
            {activity.map((e, i) => (
              <button key={i} className="li li-btn" onClick={() => open({ kind: "merchant", id: e.id })}>
                <div className="body"><b style={{ fontWeight: 500 }}>{e.who}</b> <span className="muted">{e.what}</span></div>
                <span className="meta">{ago(e.at, now)}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- agents

export function Agents() {
  const { data } = useStore();
  const open = useOverlay();
  const now = Date.now();
  const rows = data.agents.map((a) => {
    const ms = data.merchants.filter((m) => m.agentId === a.id);
    const last = data.interactions.filter((i) => i.agentId === a.id).reduce((t, i) => Math.max(t, i.at), 0);
    return { a, ms, signed: ms.filter((m) => reached(m, "signed_up")).length, live: ms.filter((m) => reached(m, "transacting")).length, vol: ms.reduce((s, m) => s + volume(m, now - 30 * DAY), 0), last };
  });
  return (
    <>
      <div className="grid g4">
        <Stat label="Agents" value={data.agents.length} sub={`${data.agents.filter((a) => a.status === "active").length} active`} icon={<Users size={ICON} />} />
        <Stat label="Businesses signed up" value={rows.reduce((s, r) => s + r.signed, 0)} sub="Across all agents" />
        <Stat label="Transacting" value={rows.reduce((s, r) => s + r.live, 0)} sub="Received at least one payment" />
        <Stat label="Agent earnings" value="—" sub="Coming once commission is agreed" icon={<Wallet size={ICON} />} />
      </div>
      <Card title="Your agents" action={<button className="btn primary small" onClick={() => open({ kind: "addAgent" })}><Plus size={14} /> Add agent</button>}>
        <table className="table only-wide">
          <thead>
            <tr><th>Agent</th><th>Code</th><th>Status</th><th style={{ width: "22%" }}>Pipeline</th><th className="num">Signed up</th><th className="num">Transacting</th><th className="num">Volume 30d</th><th className="num">Last visit</th></tr>
          </thead>
          <tbody>
            {rows.map(({ a, ms, signed, live, vol, last }) => (
              <tr key={a.id} className="click" onClick={() => open({ kind: "agent", id: a.id })}>
                <td><Who name={a.name} sub={a.area} /></td>
                <td><span className="code">{a.code}</span></td>
                <td><span className={`pill ${a.status === "active" ? "green" : ""}`}>{a.status === "active" ? "Active" : "Paused"}</span></td>
                <td><Spread ms={ms.filter((m) => m.stage !== "lost")} /></td>
                <td className="num">{signed}</td>
                <td className="num">{live}</td>
                <td className="num">{naira(vol, true)}</td>
                <td className="num tiny">{last ? ago(last, now) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="list only-phone">
          {rows.map(({ a, ms, signed, live, vol }) => (
            <button key={a.id} className="li li-btn" onClick={() => open({ kind: "agent", id: a.id })}>
              <div className="body">
                <Who name={a.name} sub={`${a.code} · ${signed} signed · ${live} live · ${naira(vol, true)}`} />
                <Spread ms={ms.filter((m) => m.stage !== "lost")} />
              </div>
              <span className={`pill ${a.status === "active" ? "green" : ""}`}>{a.status === "active" ? "Active" : "Paused"}</span>
            </button>
          ))}
        </div>
        <div className="legend">
          {COLUMNS.map((c) => <span key={c.key}><i style={{ background: c.color }} />{c.label}</span>)}
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- merchants

function BoardCard({ m, now }: { m: Merchant; now: number }) {
  const { data, dispatch, mode, toast } = useStore();
  const open = useOverlay();
  const step = nextStep(m);
  const block = blocker(m, now);
  const col = columnOf(m);
  const paying = col === "paid" || col === "regular";
  return (
    <article className="bcard" onClick={() => open({ kind: "merchant", id: m.id })}>
      <div className="bcard-top">
        <b>{m.businessName}</b>
        {mode === "master" && <span className="av-xs" title={data.agents.find((a) => a.id === m.agentId)?.name}>{initials(data.agents.find((a) => a.id === m.agentId)?.name ?? "?")}</span>}
      </div>
      <span className="bcard-sub">{m.category} · {m.area.split(",")[0]}</span>
      <div className="bcard-foot">
        {block ? <span className={`flag ${block.tone}`}>{block.text}</span> : paying ? <span className="money">{naira(volume(m), true)}</span> : <span className="tiny">{daysInStage(m, now)}d here</span>}
        {step && (
          <button
            className="adv"
            title={step.label}
            aria-label={step.label}
            onClick={(e) => {
              e.stopPropagation();
              if (step.run === "verify") open({ kind: "verify", id: m.id });
              else if (step.run === "payment") open({ kind: "payment", id: m.id });
              else {
                dispatch({ type: "setStage", id: m.id, stage: step.to! });
                toast(`${m.businessName} → ${STAGE_LABEL[step.to!]}`);
              }
            }}
          >
            {step.run === "payment" ? "₦" : <ArrowRight size={14} />}
          </button>
        )}
      </div>
    </article>
  );
}

function Board({ ms }: { ms: Merchant[] }) {
  const wide = useWide();
  const now = Date.now();
  const [focus, setFocus] = useState<ColumnKey>("talked");
  const byCol = (k: ColumnKey) =>
    ms.filter((m) => columnOf(m) === k).sort((a, b) => (blocker(b, now) ? 1 : 0) - (blocker(a, now) ? 1 : 0) || daysInStage(b, now) - daysInStage(a, now));
  if (wide)
    return (
      <div className="board">
        {COLUMNS.map((c) => {
          const items = byCol(c.key);
          return (
            <section className="lane" key={c.key} style={{ ["--lane" as string]: c.color }}>
              <header>
                <div className="lane-t"><i />{c.label}<span>{items.length}</span></div>
                <small>{c.hint}</small>
              </header>
              <div className="lane-body">
                {items.map((m) => <BoardCard key={m.id} m={m} now={now} />)}
                {items.length === 0 && <div className="lane-empty">Nobody here</div>}
              </div>
            </section>
          );
        })}
      </div>
    );
  return (
    <>
      <div className="stage-tabs">
        {COLUMNS.map((c) => (
          <button key={c.key} className={focus === c.key ? "on" : ""} style={{ ["--lane" as string]: c.color }} onClick={() => setFocus(c.key)}>
            <b>{byCol(c.key).length}</b>
            <span><i />{c.label}</span>
          </button>
        ))}
      </div>
      <div className="lane-list">
        {byCol(focus).map((m) => <BoardCard key={m.id} m={m} now={now} />)}
        {byCol(focus).length === 0 && <Empty>Nobody here.</Empty>}
      </div>
    </>
  );
}

export function Merchants() {
  const d = useScope();
  const { mode } = useStore();
  const open = useOverlay();
  const now = Date.now();
  const [view, setView] = useState<"list" | "board">("list");
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<Stage | "all" | "dormant" | "stuck">("all");
  const [agent, setAgent] = useState("all");
  const base = d.merchants
    .filter((m) => agent === "all" || m.agentId === agent)
    .filter((m) => !q || `${m.businessName} ${m.ownerName} ${m.area} ${m.category}`.toLowerCase().includes(q.toLowerCase()));
  const list = base
    .filter((m) => (stage === "all" ? true : stage === "dormant" ? isDormant(m, now) : stage === "stuck" ? !!blocker(m, now) : m.stage === stage))
    .sort((a, b) => (b.history.at(-1)?.at ?? 0) - (a.history.at(-1)?.at ?? 0));
  const agentName = (id: string) => d.agents.find((a) => a.id === id)?.name ?? "";

  return (
    <Card
      title={`${view === "board" ? base.filter((m) => m.stage !== "lost").length : list.length} businesses`}
      action={
        <div className="row">
          <div className="seg" role="tablist" aria-label="View">
            <button className={view === "list" ? "on" : ""} onClick={() => setView("list")}><List size={14} /> List</button>
            <button className={view === "board" ? "on" : ""} onClick={() => setView("board")}><Columns3 size={14} /> Board</button>
          </div>
          <button className="btn primary small" onClick={() => open({ kind: "interaction" })}><Plus size={14} /> New interaction</button>
        </div>
      }
    >
      <div className="col" style={{ marginBottom: 16 }}>
        <div className="row">
          <label className="find">
            <Search size={15} />
            <input placeholder="Search business, owner, market" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {mode === "master" && (
            <select className="select" style={{ width: "auto", flex: "0 1 200px" }} value={agent} onChange={(e) => setAgent(e.target.value)}>
              <option value="all">All agents</option>
              {d.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </div>
        {view === "list" && (
          <Chips
            value={stage}
            options={[["all", "All"], ["stuck", "Needs a nudge"], ...STAGES.map((s) => [s, STAGE_LABEL[s]] as [Stage, string]), ["dormant", "Dormant"], ["lost", "Lost"]]}
            onChange={setStage}
          />
        )}
      </div>
      {view === "board" ? (
        <Board ms={base} />
      ) : (
        <>
          {list.length === 0 && <Empty>No businesses match.</Empty>}
          <table className="table only-wide">
            <thead>
              <tr><th>Business</th><th>Stage</th><th>KYC</th>{mode === "master" && <th>Agent</th>}<th>Market</th><th className="num">Volume</th><th className="num">Updated</th></tr>
            </thead>
            <tbody>
              {list.map((m) => {
                const block = blocker(m, now);
                return (
                  <tr key={m.id} className="click" onClick={() => open({ kind: "merchant", id: m.id })}>
                    <td><Who name={m.businessName} sub={`${m.ownerName} · ${m.category}`} /></td>
                    <td><div className="row" style={{ gap: 6 }}><StagePill stage={m.stage} />{block && <span className={`flag ${block.tone}`}>{block.text}</span>}</div></td>
                    <td><KybPill kyb={m.kyb} /></td>
                    {mode === "master" && <td>{agentName(m.agentId)}</td>}
                    <td>{m.area}</td>
                    <td className="num">{m.payments.length ? naira(volume(m), true) : "—"}</td>
                    <td className="num tiny">{ago(m.history.at(-1)!.at, now)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="list only-phone">
            {list.map((m) => <MerchantRow key={m.id} m={m} sub={`${m.area}${mode === "master" ? ` · ${agentName(m.agentId)}` : ""}`} />)}
          </div>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- KYC checks

export function Verification() {
  const { data, dispatch, toast } = useStore();
  const open = useOverlay();
  const [tab, setTab] = useState<"waiting" | "todo" | "done">("waiting");
  const waiting = data.merchants.filter((m) => ["review", "queued", "failed"].includes(m.kyb.status));
  const todo = data.merchants.filter((m) => m.stage === "bank_added" && m.kyb.status === "none");
  const done = data.merchants.filter((m) => m.kyb.status === "verified");
  const list = tab === "waiting" ? waiting : tab === "todo" ? todo : done;
  const name = (id: string) => data.agents.find((a) => a.id === id)?.name ?? "";

  return (
    <>
      <div className="grid g3">
        <Stat label="Waiting on you" value={waiting.length} sub="Name mismatches, failed or queued checks" icon={<ShieldCheck size={ICON} />} />
        <div className="card tier">
          <span className="tier-n">Tier 1 · {done.filter((m) => m.kyb.tier === 1).length} businesses</span>
          <b>Owner + bank</b>
          <p>Owner's NIN checked with Smile ID; payout account name must match. Done on the spot. Payout cap applies.</p>
        </div>
        <div className="card tier">
          <span className="tier-n">Tier 2 · {done.filter((m) => m.kyb.tier === 2).length} businesses</span>
          <b>CAC registered</b>
          <p>Registration checked with Smile ID; owner must be a director or proprietor. Lifts the cap.</p>
        </div>
      </div>
      <Card title="KYC queue">
        <p className="hint" style={{ marginBottom: 14 }}>Agents run Tier 1 in the field. Anything that doesn't pass cleanly lands here, so a business is never left waiting on Linq.</p>
        <div style={{ marginBottom: 14 }}>
          <Chips value={tab} options={[["waiting", `Needs review · ${waiting.length}`], ["todo", `Not started · ${todo.length}`], ["done", `Verified · ${done.length}`]]} onChange={setTab} />
        </div>
        {list.length === 0 && <Empty>{tab === "waiting" ? "Nothing waiting on you." : "Nothing here."}</Empty>}
        <div className="list">
          {list.map((m) => (
            <div className="li" key={m.id} style={{ alignItems: "center", flexWrap: "wrap" }}>
              <button className="body plain-btn" style={{ flex: "1 1 240px" }} onClick={() => open({ kind: "merchant", id: m.id })}>
                <Who name={m.businessName} sub={`${m.ownerName} · by ${name(m.agentId)}`} />
                {m.kyb.note && <p className="warn-text">{m.kyb.note}{m.kyb.resolvedName ? ` — bank says ${m.kyb.resolvedName}` : ""}</p>}
              </button>
              <KybPill kyb={m.kyb} />
              <div className="row">
                {m.kyb.status === "review" && (
                  <>
                    <button className="btn small primary" onClick={() => { dispatch({ type: "setKyb", id: m.id, kyb: { ...m.kyb, tier: 1, status: "verified", note: undefined, nameMatch: true }, stage: reached(m, "verified") ? m.stage : "verified" }); toast(`${m.businessName} approved — Tier 1`); }}>Approve</button>
                    <button className="btn small" onClick={() => { dispatch({ type: "setKyb", id: m.id, kyb: { ...m.kyb, status: "failed", note: "Rejected — ask for an account in the owner's name" } }); toast("Rejected. The agent gets a follow-up."); }}>Reject</button>
                  </>
                )}
                {m.kyb.status === "queued" && (
                  <button className="btn small" onClick={() => { dispatch({ type: "setKyb", id: m.id, kyb: { ...m.kyb, tier: 2, status: "verified", legalName: m.businessName.toUpperCase() } }); toast("CAC registry back — Tier 2 verified"); }}>Retry CAC check</button>
                )}
                {(m.kyb.status === "none" || m.kyb.status === "failed") && <button className="btn small" onClick={() => open({ kind: "verify", id: m.id })}>Verify now</button>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- funnel

export function Funnel() {
  const d = useScope();
  const { mode } = useStore();
  const now = Date.now();
  const [period, setPeriod] = useState<"7" | "30" | "all">("30");
  const [agent, setAgent] = useState("all");
  const since = period === "all" ? 0 : now - Number(period) * DAY;
  const ms = d.merchants.filter((m) => m.createdAt >= since && (agent === "all" || m.agentId === agent));
  const scoped = { ...d, interactions: d.interactions.filter((i) => i.at >= since) };
  const { acquisition, activation } = funnels(scoped, ms, now);
  const ix = scoped.interactions.filter((i) => ms.some((m) => m.id === i.merchantId));
  const objections = tally(ix.map((i) => i.objection));
  const competitors = tally(ix.map((i) => i.competitor));
  const byArea = tally(ms.filter((m) => reached(m, "transacting")).map((m) => m.area));
  const toRows = (t: [string, number][]) => t.slice(0, 7).map(([label, count]) => ({ label, count }));

  // The step that loses the most people, called out in words.
  const steps = [...acquisition.slice(1), ...activation.slice(1)];
  const drops = steps.slice(1).map((s, i) => ({ from: steps[i].label, to: s.label, lost: steps[i].count - s.count })).filter((x) => x.lost > 0);
  const worst = drops.sort((a, b) => b.lost - a.lost)[0];

  return (
    <>
      <div className="row">
        <Chips value={period} options={[["7", "7 days"], ["30", "30 days"], ["all", "All time"]]} onChange={setPeriod} />
        {mode === "master" && (
          <select className="select" style={{ width: "auto" }} value={agent} onChange={(e) => setAgent(e.target.value)}>
            <option value="all">All agents</option>
            {d.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
      </div>
      {worst && (
        <div className="callout">
          <b>{worst.lost}</b> businesses dropped between <b>{worst.from.toLowerCase()}</b> and <b>{worst.to.toLowerCase()}</b> — the biggest drop in this period.
        </div>
      )}
      <div className="grid g2">
        <Card title="Acquisition"><Bars rows={acquisition} /></Card>
        <Card title="Activation & retention"><Bars rows={activation} /></Card>
      </div>
      <div className="grid g3">
        <Card title="Top objections">{objections.length ? <Bars flat rows={toRows(objections)} /> : <Empty>None logged.</Empty>}</Card>
        <Card title="What they use today">{competitors.length ? <Bars flat rows={toRows(competitors)} /> : <Empty>None logged.</Empty>}</Card>
        <Card title="Transacting by market">{byArea.length ? <Bars flat rows={toRows(byArea)} /> : <Empty>No one transacting yet.</Empty>}</Card>
      </div>
      <p className="tiny">Percentages compare each step with the one above it. Businesses are counted from when they were first visited.</p>
    </>
  );
}

// ---------------------------------------------------------------- follow-ups

export function FollowUps() {
  const d = useScope();
  const { mode } = useStore();
  const open = useOverlay();
  const now = Date.now();
  const today = startOfDay(now);
  const [tab, setTab] = useState<"open" | "done">("open");
  const openFus = d.followUps.filter((f) => f.status === "open");
  const order = (f: FollowUp) => ({ high: 0, medium: 1, low: 2 })[f.priority];
  const groups: [string, FollowUp[]][] = [
    ["Overdue", openFus.filter((f) => f.due < today)],
    ["Today", openFus.filter((f) => f.due >= today && f.due < today + DAY)],
    ["Coming up", openFus.filter((f) => f.due >= today + DAY)],
  ];
  const done = d.followUps.filter((f) => f.status === "done").sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));
  const perAgent = d.agents.map((a) => ({ a, n: openFus.filter((f) => f.agentId === a.id).length })).filter((x) => x.n || x.a.status === "active");

  const row = (f: FollowUp) => {
    const m = d.merchants.find((x) => x.id === f.merchantId);
    if (!m) return null;
    return (
      <div className={`chase ${f.status === "done" ? "done" : f.priority}`} key={f.id}>
        <button className="chase-main" onClick={() => open({ kind: "merchant", id: m.id })}>
          <b>{m.businessName}</b>
          <span>
            {TRIGGER_LABEL[f.trigger]}
            {mode === "master" ? ` · ${d.agents.find((a) => a.id === f.agentId)?.name}` : ""}
            {f.status === "done" ? ` · ${f.outcome} · ${ago(f.closedAt ?? now, now)}` : ` · due ${date(f.due)}`}
          </span>
        </button>
        {f.status === "open" && (
          <>
            {m.phone && <a className="icon-btn" href={`tel:${m.phone.replace(/\s/g, "")}`} aria-label={`Call ${m.ownerName}`}><Phone size={15} /></a>}
            <button className="btn small" onClick={() => open({ kind: "closeFollowUp", id: f.id })}>Work it</button>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {mode === "master" && (
        <div className="grid counts">
          {perAgent.map(({ a, n }) => <Stat key={a.id} label={a.name} value={n} sub="open" />)}
        </div>
      )}
      <Card title="Follow-up queue" action={<Chips value={tab} options={[["open", `Open · ${openFus.length}`], ["done", "Done"]]} onChange={setTab} />}>
        <p className="hint" style={{ marginBottom: 16 }}>Created automatically when a business gets stuck, plus any call-backs agents book.</p>
        {tab === "open" ? (
          <div className="col" style={{ gap: 22 }}>
            {groups.map(([label, list]) =>
              list.length === 0 ? null : (
                <section key={label} className="chase-group">
                  <h3>{label} <span>{list.length}</span></h3>
                  {[...list].sort((a, b) => order(a) - order(b) || a.due - b.due).map(row)}
                </section>
              ),
            )}
            {openFus.length === 0 && <Empty>Queue is clear.</Empty>}
          </div>
        ) : (
          <div className="chase-group">
            {done.slice(0, 40).map(row)}
            {done.length === 0 && <Empty>Nothing closed yet.</Empty>}
          </div>
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- field intel

export function FieldIntel() {
  const { data } = useStore();
  const open = useOverlay();
  const [cat, setCat] = useState<NoteCategory | "all">("all");
  const [area, setArea] = useState("all");
  const areas = [...new Set(data.notes.map((n) => n.area))];
  const list = data.notes.filter((n) => (cat === "all" || n.category === cat) && (area === "all" || n.area === area)).sort((a, b) => b.at - a.at);
  const agentName = (id: string) => data.agents.find((a) => a.id === id)?.name ?? "";
  return (
    <>
      <Card title="Field intelligence" action={<button className="btn primary small" onClick={() => open({ kind: "note" })}><NotebookPen size={14} /> Field note</button>}>
        <p className="hint" style={{ marginBottom: 14 }}>What agents hear on the ground. The merchant's exact words are kept apart from the agent's reading of them.</p>
        <div className="col">
          <Chips value={cat} options={[["all", "All"], ...(Object.entries(NOTE_LABEL) as [NoteCategory, string][])]} onChange={setCat} />
          <select className="select" style={{ width: "auto", alignSelf: "flex-start" }} value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="all">All markets</option>
            {areas.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
      </Card>
      {list.length === 0 && <Empty>No notes yet.</Empty>}
      <div className="grid g3">
        {list.map((n) => (
          <article className="card note" key={n.id}>
            <span className="cat">{NOTE_LABEL[n.category]}</span>
            {n.quote && <blockquote><Quote size={14} />{n.quote}</blockquote>}
            <p>{n.observation}</p>
            {n.hypothesis && <div className="hyp"><b>Agent's take</b> {n.hypothesis}</div>}
            <span className="foot">{agentName(n.agentId)} · {n.area} · {date(n.at)}</span>
          </article>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- territory

export function Territory() {
  const { data } = useStore();
  const open = useOverlay();
  const now = Date.now();
  const areas = useMemo(() => {
    const names = [...new Set([...data.agents.map((a) => a.area), ...data.merchants.map((m) => m.area)])];
    return names
      .map((area) => {
        const ms = data.merchants.filter((m) => m.area === area);
        return { area, ms, agents: data.agents.filter((a) => a.area === area), reached: ms.length, live: ms.filter((m) => reached(m, "transacting")).length, vol: ms.reduce((s, m) => s + volume(m, now - 30 * DAY), 0) };
      })
      .sort((a, b) => b.reached - a.reached);
  }, [data, now]);
  return (
    <div className="grid g3">
      {areas.map((t) => (
        <Card key={t.area} title={<span className="row" style={{ gap: 8 }}><MapPin size={15} /> {t.area}</span>}>
          <div className="grid g3" style={{ gap: 8, marginBottom: 14 }}>
            <div className="mini"><span>Reached</span><b>{t.reached}</b></div>
            <div className="mini"><span>Live</span><b>{t.live}</b></div>
            <div className="mini"><span>30d vol</span><b>{naira(t.vol, true)}</b></div>
          </div>
          <Spread ms={t.ms.filter((m) => m.stage !== "lost")} />
          <div className="row" style={{ marginTop: 14 }}>
            {t.agents.length ? (
              t.agents.map((a) => <button key={a.id} className="pill white plain" onClick={() => open({ kind: "agent", id: a.id })}>{a.name}</button>)
            ) : (
              <span className="pill orange">No agent assigned</span>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- agent home

export function Workspace({ go }: { go: (p: Page) => void }) {
  const d = useScope();
  const { data, actingAgentId } = useStore();
  const open = useOverlay();
  const now = Date.now();
  const today = startOfDay(now);
  const week = now - 7 * DAY;
  const me = data.agents.find((a) => a.id === actingAgentId);
  const convToday = d.interactions.filter((i) => i.at >= today).length;
  const activatedToday = d.merchants.filter((m) => m.payments[0] && m.payments[0].at >= today).length;
  const dueFus = d.followUps.filter((f) => f.status === "open" && f.due < today + DAY);
  const signed = d.merchants.filter((m) => reached(m, "signed_up")).length;
  const live = d.merchants.filter((m) => reached(m, "transacting")).length;
  const weekSignups = d.merchants.filter((m) => (enteredAt(m, "signed_up") ?? 0) >= week).length;
  const weekVisits = d.interactions.filter((i) => i.at >= week).length;

  return (
    <>
      <div className="row between">
        <div>
          <p className="hint">Good to see you</p>
          <h2 className="hello">{me?.name}</h2>
        </div>
        <span className="code">Your code {me?.code}</span>
      </div>
      <div className="grid g4">
        <Stat label="Conversations today" value={convToday} />
        <Stat label="Activated today" value={activatedToday} />
        <Stat label="Visits this week" value={weekVisits} />
        <Stat label="Sign-ups this week" value={weekSignups} />
      </div>
      <button className="hero" onClick={() => open({ kind: "interaction" })}>
        <div>
          <b>New interaction</b>
          <span>Log a conversation while you're still at the shop</span>
        </div>
        <span className="hero-cta"><Plus size={18} /> Log it</span>
      </button>
      <div className="grid g4 tiles">
        <button className="tile" onClick={() => go("followups")}>
          <span className="ic"><CheckSquare size={17} /></span>
          <div><b>Today's follow-ups</b><span>Work the queue</span></div>
          {dueFus.length > 0 && <span className="badge">{dueFus.length}</span>}
        </button>
        <button className="tile" onClick={() => open({ kind: "note" })}>
          <span className="ic"><NotebookPen size={17} /></span>
          <div><b>Field note</b><span>Capture an observation</span></div>
        </button>
        <button className="tile" onClick={() => go("funnel")}>
          <span className="ic"><BarChart3 size={17} /></span>
          <div><b>My stats</b><span>{signed} signed up · {live} transacting</span></div>
        </button>
        <button className="tile" onClick={() => go("history")}>
          <span className="ic"><History size={17} /></span>
          <div><b>My history</b><span>Interactions and closed follow-ups</span></div>
        </button>
      </div>
      <Leak ms={d.merchants} now={now} />
      <Card title="Due today" action={<button className="btn small ghost" onClick={() => go("followups")}>See all</button>}>
        {dueFus.length === 0 && <Empty>Nothing due. Go find new businesses.</Empty>}
        <div className="list">
          {dueFus.slice(0, 5).map((f) => {
            const m = d.merchants.find((x) => x.id === f.merchantId)!;
            return <MerchantRow key={f.id} m={m} sub={TRIGGER_LABEL[f.trigger]} right={<span className={`pill ${f.priority === "high" ? "red" : "orange"}`}>{f.priority}</span>} />;
          })}
        </div>
      </Card>
    </>
  );
}

export function MyHistory() {
  const d = useScope();
  const now = Date.now();
  const items = [
    ...d.interactions.map((i) => ({ at: i.at, id: i.merchantId, text: `${i.channel === "visit" ? "Visited" : i.channel === "call" ? "Called" : "WhatsApp'd"}`, sub: i.quote ? `“${i.quote}”` : i.objection })),
    ...d.followUps.filter((f) => f.status === "done").map((f) => ({ at: f.closedAt ?? now, id: f.merchantId, text: "Closed follow-up", sub: `${TRIGGER_LABEL[f.trigger]} · ${f.outcome}` })),
  ].sort((a, b) => b.at - a.at);
  return (
    <Card title="My history">
      {items.length === 0 && <Empty>Nothing yet.</Empty>}
      <div className="list">
        {items.slice(0, 80).map((e, i) => {
          const m = d.merchants.find((x) => x.id === e.id);
          if (!m) return null;
          return <MerchantRow key={i} m={m} sub={`${e.text} · ${ago(e.at, now)}${e.sub ? ` · ${e.sub}` : ""}`} />;
        })}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- settings

export function Settings() {
  const { dispatch, toast } = useStore();
  return (
    <div className="grid g2">
      <Card title="Demo data">
        <p className="hint" style={{ marginBottom: 14 }}>Everything here is sample data saved in this browser only. Nobody else sees your changes.</p>
        <button className="btn" onClick={() => { if (confirm("Reset all demo data?")) { dispatch({ type: "reset" }); toast("Demo data reset"); } }}>Reset demo data</button>
        <p className="tiny" style={{ marginTop: 16 }}>Build {new Date(__BUILD_TIME__).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>
      </Card>
      <Card title="Not in the demo yet">
        <ul className="hint" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Agent earnings and payouts (commission model being agreed)</li>
          <li>Live data from Linq B2B: sign-ups, verification and payments update on their own</li>
          <li>Real Smile ID checks for NIN and CAC</li>
          <li>Agent logins and email invites</li>
        </ul>
      </Card>
    </div>
  );
}
