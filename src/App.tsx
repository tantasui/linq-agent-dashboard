import { CalendarCheck, Columns3, LineChart, MessagesSquare, Plus, Settings as SettingsIcon, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { startOfDay } from "./derive";
import { OverlayProvider, useOverlay } from "./overlays";
import { Checks, Insights, Notes, Pipeline, Settings, Team, Today, type Page } from "./pages";
import { DAY } from "./seed";
import { StoreProvider, useScope, useStore, type Mode } from "./store";
import { LinqMark } from "./ui";

type NavItem = { page: Page; label: string; icon: ReactNode; badge?: number };

const PAGES: Page[] = ["pipeline", "today", "team", "notes", "checks", "insights", "settings"];
const MASTER_ONLY: Page[] = ["team", "checks"];

const TITLE: Record<Page, string> = {
  pipeline: "Pipeline",
  today: "Today",
  team: "Team",
  notes: "Notes",
  checks: "Checks",
  insights: "Insights",
  settings: "Demo settings",
};

function readHash(): { mode: Mode; page: Page; as?: string } | null {
  const [mode, page] = location.hash.replace(/^#\/?/, "").split("?")[0].split("/");
  if ((mode === "master" || mode === "agent") && PAGES.includes(page as Page)) return { mode, page: page as Page };
  return null;
}

function Shell() {
  const { data, mode, setMode, actingAgentId, setActingAgentId, toastMsg } = useStore();
  const scope = useScope();
  const overlay = useOverlay();
  const [page, setPage] = useState<Page>(() => readHash()?.page ?? "pipeline");

  // Hash routing, so a refresh or a shared link lands on the same page.
  useEffect(() => {
    const h = readHash();
    if (h) setMode(h.mode);
    const onHash = () => {
      const x = readHash();
      if (x) {
        setMode(x.mode);
        setPage(x.page);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [setMode]);

  useEffect(() => {
    if (mode === "agent" && MASTER_ONLY.includes(page)) {
      setPage("pipeline");
      return;
    }
    const next = `#/${mode}/${page}`;
    if (location.hash !== next) history.replaceState(null, "", next);
    window.scrollTo(0, 0);
    overlay(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, page]);

  const tomorrow = startOfDay(Date.now()) + DAY;
  const due = scope.followUps.filter((f) => f.status === "open" && f.due < tomorrow).length;
  const waiting = data.merchants.filter((m) => ["review", "queued", "failed"].includes(m.kyb.status)).length;

  const nav: NavItem[] = [
    { page: "pipeline", label: "Pipeline", icon: <Columns3 size={18} /> },
    { page: "today", label: "Today", icon: <CalendarCheck size={18} />, badge: due },
    ...(mode === "master" ? [{ page: "team" as Page, label: "Team", icon: <Users size={18} /> }] : []),
    { page: "notes", label: "Notes", icon: <MessagesSquare size={18} /> },
    ...(mode === "master" ? [{ page: "checks" as Page, label: "Checks", icon: <ShieldCheck size={18} />, badge: waiting }] : []),
    { page: "insights", label: "Insights", icon: <LineChart size={18} /> },
  ];

  const viewer = mode === "master" ? "master" : actingAgentId;
  const me = data.agents.find((a) => a.id === actingAgentId);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <LinqMark size={28} />
          <span>Linq <em>Field</em></span>
        </div>
        <nav className="tabs">
          {nav.map((n) => (
            <button key={n.page} className={page === n.page ? "on" : ""} onClick={() => setPage(n.page)}>
              {n.label}
              {!!n.badge && <span className="badge">{n.badge}</span>}
            </button>
          ))}
        </nav>
        <span className="grow" />
        <button className="btn primary small log-btn" onClick={() => overlay({ kind: "interaction" })}>
          <Plus size={15} /> Log visit
        </button>
        <label className="viewer" title="Switch who you're viewing as">
          <span>Viewing as</span>
          <select
            value={viewer}
            onChange={(e) => {
              if (e.target.value === "master") setMode("master");
              else {
                setActingAgentId(e.target.value);
                setMode("agent");
              }
            }}
          >
            <option value="master">Master (you)</option>
            <optgroup label="Agents">
              {data.agents.filter((a) => a.status === "active").map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </optgroup>
          </select>
        </label>
        <button className={`icon-btn ${page === "settings" ? "on" : ""}`} onClick={() => setPage("settings")} aria-label="Demo settings">
          <SettingsIcon size={16} />
        </button>
      </header>

      <div className="demo-strip">
        <span>Demo · sample data · changes stay in your browser</span>
        {mode === "agent" && me && <span>Agent view: {me.name} · code {me.code}</span>}
      </div>

      <main className="page">
        <h1 className="page-title">{TITLE[page]}</h1>
        {page === "pipeline" && <Pipeline />}
        {page === "today" && <Today />}
        {page === "team" && <Team />}
        {page === "notes" && <Notes />}
        {page === "checks" && <Checks />}
        {page === "insights" && <Insights />}
        {page === "settings" && <Settings />}
      </main>

      <button className="fab" onClick={() => overlay({ kind: "interaction" })} aria-label="Log a visit">
        <Plus size={24} />
      </button>
      <nav className="tabbar">
        {nav.map((n) => (
          <button key={n.page} className={page === n.page ? "on" : ""} onClick={() => setPage(n.page)}>
            <span className="tb-ic">
              {n.icon}
              {!!n.badge && <span className="dot" />}
            </span>
            {n.label}
          </button>
        ))}
      </nav>
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </div>
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
