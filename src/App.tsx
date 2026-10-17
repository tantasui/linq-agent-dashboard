import {
  BarChart3,
  CheckSquare,
  ClipboardList,
  History,
  LayoutGrid,
  Lightbulb,
  MapPin,
  Menu,
  Settings as SettingsIcon,
  ShieldCheck,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { initials, startOfDay } from "./derive";
import { OverlayProvider, useOverlay } from "./overlays";
import { Agents, FieldIntel, FollowUps, Funnel, Merchants, MyHistory, Overview, Settings, Territory, Verification, Workspace, type Page } from "./pages";
import { DAY } from "./seed";
import { StoreProvider, useScope, useStore, type Mode } from "./store";
import type { Agent } from "./types";
import { LinqMark } from "./ui";

type NavItem = { page: Page; label: string; icon: ReactNode; badge?: number; disabled?: boolean };

const TITLES: Record<Page, string> = {
  overview: "Overview",
  agents: "Agents",
  merchants: "Businesses",
  verification: "KYC checks",
  funnel: "Funnel",
  followups: "Follow-ups",
  intel: "Field intel",
  territory: "Territory",
  settings: "Settings",
  workspace: "Field workspace",
  history: "My history",
};

const HOME: Record<Mode, Page> = { master: "overview", agent: "workspace" };
const AGENT_PAGES: Page[] = ["workspace", "merchants", "followups", "intel", "funnel", "history", "settings"];

type Route = { mode: Mode; page: Page; agentId?: string };

const slug = (code: string) => code.toLowerCase();

/**
 * Paths: /master/<page> and /agent/<referral code>/<page>, e.g.
 * /agent/lq-tolu/workspace. Old #/master/... links are still understood.
 */
function parseRoute(agents: Agent[]): Route | null {
  const raw = location.hash.startsWith("#/") ? location.hash.slice(1) : location.pathname;
  const [mode, a, b] = raw.split("/").filter(Boolean);
  if (mode === "master") return a && a in TITLES ? { mode, page: a as Page } : { mode, page: HOME.master };
  if (mode === "agent") {
    const agent = agents.find((x) => slug(x.code) === a);
    if (!agent) {
      // Old links had no agent in them (#/agent/workspace): open the first active one.
      const first = agents.find((x) => x.status === "active");
      return first && AGENT_PAGES.includes(a as Page) ? { mode, agentId: first.id, page: a as Page } : null;
    }
    return { mode, agentId: agent.id, page: AGENT_PAGES.includes(b as Page) ? (b as Page) : HOME.agent };
  }
  return null;
}

function routePath(r: Route, agents: Agent[]): string {
  if (r.mode === "master") return `/master/${r.page}`;
  const agent = agents.find((x) => x.id === r.agentId) ?? agents.find((x) => x.status === "active");
  return agent ? `/agent/${slug(agent.code)}/${r.page}` : `/master/${HOME.master}`;
}

function Shell() {
  const { data, mode, setMode, actingAgentId, setActingAgentId, toastMsg } = useStore();
  const scope = useScope();
  const overlay = useOverlay();
  const [page, setPage] = useState<Page>(() => parseRoute(data.agents)?.page ?? HOME.master);
  const [menu, setMenu] = useState(false);

  // URL ⇄ state. A navigation pushes a history entry so Back/Forward work;
  // landing on a stale or unknown URL rewrites it in place.
  const [ready, setReady] = useState(false);
  const fromHistory = useRef(false);

  useEffect(() => {
    const apply = (r: Route) => {
      setMode(r.mode);
      if (r.agentId) setActingAgentId(r.agentId);
      setPage(r.page);
    };
    const r = parseRoute(data.agents);
    if (r) apply(r);
    history.replaceState(null, "", routePath(r ?? { mode: "master", page: HOME.master }, data.agents));
    setReady(true);
    const onPop = () => {
      const x = parseRoute(data.agents);
      if (!x) return;
      fromHistory.current = true;
      apply(x);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (mode === "agent" && !AGENT_PAGES.includes(page)) {
      setPage(HOME.agent);
      return;
    }
    const next = routePath({ mode, page, agentId: actingAgentId }, data.agents);
    if (location.pathname !== next || location.hash) {
      if (fromHistory.current) history.replaceState(null, "", next);
      else history.pushState(null, "", next);
    }
    fromHistory.current = false;
    document.title = `${mode === "agent" && page === "merchants" ? "My businesses" : TITLES[page]} · Linq Field`;
    window.scrollTo(0, 0);
    overlay(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mode, page, actingAgentId]);

  const go = (p: Page) => {
    setPage(p);
    setMenu(false);
  };
  const switchMode = (m: Mode) => {
    setMode(m);
    setPage(HOME[m]);
    setMenu(false);
  };

  const tomorrow = startOfDay(Date.now()) + DAY;
  const openFu = scope.followUps.filter((f) => f.status === "open" && (mode === "master" || f.due < tomorrow)).length;
  const review = data.merchants.filter((m) => m.kyb.status === "review" || m.kyb.status === "queued").length;

  const groups: { label: string; items: NavItem[] }[] =
    mode === "master"
      ? [
          {
            label: "Group",
            items: [
              { page: "overview", label: "Overview", icon: <LayoutGrid size={17} /> },
              { page: "agents", label: "Agents", icon: <Users size={17} /> },
              { page: "merchants", label: "Businesses", icon: <Store size={17} /> },
              { page: "verification", label: "KYC checks", icon: <ShieldCheck size={17} />, badge: review },
            ],
          },
          {
            label: "Command centre",
            items: [
              { page: "funnel", label: "Funnel", icon: <BarChart3 size={17} /> },
              { page: "followups", label: "Follow-ups", icon: <CheckSquare size={17} />, badge: openFu },
              { page: "intel", label: "Field intel", icon: <Lightbulb size={17} /> },
              { page: "territory", label: "Territory", icon: <MapPin size={17} /> },
              { page: "settings", label: "Earnings · soon", icon: <Wallet size={17} />, disabled: true },
            ],
          },
        ]
      : [
          {
            label: "In the field",
            items: [
              { page: "workspace", label: "Field workspace", icon: <ClipboardList size={17} /> },
              { page: "merchants", label: "My businesses", icon: <Store size={17} /> },
              { page: "followups", label: "Follow-ups", icon: <CheckSquare size={17} />, badge: openFu },
              { page: "intel", label: "Field intel", icon: <Lightbulb size={17} /> },
            ],
          },
          {
            label: "Me",
            items: [
              { page: "funnel", label: "My stats", icon: <BarChart3 size={17} /> },
              { page: "history", label: "My history", icon: <History size={17} /> },
            ],
          },
        ];

  const agents = data.agents.filter((a) => a.status === "active");
  const me = data.agents.find((a) => a.id === actingAgentId);
  const title = mode === "agent" && page === "merchants" ? "My businesses" : mode === "agent" && page === "funnel" ? "My stats" : TITLES[page];

  return (
    <>
      <div className="announce">Demo with sample data — try anything. Changes only save in your browser.</div>
      <div className="shell">
        {menu && <div className="side-scrim" onClick={() => setMenu(false)} />}
        <nav className={`side ${menu ? "open" : ""}`}>
          <div className="brand">
            <LinqMark size={28} />
            <div>
              Linq <em>Field</em>
            </div>
          </div>
          <div className="mode" role="tablist">
            <button className={mode === "master" ? "on" : ""} onClick={() => switchMode("master")}>Master</button>
            <button className={mode === "agent" ? "on" : ""} onClick={() => switchMode("agent")}>Agent</button>
          </div>
          {groups.map((g) => (
            <div className="nav-group" key={g.label}>
              <div className="nav-label">{g.label}</div>
              {g.items.map((it) => (
                <button key={it.label} className={`nav-item ${page === it.page && !it.disabled ? "on" : ""}`} disabled={it.disabled} onClick={() => go(it.page)}>
                  {it.icon}
                  {it.label}
                  {!!it.badge && <span className="badge">{it.badge}</span>}
                </button>
              ))}
            </div>
          ))}
          <div className="side-foot">
            <div className="me">
              <span className="avatar">{mode === "master" ? "MA" : initials(me?.name ?? "?")}</span>
              {mode === "master" ? (
                <div>
                  <b>Master agent</b>
                  <span>{data.agents.length} agents in your group</span>
                </div>
              ) : (
                <label>
                  <span>Signed in as</span>
                  <select value={actingAgentId} onChange={(e) => setActingAgentId(e.target.value)}>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </label>
              )}
            </div>
            <button className={`nav-item ${page === "settings" ? "on" : ""}`} onClick={() => go("settings")}>
              <SettingsIcon size={17} /> Settings
            </button>
          </div>
        </nav>
        <main className="main">
          <header className="top">
            <button className="icon-btn menu-btn" onClick={() => setMenu(true)} aria-label="Menu">
              <Menu size={17} />
            </button>
            <h1>{title}</h1>
            <span className="spacer" />
            {mode === "agent" && me && <span className="code only-wide-inline">{me.code}</span>}
            <span className="pill plain white">{mode === "master" ? "Master" : "Agent"}</span>
          </header>
          <div className="content">
            {page === "overview" && <Overview go={go} />}
            {page === "agents" && <Agents />}
            {page === "merchants" && <Merchants />}
            {page === "verification" && <Verification />}
            {page === "funnel" && <Funnel />}
            {page === "followups" && <FollowUps />}
            {page === "intel" && <FieldIntel />}
            {page === "territory" && <Territory />}
            {page === "settings" && <Settings />}
            {page === "workspace" && <Workspace go={go} />}
            {page === "history" && <MyHistory />}
          </div>
        </main>
      </div>
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <OverlayProvider>
        <Shell />
      </OverlayProvider>
    </StoreProvider>
  );
}
