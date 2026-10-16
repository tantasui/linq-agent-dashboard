import { BarChart3, CheckSquare, History, MapPin, NotebookPen, Plus, Search, ShieldCheck, Store, TrendingUp, Users, Wallet } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { ago, date, funnels, isDormant, naira, pct, reached, startOfDay, tally, volume } from "./derive";
import { useOverlay } from "./overlays";
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

// ---------------------------------------------------------------- overview

export function Overview({ go }: { go: (p: Page) => void }) {
  const d = useScope();
  const open = useOverlay();
  const now = Date.now();
  const month = now - 30 * DAY;
  const signed = d.merchants.filter((m) => reached(m, "signed_up"));
  const transacting = d.merchants.filter((m) => reached(m, "transacting"));
  const vol = d.merchants.reduce((s, m) => s + volume(m, month), 0);
  const openFu = d.followUps.filter((f) => f.status === "open").length;
  const review = d.merchants.filter((m) => m.kyb.status === "review").length;
  const { acquisition, activation } = funnels(d, d.merchants, now);

  const leaderboard = d.agents
    .map((a) => {
      const ms = d.merchants.filter((m) => m.agentId === a.id);
      return { a, signed: ms.filter((m) => reached(m, "signed_up")).length, live: ms.filter((m) => reached(m, "transacting")).length, vol: ms.reduce((s, m) => s + volume(m, month), 0) };
    })
    .sort((x, y) => y.live - x.live || y.signed - x.signed);

  const activity = [
    ...d.interactions.slice(0, 40).map((i) => ({ at: i.at, who: d.agents.find((a) => a.id === i.agentId)?.name ?? "", what: `talked to ${d.merchants.find((m) => m.id === i.merchantId)?.businessName}`, id: i.merchantId })),
    ...d.merchants.flatMap((m) => m.payments.slice(-1).map((p) => ({ at: p.at, who: m.businessName, what: `received ${naira(p.amountNgn)} in ${p.token}`, id: m.id }))),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 8);

  return (
    <>
      <div className="grid g4">
        <Stat label="Businesses signed up" value={signed.length} sub={`${d.merchants.length} reached in total`} icon={<Store size={ICON} />} />
        <Stat label="Transacting" value={transacting.length} sub={`${pct(transacting.length, signed.length)}% of sign-ups`} icon={<TrendingUp size={ICON} />} />
        <Stat label="Volume, last 30 days" value={naira(vol, true)} sub={naira(vol)} icon={<Wallet size={ICON} />} />
        <Stat label="Open follow-ups" value={openFu} sub={review ? (review > 1 ? `${review} verifications need review` : "1 verification needs review") : "Nothing waiting on you"} icon={<CheckSquare size={ICON} />} />
      </div>
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
            {leaderboard.map(({ a, signed, live, vol }) => (
              <button key={a.id} className="li" style={{ background: "none", border: 0, borderTop: "1px solid var(--line)", textAlign: "left", alignItems: "center" }} onClick={() => open({ kind: "agent", id: a.id })}>
                <div className="body"><Who name={a.name} sub={`${signed} signed up · ${live} transacting`} /></div>
                <span className="meta">{naira(vol, true)}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card title="Latest activity">
          <div className="list">
            {activity.map((e, i) => (
              <button key={i} className="li" style={{ background: "none", border: 0, borderTop: "1px solid var(--line)", textAlign: "left" }} onClick={() => open({ kind: "merchant", id: e.id })}>
                <div className="body"><b style={{ fontWeight: 500 }}>{e.who}</b> <span style={{ color: "var(--muted)" }}>{e.what}</span></div>
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
    return { a, total: ms.length, signed: ms.filter((m) => reached(m, "signed_up")).length, live: ms.filter((m) => reached(m, "transacting")).length, vol: ms.reduce((s, m) => s + volume(m, now - 30 * DAY), 0) };
  });
  return (
    <>
      <div className="grid g4">
        <Stat label="Agents" value={data.agents.length} sub={`${data.agents.filter((a) => a.status === "active").length} active`} icon={<Users size={ICON} />} />
        <Stat label="Businesses signed up" value={rows.reduce((s, r) => s + r.signed, 0)} sub="Across all agents" />
        <Stat label="Transacting" value={rows.reduce((s, r) => s + r.live, 0)} />
        <Stat label="Agent earnings" value="—" sub="Coming once commission is agreed" icon={<Wallet size={ICON} />} />
      </div>
      <Card title="Your agents" action={<button className="btn primary small" onClick={() => open({ kind: "addAgent" })}><Plus size={14} /> Add agent</button>}>
        <table className="table only-wide">
          <thead>
            <tr><th>Agent</th><th>Code</th><th>Territory</th><th>Status</th><th className="num">Reached</th><th className="num">Signed up</th><th className="num">Transacting</th><th className="num">Volume 30d</th></tr>
          </thead>
          <tbody>
            {rows.map(({ a, total, signed, live, vol }) => (
              <tr key={a.id} className="click" onClick={() => open({ kind: "agent", id: a.id })}>
                <td><Who name={a.name} sub={a.email} /></td>
                <td>{a.code}</td>
                <td>{a.area}</td>
                <td><span className={`pill ${a.status === "active" ? "green" : ""}`}>{a.status === "active" ? "Active" : "Paused"}</span></td>
                <td className="num">{total}</td>
                <td className="num">{signed}</td>
                <td className="num">{live}</td>
                <td className="num">{naira(vol, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="list only-phone">
          {rows.map(({ a, signed, live, vol }) => (
            <button key={a.id} className="li" style={{ background: "none", border: 0, borderTop: "1px solid var(--line)", textAlign: "left", width: "100%", alignItems: "center" }} onClick={() => open({ kind: "agent", id: a.id })}>
              <div className="body"><Who name={a.name} sub={`${a.code} · ${signed} signed · ${live} live · ${naira(vol, true)}`} /></div>
              <span className={`pill ${a.status === "active" ? "green" : ""}`}>{a.status === "active" ? "Active" : "Paused"}</span>
            </button>
          ))}
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- merchants

export function Merchants() {
  const d = useScope();
  const { mode } = useStore();
  const open = useOverlay();
  const now = Date.now();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<Stage | "all" | "dormant">("all");
  const [agent, setAgent] = useState("all");
  const list = d.merchants
    .filter((m) => (stage === "all" ? true : stage === "dormant" ? isDormant(m, now) : m.stage === stage))
    .filter((m) => agent === "all" || m.agentId === agent)
    .filter((m) => !q || `${m.businessName} ${m.ownerName} ${m.area} ${m.category}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.history.at(-1)?.at ?? 0) - (a.history.at(-1)?.at ?? 0));
  const agentName = (id: string) => d.agents.find((a) => a.id === id)?.name ?? "";

  return (
    <Card
      title={`${list.length} business${list.length === 1 ? "" : "es"}`}
      action={<button className="btn primary small" onClick={() => open({ kind: "interaction" })}><Plus size={14} /> New interaction</button>}
    >
      <div className="col" style={{ marginBottom: 14 }}>
        <div className="row">
          <div className="row search" style={{ position: "relative", flex: "1 1 220px", gap: 0 }}>
            <Search size={15} style={{ position: "absolute", left: 12, color: "var(--subtle)" }} />
            <input className="input" style={{ paddingLeft: 34 }} placeholder="Search business, owner, market" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {mode === "master" && (
            <select className="select" style={{ width: "auto", flex: "0 1 200px" }} value={agent} onChange={(e) => setAgent(e.target.value)}>
              <option value="all">All agents</option>
              {d.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </div>
        <Chips value={stage} options={[["all", "All"], ...STAGES.map((s) => [s, STAGE_LABEL[s]] as [Stage, string]), ["dormant", "Dormant"], ["lost", "Lost"]]} onChange={setStage} />
      </div>
      {list.length === 0 && <Empty>No businesses match.</Empty>}
      <table className="table only-wide">
        <thead>
          <tr><th>Business</th><th>Stage</th><th>Verification</th>{mode === "master" && <th>Agent</th>}<th>Market</th><th className="num">Volume</th><th className="num">Updated</th></tr>
        </thead>
        <tbody>
          {list.map((m) => (
            <tr key={m.id} className="click" onClick={() => open({ kind: "merchant", id: m.id })}>
              <td><Who name={m.businessName} sub={`${m.ownerName} · ${m.category}`} /></td>
              <td><StagePill stage={m.stage} /></td>
              <td><KybPill kyb={m.kyb} /></td>
              {mode === "master" && <td>{agentName(m.agentId)}</td>}
              <td>{m.area}</td>
              <td className="num">{m.payments.length ? naira(volume(m), true) : "—"}</td>
              <td className="num tiny">{ago(m.history.at(-1)!.at, now)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="list only-phone">
        {list.map((m) => <MerchantRow key={m.id} m={m} sub={`${m.area}${mode === "master" ? ` · ${agentName(m.agentId)}` : ""}`} />)}
      </div>
    </Card>
  );
}

function MerchantRow({ m, sub, right }: { m: Merchant; sub: string; right?: ReactNode }) {
  const open = useOverlay();
  return (
    <button className="li" style={{ background: "none", border: 0, borderTop: "1px solid var(--line)", textAlign: "left", width: "100%", alignItems: "center" }} onClick={() => open({ kind: "merchant", id: m.id })}>
      <div className="body"><Who name={m.businessName} sub={sub} /></div>
      {right ?? <StagePill stage={m.stage} />}
    </button>
  );
}

// ---------------------------------------------------------------- verification

export function Verification() {
  const { data, dispatch, toast } = useStore();
  const open = useOverlay();
  const [tab, setTab] = useState<"review" | "pending" | "verified" | "all">("review");
  const list = data.merchants.filter((m) => {
    if (tab === "review") return m.kyb.status === "review" || m.kyb.status === "queued" || m.kyb.status === "failed";
    if (tab === "pending") return m.stage === "bank_added" && m.kyb.status === "none";
    if (tab === "verified") return m.kyb.status === "verified";
    return reached(m, "signed_up");
  });
  const agentName = (id: string) => data.agents.find((a) => a.id === id)?.name ?? "";
  const counts = {
    review: data.merchants.filter((m) => ["review", "queued", "failed"].includes(m.kyb.status)).length,
    t1: data.merchants.filter((m) => m.kyb.status === "verified" && m.kyb.tier === 1).length,
    t2: data.merchants.filter((m) => m.kyb.tier === 2).length,
  };

  return (
    <>
      <div className="grid g3">
        <Stat label="Waiting on you" value={counts.review} sub="Name mismatches, failed or queued checks" icon={<ShieldCheck size={ICON} />} />
        <Stat label="Tier 1 verified" value={counts.t1} sub="Owner NIN + bank name · payout cap applies" />
        <Stat label="Tier 2 verified" value={counts.t2} sub="CAC registered · limits lifted" />
      </div>
      <Card title="Business verification (KYB)">
        <p className="hint" style={{ marginBottom: 14 }}>
          Agents run Tier 1 on the spot. Anything that doesn't pass cleanly lands here for you to approve or reject, so a merchant is never left waiting on Linq.
        </p>
        <div style={{ marginBottom: 14 }}>
          <Chips value={tab} options={[["review", `Needs review (${counts.review})`], ["pending", "Not started"], ["verified", "Verified"], ["all", "All"]]} onChange={setTab} />
        </div>
        {list.length === 0 && <Empty>Nothing here.</Empty>}
        <div className="list">
          {list.map((m) => (
            <div className="li" key={m.id} style={{ alignItems: "center", flexWrap: "wrap" }}>
              <div className="body" style={{ flex: "1 1 240px" }}>
                <button style={{ background: "none", border: 0, padding: 0, textAlign: "left" }} onClick={() => open({ kind: "merchant", id: m.id })}>
                  <Who name={m.businessName} sub={`${m.ownerName} · by ${agentName(m.agentId)}`} />
                </button>
                {m.kyb.note && <p style={{ marginTop: 6 }}>{m.kyb.note}{m.kyb.resolvedName ? ` — bank says ${m.kyb.resolvedName}` : ""}</p>}
              </div>
              <KybPill kyb={m.kyb} />
              <div className="row">
                {m.kyb.status === "review" && (
                  <>
                    <button className="btn small primary" onClick={() => { dispatch({ type: "setKyb", id: m.id, kyb: { ...m.kyb, tier: 1, status: "verified", note: undefined, nameMatch: true }, stage: reached(m, "verified") ? m.stage : "verified" }); toast(`${m.businessName} approved — Tier 1`); }}>Approve</button>
                    <button className="btn small" onClick={() => { dispatch({ type: "setKyb", id: m.id, kyb: { ...m.kyb, status: "failed", note: "Rejected by master — ask for an account in the owner's name" } }); toast("Rejected. The agent gets a follow-up."); }}>Reject</button>
                  </>
                )}
                {m.kyb.status === "queued" && (
                  <button className="btn small" onClick={() => { dispatch({ type: "setKyb", id: m.id, kyb: { ...m.kyb, tier: 2, status: "verified", legalName: m.businessName.toUpperCase() } }); toast("CAC registry back — Tier 2 verified"); }}>Retry CAC check</button>
                )}
                {(m.kyb.status === "none" || m.kyb.status === "failed") && reached(m, "signed_up") && <button className="btn small" onClick={() => open({ kind: "verify", id: m.id })}>Verify now</button>}
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
      <div className="grid g2">
        <Card title="Acquisition"><Bars rows={acquisition} /></Card>
        <Card title="Activation & retention"><Bars rows={activation} /></Card>
      </div>
      <div className="grid g3">
        <Card title="Top objections">{objections.length ? <Bars flat rows={toRows(objections)} /> : <Empty>None logged.</Empty>}</Card>
        <Card title="What they use today">{competitors.length ? <Bars flat rows={toRows(competitors)} /> : <Empty>None logged.</Empty>}</Card>
        <Card title="Transacting by market">{byArea.length ? <Bars flat rows={toRows(byArea)} /> : <Empty>No one transacting yet.</Empty>}</Card>
      </div>
      <p className="tiny">Percentages compare each step with the one above it. Businesses are counted by when they were first reached.</p>
    </>
  );
}

// ---------------------------------------------------------------- follow-ups

export function FollowUps() {
  const d = useScope();
  const { mode } = useStore();
  const open = useOverlay();
  const now = Date.now();
  const [tab, setTab] = useState<"open" | "done" | "all">("open");
  const list = d.followUps
    .filter((f) => tab === "all" || f.status === tab)
    .sort((a, b) => (a.status === b.status ? (a.status === "open" ? prio(a) - prio(b) || a.due - b.due : (b.closedAt ?? 0) - (a.closedAt ?? 0)) : a.status === "open" ? -1 : 1));
  const m = (id: string) => d.merchants.find((x) => x.id === id);
  const agentName = (id: string) => d.agents.find((a) => a.id === id)?.name ?? "";
  const perAgent = d.agents.filter((a) => d.followUps.some((f) => f.agentId === a.id)).map((a) => ({ a, n: d.followUps.filter((f) => f.agentId === a.id && f.status === "open").length }));

  return (
    <>
      {mode === "master" && (
        <Card title="Open by agent">
          <div className="row">
            {perAgent.map(({ a, n }) => <span key={a.id} className={`pill plain ${n ? "white" : ""}`}>{a.name} · <b>{n}</b></span>)}
          </div>
        </Card>
      )}
      <Card title="Follow-up queue" action={<Chips value={tab} options={[["open", "Open"], ["done", "Done"], ["all", "All"]]} onChange={setTab} />}>
        <p className="hint" style={{ marginBottom: 12 }}>Created automatically when a business gets stuck, plus any call-backs agents book.</p>
        {list.length === 0 && <Empty>Queue is clear.</Empty>}
        <div className="list">
          {list.map((f) => {
            const mm = m(f.merchantId);
            if (!mm) return null;
            const overdue = f.status === "open" && f.due < startOfDay(now);
            return (
              <div className="li" key={f.id} style={{ alignItems: "center", flexWrap: "wrap" }}>
                <span className={`pill ${f.priority === "high" ? "red" : f.priority === "medium" ? "orange" : ""}`} style={{ minWidth: 74 }}>{f.priority[0].toUpperCase() + f.priority.slice(1)}</span>
                <div className="body" style={{ flex: "1 1 220px" }}>
                  <button style={{ background: "none", border: 0, padding: 0, textAlign: "left" }} onClick={() => open({ kind: "merchant", id: mm.id })}>
                    <b style={{ fontWeight: 500 }}>{mm.businessName}</b>
                  </button>
                  <p>{TRIGGER_LABEL[f.trigger]}{mode === "master" ? ` · ${agentName(f.agentId)}` : ""}{f.outcome ? ` · ${f.outcome}` : ""}</p>
                </div>
                <span className="meta" style={{ color: overdue ? "var(--red)" : undefined }}>
                  {f.status === "open" ? (overdue ? `Overdue · ${date(f.due)}` : `Due ${date(f.due)}`) : `Closed ${ago(f.closedAt ?? now, now)}`}
                </span>
                {f.status === "open" && <button className="btn small" onClick={() => open({ kind: "closeFollowUp", id: f.id })}>Work it</button>}
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

const prio = (f: FollowUp) => ({ high: 0, medium: 1, low: 2 })[f.priority];

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
        <p className="hint" style={{ marginBottom: 12 }}>What agents see on the ground. Merchants' exact words are kept apart from the agent's interpretation.</p>
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
            <p>{n.observation}</p>
            {n.quote && <q>{n.quote}</q>}
            {n.hypothesis && <div className="hyp">Agent's take: {n.hypothesis}</div>}
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
        return { area, agents: data.agents.filter((a) => a.area === area), reached: ms.length, live: ms.filter((m) => reached(m, "transacting")).length, vol: ms.reduce((s, m) => s + volume(m, now - 30 * DAY), 0) };
      })
      .sort((a, b) => b.reached - a.reached);
  }, [data, now]);
  return (
    <div className="grid g3">
      {areas.map((t) => (
        <Card key={t.area} title={<span className="row" style={{ gap: 8 }}><MapPin size={15} /> {t.area}</span>}>
          <div className="grid g3" style={{ gap: 8, marginBottom: 14 }}>
            <div className="stat"><span className="k">Reached</span><span className="v" style={{ fontSize: 22 }}>{t.reached}</span></div>
            <div className="stat"><span className="k">Live</span><span className="v" style={{ fontSize: 22 }}>{t.live}</span></div>
            <div className="stat"><span className="k">30d vol</span><span className="v" style={{ fontSize: 22 }}>{naira(t.vol, true)}</span></div>
          </div>
          {t.agents.length ? (
            <div className="row">
              {t.agents.map((a) => <button key={a.id} className="pill white plain" style={{ background: "none" }} onClick={() => open({ kind: "agent", id: a.id })}>{a.name}</button>)}
            </div>
          ) : (
            <span className="pill orange">No agent assigned</span>
          )}
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
  const me = data.agents.find((a) => a.id === actingAgentId);
  const convToday = d.interactions.filter((i) => i.at >= today).length;
  const activatedToday = d.merchants.filter((m) => m.payments[0] && m.payments[0].at >= today).length;
  const dueFus = d.followUps.filter((f) => f.status === "open" && f.due < today + DAY);
  const signed = d.merchants.filter((m) => reached(m, "signed_up")).length;
  const live = d.merchants.filter((m) => reached(m, "transacting")).length;

  return (
    <>
      <div className="row between">
        <div>
          <p className="hint">Welcome back</p>
          <h2 style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 600 }}>{me?.name}</h2>
        </div>
        <span className="pill white plain">Your code: {me?.code}</span>
      </div>
      <div className="grid g2" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <Stat label="Conversations today" value={convToday} />
        <Stat label="Activated today" value={<span style={{ color: "var(--green)" }}>{activatedToday}</span>} />
      </div>
      <button className="hero" onClick={() => open({ kind: "interaction" })}>
        <span className="ic"><Plus size={20} /></span>
        <div><b>New interaction</b><span>Log a field conversation</span></div>
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
        <p className="hint" style={{ marginBottom: 14 }}>
          Everything here is sample data saved in this browser only. Nobody else sees your changes. Reset to start over.
        </p>
        <button className="btn" onClick={() => { if (confirm("Reset all demo data?")) { dispatch({ type: "reset" }); toast("Demo data reset"); } }}>Reset demo data</button>
      </Card>
      <Card title="Coming later">
        <ul className="hint" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Agent earnings and payouts (commission model being agreed)</li>
          <li>Live data from Linq B2B: sign-ups, verification and payments update on their own</li>
          <li>Real Smile ID checks for NIN and CAC</li>
          <li>Agent logins, and invites by email</li>
        </ul>
      </Card>
    </div>
  );
}
