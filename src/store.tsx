import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { followUpsFor } from "./derive";
import { DATA_VERSION, seed, uid } from "./seed";
import type { Agent, Data, FieldNote, FollowUp, Interaction, Kyb, Merchant, Payment, Stage } from "./types";

const KEY = "linq-field-demo";

function load(): Data {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as Data;
      if (d.version === DATA_VERSION) return d;
    }
  } catch {
    /* storage blocked: fall back to fresh demo data */
  }
  return seed();
}

type Action =
  | { type: "reset" }
  | { type: "addAgent"; agent: Agent }
  | { type: "setAgentStatus"; id: string; status: Agent["status"] }
  | { type: "addMerchant"; merchant: Merchant }
  | { type: "setStage"; id: string; stage: Stage }
  | { type: "setKyb"; id: string; kyb: Kyb; stage?: Stage }
  | { type: "reassign"; id: string; agentId: string }
  | { type: "addPayment"; id: string; payment: Payment }
  | { type: "addInteraction"; interaction: Interaction }
  | { type: "addNote"; note: FieldNote }
  | { type: "addFollowUp"; followUp: FollowUp }
  | { type: "closeFollowUp"; id: string; outcome: string };

/** Close the merchant's open auto follow-ups and open whatever it now needs. */
function refreshFollowUps(data: Data, m: Merchant): FollowUp[] {
  const now = Date.now();
  const kept = data.followUps.map((f) =>
    f.merchantId === m.id && f.status === "open" && f.trigger !== "call_back"
      ? { ...f, status: "done" as const, outcome: "Resolved — merchant moved forward", closedAt: now }
      : f,
  );
  return [...kept, ...followUpsFor(m, now).map((f) => ({ ...f, due: now + 86_400_000 }))];
}

function withMerchant(data: Data, id: string, fn: (m: Merchant) => Merchant, refresh = true): Data {
  let next: Merchant | undefined;
  const merchants = data.merchants.map((m) => (m.id === id ? (next = fn(m)) : m));
  if (!next) return data;
  const d = { ...data, merchants };
  return refresh ? { ...d, followUps: refreshFollowUps(d, next) } : d;
}

const moveTo = (m: Merchant, stage: Stage): Merchant =>
  m.stage === stage ? m : { ...m, stage, history: [...m.history, { stage, at: Date.now() }] };

function reducer(data: Data, a: Action): Data {
  switch (a.type) {
    case "reset":
      return seed();
    case "addAgent":
      return { ...data, agents: [...data.agents, a.agent] };
    case "setAgentStatus":
      return { ...data, agents: data.agents.map((g) => (g.id === a.id ? { ...g, status: a.status } : g)) };
    case "addMerchant": {
      const d = { ...data, merchants: [a.merchant, ...data.merchants] };
      return { ...d, followUps: refreshFollowUps(d, a.merchant) };
    }
    case "setStage":
      return withMerchant(data, a.id, (m) => moveTo(m, a.stage));
    case "setKyb":
      return withMerchant(data, a.id, (m) => moveTo({ ...m, kyb: a.kyb }, a.stage ?? m.stage));
    case "reassign": {
      const d = withMerchant(data, a.id, (m) => ({ ...m, agentId: a.agentId }), false);
      return { ...d, followUps: d.followUps.map((f) => (f.merchantId === a.id && f.status === "open" ? { ...f, agentId: a.agentId } : f)) };
    }
    case "addPayment":
      return withMerchant(data, a.id, (m) => moveTo({ ...m, payments: [...m.payments, a.payment] }, "transacting"));
    case "addInteraction":
      return { ...data, interactions: [a.interaction, ...data.interactions] };
    case "addNote":
      return { ...data, notes: [a.note, ...data.notes] };
    case "addFollowUp":
      return { ...data, followUps: [...data.followUps, a.followUp] };
    case "closeFollowUp":
      return {
        ...data,
        followUps: data.followUps.map((f) => (f.id === a.id ? { ...f, status: "done", outcome: a.outcome, closedAt: Date.now() } : f)),
      };
  }
}

export type Mode = "master" | "agent";

interface Ctx {
  data: Data;
  dispatch: (a: Action) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  actingAgentId: string;
  setActingAgentId: (id: string) => void;
  toast: (msg: string) => void;
  toastMsg: string | null;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, load);
  const [mode, setMode] = useState<Mode>("master");
  const [actingAgentId, setActingAgentId] = useState("ag_1");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* demo still works in-memory */
    }
  }, [data]);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2800);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const value = useMemo(
    () => ({ data, dispatch, mode, setMode, actingAgentId, setActingAgentId, toast: setToastMsg, toastMsg }),
    [data, mode, actingAgentId, toastMsg],
  );
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}

/** Merchants, interactions etc. scoped to what the current view may see. */
export function useScope() {
  const { data, mode, actingAgentId } = useStore();
  return useMemo(() => {
    if (mode === "master") return { ...data, scoped: false as const };
    const mine = <T extends { agentId: string }>(xs: T[]) => xs.filter((x) => x.agentId === actingAgentId);
    return {
      ...data,
      merchants: mine(data.merchants),
      interactions: mine(data.interactions),
      notes: data.notes, // everyone learns from everyone's notes
      followUps: mine(data.followUps),
      scoped: true as const,
    };
  }, [data, mode, actingAgentId]);
}

export { uid };
