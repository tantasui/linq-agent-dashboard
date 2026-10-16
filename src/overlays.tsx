import { Check, CircleAlert, Clock, Loader2, MessageSquarePlus, Phone, ShieldCheck, X } from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";
import { ago, date, enteredAt, isDormant, naira, reached, stageIndex, volume } from "./derive";
import { DAY } from "./seed";
import { uid, useStore } from "./store";
import {
  AREAS,
  BANKS,
  CATEGORIES,
  COMPETITORS,
  NOTE_LABEL,
  OBJECTIONS,
  OUTCOME_LABEL,
  STAGES,
  STAGE_LABEL,
  TRIGGER_LABEL,
  type Channel,
  type Merchant,
  type NoteCategory,
  type Outcome,
  type Stage,
} from "./types";
import { Bars, Chips, Drawer, Empty, Field, KybPill, Modal, Stat, StagePill, Who } from "./ui";

type Overlay =
  | { kind: "merchant"; id: string }
  | { kind: "agent"; id: string }
  | { kind: "interaction"; merchantId?: string }
  | { kind: "note"; merchantId?: string }
  | { kind: "verify"; id: string }
  | { kind: "addAgent" }
  | { kind: "closeFollowUp"; id: string }
  | { kind: "payment"; id: string };

const OverlayCtx = createContext<(o: Overlay | null) => void>(() => {});
export const useOverlay = () => useContext(OverlayCtx);

export function OverlayProvider({ children }: { children: ReactNode }) {
  // A stack, so closing a modal opened from a drawer returns to the drawer.
  const [stack, setStack] = useState<Overlay[]>([]);
  const open = (o: Overlay | null) => setStack((s) => (o ? [...s.filter((x) => x.kind !== o.kind), o] : []));
  const close = () => setStack((s) => s.slice(0, -1));
  const top = stack[stack.length - 1];
  const drawer = [...stack].reverse().find((o) => o.kind === "merchant" || o.kind === "agent");

  return (
    <OverlayCtx.Provider value={open}>
      {children}
      {drawer?.kind === "merchant" && <MerchantDrawer id={drawer.id} onClose={close} />}
      {drawer?.kind === "agent" && <AgentDrawer id={drawer.id} onClose={close} />}
      {top?.kind === "interaction" && <InteractionModal merchantId={top.merchantId} onClose={close} />}
      {top?.kind === "note" && <NoteModal merchantId={top.merchantId} onClose={close} />}
      {top?.kind === "verify" && <VerifyModal id={top.id} onClose={close} />}
      {top?.kind === "addAgent" && <AddAgentModal onClose={close} />}
      {top?.kind === "closeFollowUp" && <CloseFollowUpModal id={top.id} onClose={close} />}
      {top?.kind === "payment" && <PaymentModal id={top.id} onClose={close} />}
    </OverlayCtx.Provider>
  );
}

