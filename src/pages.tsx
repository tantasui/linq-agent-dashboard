import { ArrowRight, MapPin, Phone, Plus, Quote, Search, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { NOTE_LABEL, STAGE_LABEL, TRIGGER_LABEL, type FollowUp, type Merchant, type NoteCategory } from "./types";
import { Bars, Card, Chips, Empty, KybPill } from "./ui";

export type Page = "pipeline" | "today" | "team" | "notes" | "checks" | "insights" | "settings";

export function useWide(min = 1100) {
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

const agentInitials = (data: { agents: { id: string; name: string }[] }, id: string) =>
  initials(data.agents.find((a) => a.id === id)?.name ?? "?");

// ---------------------------------------------------------------- pipeline

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
        {mode === "master" && <span className="av-xs" title={data.agents.find((a) => a.id === m.agentId)?.name}>{agentInitials(data, m.agentId)}</span>}
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

export function Pipeline() {
  const d = useScope();
  const { mode } = useStore();
  const open = useOverlay();
  const wide = useWide();
  const now = Date.now();
  const [agent, setAgent] = useState("all");
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState<ColumnKey>("talked");
  const [stuckOnly, setStuckOnly] = useState(false);
  const [showLost, setShowLost] = useState(false);

  const ms = d.merchants
    .filter((m) => agent === "all" || m.agentId === agent)
    .filter((m) => !q || `${m.businessName} ${m.ownerName} ${m.area}`.toLowerCase().includes(q.toLowerCase()));
  const byCol = (k: ColumnKey) =>
    ms
      .filter((m) => columnOf(m) === k && (!stuckOnly || blocker(m, now)))
      .sort((a, b) => (blocker(b, now) ? 1 : 0) - (blocker(a, now) ? 1 : 0) || daysInStage(b, now) - daysInStage(a, now));
  const lost = ms.filter((m) => m.stage === "lost");

  // This week, in four numbers.
  const week = now - 7 * DAY;
  const ids = new Set(ms.map((m) => m.id));
  const visits = d.interactions.filter((i) => i.at >= week && ids.has(i.merchantId)).length;
  const signups = ms.filter((m) => (enteredAt(m, "signed_up") ?? 0) >= week).length;
  const firsts = ms.filter((m) => (m.payments[0]?.at ?? 0) >= week).length;
  const vol = ms.reduce((s, m) => s + volume(m, week), 0);

  // Biggest leak: the column holding the most blocked businesses.
  const leak = COLUMNS.map((c) => ({ c, n: ms.filter((m) => columnOf(m) === c.key && blocker(m, now)).length })).sort((a, b) => b.n - a.n)[0];

  return (
    <>
      <div className="pipe-head">
        <div className="ribbon">
          <div><span className="rb-v">{visits}</span><span className="rb-k">visits</span></div>
          <div><span className="rb-v">{signups}</span><span className="rb-k">sign-ups</span></div>
          <div><span className="rb-v">{firsts}</span><span className="rb-k">first payments</span></div>
          <div><span className="rb-v">{naira(vol, true)}</span><span className="rb-k">paid in</span></div>
          <span className="rb-when">last 7 days</span>
        </div>
        {leak && leak.n > 0 && (
          <button
            className={`leak ${stuckOnly ? "on" : ""}`}
            onClick={() => {
              setStuckOnly(!stuckOnly);
              setFocus(leak.c.key);
            }}
          >
            <TriangleAlert size={18} />
            <span>
              <b>{leak.n} stuck in {leak.c.label}</b>
              {stuckOnly ? "Showing only stuck businesses. Tap to show all." : "Biggest leak right now. Tap to see only stuck businesses."}
            </span>
          </button>
        )}
      </div>

      <div className="filters">
        {mode === "master" && (
          <div className="people">
            <button className={`person ${agent === "all" ? "on" : ""}`} onClick={() => setAgent("all")}>Everyone</button>
            {d.agents.map((a) => (
              <button key={a.id} className={`person ${agent === a.id ? "on" : ""}`} onClick={() => setAgent(agent === a.id ? "all" : a.id)} title={a.name}>
                <span className="av-xs">{initials(a.name)}</span>
                {a.name.split(" ")[0]}
              </button>
            ))}
          </div>
        )}
        <label className="find">
          <Search size={15} />
          <input placeholder="Find a business" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      {wide ? (
        <div className="board">
          {COLUMNS.map((c) => {
            const items = byCol(c.key);
            const paying = c.key === "paid" || c.key === "regular";
            return (
              <section className="lane" key={c.key} style={{ ["--lane" as string]: c.color }}>
                <header>
                  <div className="lane-t"><i />{c.label}<span>{items.length}</span></div>
                  <small>{paying ? `${naira(items.reduce((s, m) => s + volume(m), 0), true)} total` : c.hint}</small>
                </header>
                <div className="lane-body">
                  {c.key === "talked" && (
                    <button className="lane-add" onClick={() => open({ kind: "interaction" })}><Plus size={14} /> Log a visit</button>
                  )}
                  {items.map((m) => <BoardCard key={m.id} m={m} now={now} />)}
                  {items.length === 0 && <div className="lane-empty">Nobody here</div>}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <>
          <div className="stage-tabs">
            {COLUMNS.map((c) => (
              <button key={c.key} className={focus === c.key ? "on" : ""} style={{ ["--lane" as string]: c.color }} onClick={() => setFocus(c.key)}>
                <i />
                <span>{c.label}</span>
                <b>{byCol(c.key).length}</b>
              </button>
            ))}
          </div>
          <div className="lane-list">
            {byCol(focus).map((m) => <BoardCard key={m.id} m={m} now={now} />)}
            {byCol(focus).length === 0 && <Empty>Nobody here.</Empty>}
          </div>
        </>
      )}

      {lost.length > 0 && (
        <div>
          <button className="btn small ghost" onClick={() => setShowLost(!showLost)}>{showLost ? "Hide" : "Show"} {lost.length} not interested</button>
          {showLost && (
            <div className="lane-list" style={{ marginTop: 10 }}>
              {lost.map((m) => <BoardCard key={m.id} m={m} now={now} />)}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- today (chase list)

export function Today() {
  const d = useScope();
  const { mode } = useStore();
  const open = useOverlay();
  const now = Date.now();
  const today = startOfDay(now);
  const openFus = d.followUps.filter((f) => f.status === "open");
  const order = (f: FollowUp) => ({ high: 0, medium: 1, low: 2 })[f.priority];
  const groups: [string, FollowUp[]][] = [
    ["Overdue", openFus.filter((f) => f.due < today)],
    ["Today", openFus.filter((f) => f.due >= today && f.due < today + DAY)],
    ["Coming up", openFus.filter((f) => f.due >= today + DAY)],
  ];
  const done = d.followUps
    .filter((f) => f.status === "done" && (f.closedAt ?? 0) >= today - 6 * DAY)
    .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));

  return (
    <div className="today">
      <div className="today-intro">
        <h2>Who to chase</h2>
        <p className="hint">Businesses that stalled, and call-backs you promised. Marking one done asks what happened, so the next person knows.</p>
      </div>
      {groups.map(([label, list]) =>
        list.length === 0 ? null : (
          <section key={label} className="chase-group">
            <h3>{label} <span>{list.length}</span></h3>
            {[...list]
              .sort((a, b) => order(a) - order(b) || a.due - b.due)
              .map((f) => {
                const m = d.merchants.find((x) => x.id === f.merchantId);
                if (!m) return null;
                return (
                  <div className={`chase ${f.priority}`} key={f.id}>
                    <button className="chase-main" onClick={() => open({ kind: "merchant", id: m.id })}>
                      <b>{m.businessName}</b>
                      <span>{TRIGGER_LABEL[f.trigger]}{mode === "master" ? ` · ${d.agents.find((a) => a.id === f.agentId)?.name}` : ""} · due {date(f.due)}</span>
                    </button>
                    {m.phone && <a className="icon-btn" href={`tel:${m.phone.replace(/\s/g, "")}`} aria-label={`Call ${m.ownerName}`}><Phone size={15} /></a>}
                    <button className="btn small" onClick={() => open({ kind: "closeFollowUp", id: f.id })}>Done</button>
                  </div>
                );
              })}
          </section>
        ),
      )}
      {openFus.length === 0 && <Empty>No one to chase. Go find new businesses.</Empty>}
      {done.length > 0 && (
        <section className="chase-group">
          <h3>Closed this week <span>{done.length}</span></h3>
          {done.slice(0, 12).map((f) => {
            const m = d.merchants.find((x) => x.id === f.merchantId);
            if (!m) return null;
            return (
              <div className="chase done" key={f.id}>
                <button className="chase-main" onClick={() => open({ kind: "merchant", id: m.id })}>
                  <b>{m.businessName}</b>
                  <span>{f.outcome} · {ago(f.closedAt ?? now, now)}</span>
                </button>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- team

export function Team() {
  const { data } = useStore();
  const open = useOverlay();
  const now = Date.now();
  return (
    <div className="team">
      {data.agents.map((a) => {
        const ms = data.merchants.filter((m) => m.agentId === a.id && m.stage !== "lost");
        const counts = COLUMNS.map((c) => ({ c, n: ms.filter((m) => columnOf(m) === c.key).length }));
        const paying = counts.filter((x) => x.c.key === "paid" || x.c.key === "regular").reduce((s, x) => s + x.n, 0);
        const vol = ms.reduce((s, m) => s + volume(m, now - 30 * DAY), 0);
        const lastVisit = data.interactions.filter((i) => i.agentId === a.id).reduce((t, i) => Math.max(t, i.at), 0);
        return (
          <button key={a.id} className={`member ${a.status}`} onClick={() => open({ kind: "agent", id: a.id })}>
            <div className="member-top">
              <span className="av-lg">{initials(a.name)}</span>
              <div>
                <b>{a.name}</b>
                <span><MapPin size={12} /> {a.area}</span>
              </div>
              <span className="code">{a.code}</span>
            </div>
            <div className="spread" aria-label="Businesses by stage">
              {counts.map(({ c, n }) => (n > 0 ? <i key={c.key} style={{ flex: n, background: c.color }} title={`${c.label}: ${n}`} /> : null))}
              {ms.length === 0 && <i style={{ flex: 1, background: "var(--surface-3)" }} />}
            </div>
            <div className="member-nums">
              <div><b>{ms.length}</b><span>in pipeline</span></div>
              <div><b>{paying}</b><span>paying</span></div>
              <div><b>{naira(vol, true)}</b><span>30-day volume</span></div>
            </div>
            <div className="member-foot">
              {a.status === "paused" ? <span className="flag">Paused</span> : <span className="tiny">Last visit {lastVisit ? ago(lastVisit, now) : "never"}</span>}
              <span className="tiny">Earnings: TBD</span>
            </div>
          </button>
        );
      })}
      <button className="member add" onClick={() => open({ kind: "addAgent" })}>
        <Plus size={20} />
        <b>Add an agent</b>
        <span className="tiny">They get a referral code for sign-ups</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- notes

export function Notes() {
  const { data } = useStore();
  const open = useOverlay();
  const [cat, setCat] = useState<NoteCategory | "all">("all");
  const list = data.notes.filter((n) => cat === "all" || n.category === cat).sort((a, b) => b.at - a.at);
  const name = (id: string) => data.agents.find((a) => a.id === id)?.name ?? "";
  return (
    <div className="notes">
      <aside className="notes-side">
        <h2>From the market</h2>
        <p className="hint">What agents hear on the ground. The merchant's own words stay separate from the agent's reading of them.</p>
        <button className="btn primary" onClick={() => open({ kind: "note" })}><Plus size={15} /> Add a note</button>
        <div className="note-filters">
          {([["all", "Everything"], ...Object.entries(NOTE_LABEL)] as [NoteCategory | "all", string][]).map(([k, l]) => (
            <button key={k} className={cat === k ? "on" : ""} onClick={() => setCat(k)}>
              {l}
              <span>{k === "all" ? data.notes.length : data.notes.filter((n) => n.category === k).length}</span>
            </button>
          ))}
        </div>
      </aside>
      <div className="feed">
        {list.length === 0 && <Empty>No notes here yet.</Empty>}
        {list.map((n) => (
          <article key={n.id} className="post">
            <span className="post-cat">{NOTE_LABEL[n.category]}</span>
            {n.quote && (
              <blockquote>
                <Quote size={16} />
                {n.quote}
              </blockquote>
            )}
            <p>{n.observation}</p>
            {n.hypothesis && <p className="take"><b>Agent's take</b> {n.hypothesis}</p>}
            <span className="post-meta">{name(n.agentId)} · {n.area} · {ago(n.at)}</span>
          </article>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- checks (KYB)

export function Checks() {
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
      <div className="tiers">
        <div className="tier">
          <span className="tier-n">Tier 1</span>
          <b>Owner + bank</b>
          <p>Owner's NIN checked with Smile ID, and the payout account name must match it. Done on the spot. Payout cap applies.</p>
          <span className="tier-c">{done.filter((m) => m.kyb.tier === 1).length} businesses</span>
        </div>
        <div className="tier">
          <span className="tier-n">Tier 2</span>
          <b>CAC registered</b>
          <p>Registration checked with Smile ID, and the owner must be a director or proprietor. Lifts the cap.</p>
          <span className="tier-c">{done.filter((m) => m.kyb.tier === 2).length} businesses</span>
        </div>
      </div>
      <Card title="Verification queue">
        <div style={{ marginBottom: 14 }}>
          <Chips value={tab} options={[["waiting", `Waiting on you · ${waiting.length}`], ["todo", `Not started · ${todo.length}`], ["done", `Verified · ${done.length}`]]} onChange={setTab} />
        </div>
        {list.length === 0 && <Empty>{tab === "waiting" ? "Nothing waiting on you." : "Nothing here."}</Empty>}
        <div className="list">
          {list.map((m) => (
            <div className="li" key={m.id} style={{ alignItems: "center", flexWrap: "wrap" }}>
              <button className="body" style={{ background: "none", border: 0, padding: 0, textAlign: "left", flex: "1 1 240px" }} onClick={() => open({ kind: "merchant", id: m.id })}>
                <b style={{ fontWeight: 500 }}>{m.businessName}</b>
                <p>{m.ownerName} · by {name(m.agentId)}</p>
                {m.kyb.note && <p style={{ color: "var(--orange)" }}>{m.kyb.note}{m.kyb.resolvedName ? ` — bank says ${m.kyb.resolvedName}` : ""}</p>}
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

// ---------------------------------------------------------------- insights

export function Insights() {
  const d = useScope();
  const { mode } = useStore();
  const open = useOverlay();
  const now = Date.now();
  const [period, setPeriod] = useState<"7" | "30" | "all">("30");
  const [agent, setAgent] = useState("all");
  const since = period === "all" ? 0 : now - Number(period) * DAY;
  const ms = d.merchants.filter((m) => m.createdAt >= since && (agent === "all" || m.agentId === agent));
  const scoped = { ...d, interactions: d.interactions.filter((i) => i.at >= since) };
  const { acquisition, activation } = funnels(scoped, ms, now);
  // Same six steps as the board, counted cumulatively.
  const flow = [acquisition[1], acquisition[3], acquisition[5], activation[1], activation[2], { label: "", count: ms.filter((m) => m.payments.length >= 3).length }].map((r, i) => ({
    count: r.count,
    color: COLUMNS[i].color,
    label: COLUMNS[i].label,
  }));
  const ix = scoped.interactions.filter((i) => ms.some((m) => m.id === i.merchantId));
  const rows = (t: [string, number][]) => t.slice(0, 6).map(([label, count]) => ({ label, count }));

  const markets = useMemo(() => {
    const names = [...new Set([...d.agents.map((a) => a.area), ...ms.map((m) => m.area)])];
    return names
      .map((area) => {
        const here = ms.filter((m) => m.area === area);
        return { area, agents: d.agents.filter((a) => a.area === area), reached: here.length, paying: here.filter((m) => reached(m, "transacting")).length, vol: here.reduce((s, m) => s + volume(m), 0) };
      })
      .sort((a, b) => b.reached - a.reached);
  }, [d.agents, ms]);

  return (
    <>
      <div className="row">
        <Chips value={period} options={[["7", "7 days"], ["30", "30 days"], ["all", "All time"]]} onChange={setPeriod} />
        {mode === "master" && (
          <select className="select" style={{ width: "auto" }} value={agent} onChange={(e) => setAgent(e.target.value)}>
            <option value="all">Whole team</option>
            {d.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
      </div>

      <section className="flow">
        {flow.map((s, i) => (
          <div className="flow-step" key={s.label} style={{ ["--lane" as string]: s.color }}>
            <span className="flow-n">{s.count}</span>
            <span className="flow-l">{i === 0 ? "Talked to" : `Reached ${s.label.toLowerCase()}`}</span>
            {i > 0 && <span className="flow-drop">{pct(s.count, flow[i - 1].count)}% of previous</span>}
          </div>
        ))}
      </section>
      <p className="tiny" style={{ marginTop: -8 }}>{acquisition[0].count} visits logged in this period. Businesses are counted from when they were first visited.</p>

      <div className="grid g3">
        <Card title="Why they say no">{ix.some((i) => i.objection) ? <Bars flat rows={rows(tally(ix.map((i) => i.objection)))} /> : <Empty>Nothing logged.</Empty>}</Card>
        <Card title="What they use today">{ix.some((i) => i.competitor) ? <Bars flat rows={rows(tally(ix.map((i) => i.competitor)))} /> : <Empty>Nothing logged.</Empty>}</Card>
        <Card title="Do they stick?">
          <Bars rows={activation.slice(2)} />
          <p className="tiny" style={{ marginTop: 12 }}>Retained = paying for 30+ days and paid in the last 14.</p>
        </Card>
      </div>

      <Card title="Markets">
        <div className="markets">
          {markets.map((t) => (
            <div className="market" key={t.area}>
              <div className="market-name">
                <b><MapPin size={13} /> {t.area}</b>
                <span>
                  {t.agents.length ? (
                    t.agents.map((a, i) => (
                      <button key={a.id} className="linkish" onClick={() => open({ kind: "agent", id: a.id })}>{i ? ", " : ""}{a.name}</button>
                    ))
                  ) : (
                    <em>No agent here yet</em>
                  )}
                </span>
              </div>
              <div className="market-n"><b>{t.reached}</b><span>reached</span></div>
              <div className="market-n"><b>{t.paying}</b><span>paying</span></div>
              <div className="market-n"><b>{naira(t.vol, true)}</b><span>volume</span></div>
            </div>
          ))}
        </div>
      </Card>
    </>
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