/** Which agent new records belong to: the acting agent, or a chosen one in master mode. */
function useAgentPicker(initial?: string) {
  const { data, mode, actingAgentId } = useStore();
  const active = data.agents.filter((a) => a.status === "active");
  const [agentId, setAgentId] = useState(initial ?? (mode === "agent" ? actingAgentId : active[0]?.id ?? ""));
  const picker =
    mode === "master" ? (
      <Field label="Agent">
        <select className="select" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          {active.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>
    ) : null;
  return { agentId, picker };
}

// ---------------------------------------------------------------- interaction

function InteractionModal({ merchantId, onClose }: { merchantId?: string; onClose: () => void }) {
  const { data, dispatch, toast, mode, actingAgentId } = useStore();
  const existing = data.merchants.find((m) => m.id === merchantId);
  const { agentId, picker } = useAgentPicker(existing?.agentId);
  const [isNew, setIsNew] = useState(!existing);
  const [pickedId, setPickedId] = useState(existing?.id ?? "");
  const [f, setF] = useState({ businessName: "", ownerName: "", phone: "", category: CATEGORIES[0], area: data.agents.find((a) => a.id === agentId)?.area ?? AREAS[0] });
  const [channel, setChannel] = useState<Channel>("visit");
  const [outcome, setOutcome] = useState<Outcome>("interested");
  const [objection, setObjection] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [quote, setQuote] = useState("");
  const [note, setNote] = useState("");
  const [followUp, setFollowUp] = useState("");

  const choices = data.merchants.filter((m) => mode === "master" || m.agentId === actingAgentId);
  const canSave = isNew ? f.businessName.trim() && f.ownerName.trim() : !!pickedId;

  function save() {
    const now = Date.now();
    let id = pickedId;
    if (isNew) {
      id = uid("mc");
      const stage: Stage =
        outcome === "not_interested" ? "lost" : outcome === "signed_up" ? "signed_up" : outcome === "call_back" ? "conversation" : "interested";
      const path: Stage[] = stage === "lost" ? ["conversation", "lost"] : STAGES.slice(0, stageIndex(stage) + 1);
      dispatch({
        type: "addMerchant",
        merchant: { id, ...f, businessName: f.businessName.trim(), ownerName: f.ownerName.trim(), agentId, stage, createdAt: now, history: path.map((s) => ({ stage: s, at: now })), kyb: { tier: 0, status: "none" }, payments: [] },
      });
    } else {
      const m = data.merchants.find((x) => x.id === id)!;
      if (outcome === "signed_up" && !reached(m, "signed_up")) dispatch({ type: "setStage", id, stage: "signed_up" });
      else if (outcome === "interested" && m.stage === "conversation") dispatch({ type: "setStage", id, stage: "interested" });
      else if (outcome === "not_interested" && !reached(m, "signed_up")) dispatch({ type: "setStage", id, stage: "lost" });
    }
    dispatch({
      type: "addInteraction",
      interaction: { id: uid("ix"), merchantId: id, agentId, at: now, channel, outcome, objection: objection || undefined, competitor: competitor || undefined, quote: quote.trim() || undefined, note: note.trim() || undefined },
    });
    if (followUp) {
      dispatch({ type: "addFollowUp", followUp: { id: uid("fu"), merchantId: id, agentId, trigger: "call_back", priority: "medium", due: new Date(followUp).getTime(), status: "open" } });
    }
    toast("Interaction logged");
    onClose();
  }

  return (
    <Modal title="New interaction" sub="Log a field conversation while it's fresh." onClose={onClose}>
      {picker}
      {!existing && <Chips value={isNew ? "new" : "old"} options={[["new", "New business"], ["old", "Existing business"]]} onChange={(v) => setIsNew(v === "new")} />}
      {isNew ? (
        <div className="grid g2">
          <Field label="Business name">
            <input className="input" value={f.businessName} onChange={(e) => setF({ ...f, businessName: e.target.value })} placeholder="e.g. Ola Phones" />
          </Field>
          <Field label="Owner / contact">
            <input className="input" value={f.ownerName} onChange={(e) => setF({ ...f, ownerName: e.target.value })} placeholder="Full name" />
          </Field>
          <Field label="Phone">
            <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" placeholder="080…" />
          </Field>
          <Field label="Category">
            <select className="select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Market / area">
            <select className="select" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}>
              {AREAS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
      ) : existing ? (
        <Who name={existing.businessName} sub={`${existing.ownerName} · ${existing.area}`} />
      ) : (
        <Field label="Business">
          <select className="select" value={pickedId} onChange={(e) => setPickedId(e.target.value)}>
            <option value="">Choose…</option>
            {choices.map((m) => <option key={m.id} value={m.id}>{m.businessName} — {STAGE_LABEL[m.stage]}</option>)}
          </select>
        </Field>
      )}
      <Field label="How">
        <Chips value={channel} options={[["visit", "In person"], ["call", "Call"], ["whatsapp", "WhatsApp"]]} onChange={setChannel} />
      </Field>
      <Field label="Outcome">
        <Chips value={outcome} options={Object.entries(OUTCOME_LABEL) as [Outcome, string][]} onChange={setOutcome} />
      </Field>
      <div className="grid g2">
        <Field label="Main objection (optional)">
          <select className="select" value={objection} onChange={(e) => setObjection(e.target.value)}>
            <option value="">None</option>
            {OBJECTIONS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="What do they use today?">
          <select className="select" value={competitor} onChange={(e) => setCompetitor(e.target.value)}>
            <option value="">Didn't say</option>
            {COMPETITORS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
      </div>
      <Field label="What they said, in their words">
        <input className="input" value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="“…”" />
      </Field>
      <Field label="Your note">
        <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Field label="Follow up on (optional)">
        <input className="input" type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
      </Field>
      <div className="row between">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!canSave} onClick={save}>Save interaction</button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- field note

function NoteModal({ merchantId, onClose }: { merchantId?: string; onClose: () => void }) {
  const { data, dispatch, toast } = useStore();
  const m = data.merchants.find((x) => x.id === merchantId);
  const { agentId, picker } = useAgentPicker(m?.agentId);
  const [category, setCategory] = useState<NoteCategory>("why_not");
  const [area, setArea] = useState(m?.area ?? data.agents.find((a) => a.id === agentId)?.area ?? AREAS[0]);
  const [observation, setObservation] = useState("");
  const [quote, setQuote] = useState("");
  const [hypothesis, setHypothesis] = useState("");

  function save() {
    dispatch({ type: "addNote", note: { id: uid("nt"), agentId, at: Date.now(), category, area, observation: observation.trim(), quote: quote.trim() || undefined, hypothesis: hypothesis.trim() || undefined, merchantId } });
    toast("Field note saved");
    onClose();
  }

  return (
    <Modal title="Field note" sub="Write what you saw. Keep their exact words separate from what you think it means." onClose={onClose}>
      {picker}
      <Field label="Type">
        <Chips value={category} options={Object.entries(NOTE_LABEL) as [NoteCategory, string][]} onChange={setCategory} />
      </Field>
      <Field label="Market / area">
        <select className="select" value={area} onChange={(e) => setArea(e.target.value)}>
          {AREAS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Observation">
        <textarea className="textarea" value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="What happened?" />
      </Field>
      <Field label="Their exact words (optional)">
        <input className="input" value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="“…”" />
      </Field>
      <Field label="Your hypothesis (optional)">
        <input className="input" value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} placeholder="What do you think we should do?" />
      </Field>
      <div className="row between">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!observation.trim()} onClick={save}>Save note</button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- KYB

type CheckState = "idle" | "running" | "ok" | "bad" | "warn";

function CheckRow({ state, label, detail }: { state: CheckState; label: string; detail?: string }) {
  const icon =
    state === "running" ? <Loader2 size={16} className="spin" /> : state === "ok" ? <Check size={16} color="var(--green)" /> : state === "bad" ? <X size={16} color="var(--red)" /> : state === "warn" ? <Clock size={16} color="var(--orange)" /> : <span style={{ width: 16 }} />;
  return (
    <div className="check">
      {icon}
      <div>
        <div>{label}</div>
        {detail && <div className="tiny">{detail}</div>}
      </div>
    </div>
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function VerifyModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, dispatch, toast } = useStore();
  const m = data.merchants.find((x) => x.id === id)!;
  const [tier, setTier] = useState<"1" | "2">(m.kyb.tier >= 1 && m.kyb.status === "verified" ? "2" : "1");

  // Tier 1
  const [nin, setNin] = useState("");
  const [bank, setBank] = useState(m.kyb.bankName ?? BANKS[0]);
  const [acct, setAcct] = useState("");
  const [ninState, setNinState] = useState<CheckState>("idle");
  const [bankState, setBankState] = useState<CheckState>("idle");
  const [resolved, setResolved] = useState("");

  // Tier 2
  const [cac, setCac] = useState("");
  const [cacType, setCacType] = useState<"bn" | "co" | "it">("bn");
  const [cacState, setCacState] = useState<CheckState>("idle");
  const [cacDetail, setCacDetail] = useState("");

  const ninOk = /^\d{11}$/.test(nin);
  const acctOk = /^\d{10}$/.test(acct);

  async function runTier1() {
    setNinState("running");
    setBankState("running");
    await wait(1400);
    const ninFound = !nin.startsWith("000");
    setNinState(ninFound ? "ok" : "bad");
    const name = acct.endsWith("0") ? "ADEWALE JOHNSON" : m.ownerName.toUpperCase();
    setResolved(name);
    const match = name === m.ownerName.toUpperCase();
    setBankState(match ? "ok" : "bad");
    const base = { ...m.kyb, ninLast4: nin.slice(-4), bankName: bank, accountLast4: acct.slice(-4), resolvedName: name, nameMatch: match, updatedAt: Date.now() };
    if (!ninFound) {
      dispatch({ type: "setKyb", id, kyb: { ...base, tier: 0, status: "failed", note: "NIN not found in the ID authority database" } });
      return;
    }
    if (!match) {
      dispatch({ type: "setKyb", id, kyb: { ...base, tier: 0, status: "review", note: "Bank account name doesn't match owner's NIN" }, stage: reached(m, "bank_added") ? m.stage : "bank_added" });
      return;
    }
    dispatch({ type: "setKyb", id, kyb: { ...base, tier: 1, status: "verified", note: undefined }, stage: reached(m, "verified") ? m.stage : "verified" });
    toast("Tier 1 verified — merchant can start receiving payments");
  }

  async function runTier2() {
    setCacState("running");
    await wait(1600);
    const ref = cac.toUpperCase();
    if (ref.endsWith("9")) {
      setCacState("warn");
      setCacDetail("CAC registry unavailable (Smile ID 1015). Queued to retry automatically — merchant stays on Tier 1 meanwhile.");
      dispatch({ type: "setKyb", id, kyb: { ...m.kyb, cac: ref, cacType, status: m.kyb.tier >= 1 ? "queued" : m.kyb.status, updatedAt: Date.now() } });
      return;
    }
    if (ref.endsWith("0")) {
      setCacState("bad");
      setCacDetail("Business not found (Smile ID 1013). Check the number and the business type.");
      return;
    }
    setCacState("ok");
    const legalName = m.businessName.toUpperCase();
    setCacDetail(`${legalName} · proprietor ${m.ownerName.toUpperCase()} matches owner's NIN`);
    dispatch({ type: "setKyb", id, kyb: { ...m.kyb, tier: 2, status: "verified", cac: ref, cacType, legalName, note: undefined, updatedAt: Date.now() }, stage: reached(m, "verified") ? m.stage : "verified" });
    toast("Tier 2 verified — limits lifted");
  }

  const tier1Done = m.kyb.tier >= 1;

  return (
    <Modal title={`Verify ${m.businessName}`} sub="Tiered KYB. Tier 1 takes under a minute on the spot." onClose={onClose}>
      <Chips value={tier} options={[["1", "Tier 1 · Owner + bank"], ["2", "Tier 2 · CAC registered"]]} onChange={setTier} />
      {tier === "1" ? (
        <>
          <p className="hint">Owner's NIN (Smile ID Enhanced KYC) and the payout account name must match. Unregistered traders stop here, with a payout cap.</p>
          <div className="grid g2">
            <Field label={`Owner's NIN — ${m.ownerName}`}>
              <input className="input" inputMode="numeric" maxLength={11} value={nin} onChange={(e) => setNin(e.target.value.replace(/\D/g, ""))} placeholder="11 digits" />
            </Field>
            <Field label="Payout bank">
              <select className="select" value={bank} onChange={(e) => setBank(e.target.value)}>
                {BANKS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Account number">
              <input className="input" inputMode="numeric" maxLength={10} value={acct} onChange={(e) => setAcct(e.target.value.replace(/\D/g, ""))} placeholder="10 digits" />
            </Field>
          </div>
          {ninState !== "idle" && (
            <div className="col">
              <CheckRow state={ninState} label="NIN check" detail={ninState === "bad" ? "Not found in the ID authority database" : ninState === "ok" ? `Matched ${m.ownerName}` : "Checking with Smile ID…"} />
              <CheckRow state={bankState} label="Bank account name" detail={resolved ? `${bank} resolved to ${resolved}${bankState === "bad" ? " — doesn't match owner, sent to master for review" : ""}` : "Resolving…"} />
            </div>
          )}
          <p className="tiny">Demo tips: a NIN starting with 000 isn't found; an account number ending in 0 resolves to a different name.</p>
          <div className="row between">
            <button className="btn ghost" onClick={onClose}>Close</button>
            <button className="btn primary" disabled={!ninOk || !acctOk || ninState === "running"} onClick={runTier1}>
              <ShieldCheck size={16} /> Run checks
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="hint">For CAC-registered businesses. Checks the registration with Smile ID and that the owner is a director or proprietor.</p>
          {!tier1Done && <div className="check"><CircleAlert size={16} color="var(--orange)" /> Finish Tier 1 first so the owner's identity is known.</div>}
          <Field label="Business type">
            <Chips value={cacType} options={[["bn", "Business name (BN)"], ["co", "Limited company (RC)"], ["it", "Trustees (IT)"]]} onChange={setCacType} />
          </Field>
          <Field label="CAC registration number">
            <input className="input" value={cac} onChange={(e) => setCac(e.target.value)} placeholder={cacType === "bn" ? "BN1234567" : cacType === "co" ? "RC123456" : "IT12345"} />
          </Field>
          {cacState !== "idle" && <CheckRow state={cacState} label="CAC registry" detail={cacState === "running" ? "Checking with Smile ID…" : cacDetail} />}
          <p className="tiny">Demo tips: a number ending in 0 isn't found; ending in 9 simulates the registry being down.</p>
          <div className="row between">
            <button className="btn ghost" onClick={onClose}>Close</button>
            <button className="btn primary" disabled={!tier1Done || cac.trim().length < 5 || cacState === "running"} onClick={runTier2}>
              <ShieldCheck size={16} /> Check CAC
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- agents

function AddAgentModal({ onClose }: { onClose: () => void }) {
  const { data, dispatch, toast } = useStore();
  const [f, setF] = useState({ name: "", email: "", phone: "", area: AREAS[0] });
  const code = `LQ-${(f.name.split(" ")[0] || "NEW").toUpperCase().slice(0, 4)}`;
  const ok = f.name.trim().split(" ").length >= 2 && /\S+@\S+\.\S+/.test(f.email);
  function save() {
    dispatch({ type: "addAgent", agent: { id: uid("ag"), ...f, name: f.name.trim(), code: data.agents.some((a) => a.code === code) ? `${code}${data.agents.length}` : code, status: "active", joinedAt: Date.now() } });
    toast(`${f.name.trim()} added. Their referral code is ${code}`);
    onClose();
  }
  return (
    <Modal title="Add agent" sub="They'll get a referral code. Merchants who sign up with it count toward this agent." onClose={onClose}>
      <div className="grid g2">
        <Field label="Full name">
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="Phone">
          <input className="input" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
        <Field label="Territory">
          <select className="select" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}>
            {AREAS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </Field>
      </div>
      <p className="hint">Referral code: <b style={{ color: "var(--text)" }}>{code}</b></p>
      <div className="row between">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!ok} onClick={save}>Add agent</button>
      </div>
    </Modal>
  );
}

function AgentDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, dispatch, mode, toast } = useStore();
  const open = useOverlay();
  const a = data.agents.find((x) => x.id === id);
  if (!a) return null;
  const ms = data.merchants.filter((m) => m.agentId === id);
  const now = Date.now();
  const c = (s: Stage) => ms.filter((m) => reached(m, s)).length;
  return (
    <Drawer onClose={onClose}>
      <div className="row">
        <Who name={a.name} sub={`${a.email} · ${a.phone}`} />
        <span className="spacer" style={{ flex: 1 }} />
        <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>
      <div className="row">
        <span className={`pill ${a.status === "active" ? "green" : ""}`}>{a.status === "active" ? "Active" : "Paused"}</span>
        <span className="pill plain white">Code {a.code}</span>
        <span className="pill plain">{a.area}</span>
      </div>
      <div className="grid g2">
        <Stat label="Businesses" value={ms.length} />
        <Stat label="Transacting" value={c("transacting")} />
        <Stat label="Volume, 30 days" value={naira(ms.reduce((s, m) => s + volume(m, now - 30 * DAY), 0), true)} />
        <Stat label="Earnings" value="—" sub="Commission model not set yet" />
      </div>
      <section className="card">
        <h2>Funnel</h2>
        <Bars rows={[
          { label: "Reached", count: ms.length },
          { label: "Signed up", count: c("signed_up") },
          { label: "Verified", count: c("verified") },
          { label: "Transacting", count: c("transacting") },
        ]} />
      </section>
      <section className="card">
        <h2>Businesses</h2>
        <div className="list">
          {ms.length === 0 && <Empty>No businesses yet.</Empty>}
          {ms.map((m) => (
            <button key={m.id} className="li" style={{ background: "none", border: 0, borderTop: "1px solid var(--line)", textAlign: "left" }} onClick={() => open({ kind: "merchant", id: m.id })}>
              <div className="body"><b>{m.businessName}</b><p>{m.area}</p></div>
              <StagePill stage={m.stage} />
            </button>
          ))}
        </div>
      </section>
      {mode === "master" && (
        <button
          className="btn"
          onClick={() => {
            dispatch({ type: "setAgentStatus", id, status: a.status === "active" ? "paused" : "active" });
            toast(a.status === "active" ? `${a.name} paused` : `${a.name} reactivated`);
          }}
        >
          {a.status === "active" ? "Pause agent" : "Reactivate agent"}
        </button>
      )}
    </Drawer>
  );
}

// ---------------------------------------------------------------- follow-ups

const QUICK_OUTCOMES = ["Reached — they'll finish setup", "No answer, try again", "Booked a visit", "Not interested anymore", "Done"];

function CloseFollowUpModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, dispatch, toast } = useStore();
  const f = data.followUps.find((x) => x.id === id)!;
  const m = data.merchants.find((x) => x.id === f.merchantId)!;
  const [outcome, setOutcome] = useState(QUICK_OUTCOMES[0]);
  const [retry, setRetry] = useState(false);
  return (
    <Modal title="Close follow-up" sub={`${m.businessName} · ${TRIGGER_LABEL[f.trigger]}`} onClose={onClose}>
      <div className="row">
        {m.phone && <a className="btn small" href={`tel:${m.phone.replace(/\s/g, "")}`}><Phone size={14} /> {m.phone}</a>}
      </div>
      <Field label="What happened?">
        <div className="chips">
          {QUICK_OUTCOMES.map((o) => (
            <button key={o} className={`chip ${o === outcome ? "on" : ""}`} onClick={() => setOutcome(o)}>{o}</button>
          ))}
        </div>
      </Field>
      <Field label="Or write it">
        <input className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
      </Field>
      <label className="row" style={{ fontSize: 14 }}>
        <input type="checkbox" checked={retry} onChange={(e) => setRetry(e.target.checked)} /> Schedule another follow-up for tomorrow
      </label>
      <div className="row between">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button
          className="btn primary"
          disabled={!outcome.trim()}
          onClick={() => {
            dispatch({ type: "closeFollowUp", id, outcome: outcome.trim() });
            if (retry) dispatch({ type: "addFollowUp", followUp: { ...f, id: uid("fu"), status: "open", due: Date.now() + DAY, outcome: undefined, closedAt: undefined } });
            toast("Follow-up closed");
            onClose();
          }}
        >
          Close follow-up
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- payment (demo)

function PaymentModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, dispatch, toast } = useStore();
  const m = data.merchants.find((x) => x.id === id)!;
  const [amount, setAmount] = useState("50000");
  const [token, setToken] = useState<"USDC" | "USDT">("USDC");
  const [chain, setChain] = useState("Solana");
  return (
    <Modal title="Simulate a payment" sub="Demo only. In the live system this arrives automatically when a customer pays the merchant's link." onClose={onClose}>
      <div className="grid g2">
        <Field label="Amount (₦)">
          <input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label="Network">
          <select className="select" value={chain} onChange={(e) => setChain(e.target.value)}>
            {["Solana", "Sui", "Base", "BSC", "Stellar", "Aptos"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <Chips value={token} options={[["USDC", "USDC"], ["USDT", "USDT"]]} onChange={setToken} />
      <div className="row between">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button
          className="btn primary"
          disabled={!Number(amount)}
          onClick={() => {
            const first = m.payments.length === 0;
            dispatch({ type: "addPayment", id, payment: { id: uid("pay"), at: Date.now(), amountNgn: Number(amount), token, chain } });
            toast(first ? `${m.businessName} is now transacting 🎉` : "Payment recorded");
            onClose();
          }}
        >
          Record payment
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- merchant

function nextStep(m: Merchant): { label: string; run: "stage" | "verify" | "payment"; to?: Stage } | null {
  switch (m.stage) {
    case "conversation":
      return { label: "Mark as interested", run: "stage", to: "interested" };
    case "interested":
      return { label: "Merchant signed up", run: "stage", to: "signed_up" };
    case "signed_up":
      return { label: "Merchant added bank account", run: "stage", to: "bank_added" };
    case "bank_added":
      return { label: "Verify (KYB)", run: "verify" };
    case "verified":
      return { label: "Merchant created payment link", run: "stage", to: "link_created" };
    case "link_created":
    case "transacting":
      return { label: "Simulate a payment", run: "payment" };
    default:
      return null;
  }
}

function MerchantDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, dispatch, mode, toast } = useStore();
  const open = useOverlay();
  const m = data.merchants.find((x) => x.id === id);
  if (!m) return null;
  const agent = data.agents.find((a) => a.id === m.agentId);
  const now = Date.now();
  const step = nextStep(m);
  const fus = data.followUps.filter((f) => f.merchantId === id && f.status === "open");

  type Event = { at: number; title: string; detail?: string; on?: boolean };
  const events: Event[] = [
    ...m.history.map((h) => ({ at: h.at, title: STAGE_LABEL[h.stage], on: true })),
    ...data.interactions
      .filter((i) => i.merchantId === id)
      .map((i) => ({ at: i.at, title: `${i.channel === "visit" ? "Visit" : i.channel === "call" ? "Call" : "WhatsApp"} · ${OUTCOME_LABEL[i.outcome]}`, detail: [i.quote && `“${i.quote}”`, i.objection, i.competitor && `Uses: ${i.competitor}`, i.note].filter(Boolean).join(" · ") })),
    ...m.payments.map((p) => ({ at: p.at, title: `Payment ${naira(p.amountNgn)}`, detail: `${p.token} on ${p.chain}`, on: true })),
  ].sort((a, b) => b.at - a.at);

  return (
    <Drawer onClose={onClose}>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <Who name={m.businessName} sub={`${m.ownerName} · ${m.category}`} />
        <span style={{ flex: 1 }} />
        <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>
      <div className="row">
        <StagePill stage={m.stage} />
        <KybPill kyb={m.kyb} />
        {isDormant(m, now) && <span className="pill red">Dormant</span>}
      </div>
      <div className="steps" aria-label="Progress">
        {STAGES.map((s) => <i key={s} className={reached(m, s) ? "on" : ""} title={STAGE_LABEL[s]} />)}
      </div>

      <div className="row">
        <button className="btn primary small" onClick={() => open({ kind: "interaction", merchantId: id })}><MessageSquarePlus size={14} /> Log interaction</button>
        {step && (
          <button
            className="btn small"
            onClick={() => {
              if (step.run === "verify") open({ kind: "verify", id });
              else if (step.run === "payment") open({ kind: "payment", id });
              else {
                dispatch({ type: "setStage", id, stage: step.to! });
                toast(`${m.businessName}: ${STAGE_LABEL[step.to!]}`);
              }
            }}
          >
            {step.label}
          </button>
        )}
        {m.stage !== "lost" && reached(m, "bank_added") && step?.run !== "verify" && m.kyb.tier < 2 && (
          <button className="btn small" onClick={() => open({ kind: "verify", id })}><ShieldCheck size={14} /> {m.kyb.tier === 1 ? "Upgrade to Tier 2" : "Verify"}</button>
        )}
        {m.stage === "lost" && <button className="btn small" onClick={() => dispatch({ type: "setStage", id, stage: "interested" })}>Reopen</button>}
      </div>
      <p className="tiny" style={{ marginTop: -8 }}>Stage buttons are for the demo. Live, signup → bank → link → payments update automatically from Linq B2B.</p>

      {m.kyb.status === "review" && (
        <div className="check"><CircleAlert size={16} color="var(--orange)" /> {m.kyb.note}. {mode === "master" ? "Approve it from Verification." : "Your master will review it."}</div>
      )}

      <section className="card">
        <dl className="kv">
          <dt>Phone</dt><dd>{m.phone ? <a href={`tel:${m.phone.replace(/\s/g, "")}`}>{m.phone}</a> : "—"}</dd>
          <dt>Area</dt><dd>{m.area}</dd>
          <dt>Agent</dt>
          <dd>
            {mode === "master" ? (
              <select className="select" value={m.agentId} onChange={(e) => { dispatch({ type: "reassign", id, agentId: e.target.value }); toast("Merchant reassigned"); }}>
                {data.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            ) : (
              agent?.name
            )}
          </dd>
          <dt>First contact</dt><dd>{date(m.createdAt)}</dd>
          {m.kyb.bankName && (<><dt>Payout</dt><dd>{m.kyb.bankName} ••{m.kyb.accountLast4} · {m.kyb.resolvedName}</dd></>)}
          {m.kyb.cac && (<><dt>CAC</dt><dd>{m.kyb.cac}{m.kyb.legalName ? ` · ${m.kyb.legalName}` : ""}</dd></>)}
          {m.payments.length > 0 && (<>
            <dt>Payments</dt><dd>{m.payments.length} · {naira(volume(m))} total</dd>
            <dt>Last paid</dt><dd>{ago(m.payments[m.payments.length - 1].at, now)}</dd>
          </>)}
          {enteredAt(m, "transacting") && (<><dt>Activated</dt><dd>{date(enteredAt(m, "transacting")!)}</dd></>)}
        </dl>
      </section>

      {fus.length > 0 && (
        <section className="card">
          <h2>Open follow-ups</h2>
          <div className="list">
            {fus.map((f) => (
              <div className="li" key={f.id}>
                <div className="body"><b>{TRIGGER_LABEL[f.trigger]}</b><p>Due {ago(f.due, now)}</p></div>
                <button className="btn small" onClick={() => open({ kind: "closeFollowUp", id: f.id })}>Close</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Timeline</h2>
          <span className="spacer" />
          <button className="btn small ghost" onClick={() => open({ kind: "note", merchantId: id })}>Add field note</button>
        </div>
        <div className="timeline">
          {events.map((e, i) => (
            <div className="tl" key={i}>
              <span className={`dot ${e.on ? "on" : ""}`} />
              <div>
                <p>{e.title}</p>
                {e.detail && <small style={{ display: "block", color: "var(--muted)" }}>{e.detail}</small>}
                <small>{date(e.at)} · {ago(e.at, now)}</small>
              </div>
            </div>
          ))}
        </div>
      </section>
    </Drawer>
  );
}
