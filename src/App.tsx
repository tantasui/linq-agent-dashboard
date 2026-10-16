import {
  BarChart3,
  CheckSquare,
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
  Zap,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { startOfDay } from "./derive";
import { OverlayProvider, useOverlay } from "./overlays";
import { Agents, FieldIntel, FollowUps, Funnel, Merchants, MyHistory, Overview, Settings, Territory, Verification, Workspace, type Page } from "./pages";
import { DAY } from "./seed";
import { StoreProvider, useScope, useStore, type Mode } from "./store";
import { LinqMark } from "./ui";

type NavItem = { page: Page; label: string; icon: ReactNode; badge?: number; disabled?: boolean };

const TITLES: Record<Page, string> = {
  overview: "Overview",
  agents: "Agents",
  merchants: "Businesses",
  verification: "Verification",
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

function readHash(): { mode: Mode; page: Page } | null {
  const [mode, page] = location.hash.replace(/^#\/?/, "").split("/");
  if ((mode === "master" || mode === "agent") && page && page in TITLES) return { mode, page: page as Page };
  return null;
}

function Shell() {
  const { data, mode, setMode, actingAgentId, setActingAgentId, toastMsg } = useStore();
  const scope = useScope();
  const [page, setPage] = useState<Page>(() => readHash()?.page ?? "overview");
  const [menu, setMenu] = useState(false);
  const overlay = useOverlay();

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
    const next = `#/${mode}/${page}`;
    if (location.hash !== next) history.replaceState(null, "", next);
    window.scrollTo(0, 0);
    overlay(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, page]);

  const go = (p: Page) => {
    setPage(p);
    setMenu(false);
  };
  const switchMode = (m: Mode) => {
    setMode(m);
    setPage(HOME[m]);
    setMenu(false);
  };
  useEffect(() => {
    if (mode === "agent" && !AGENT_PAGES.includes(page)) setPage("workspace");
  }, [mode, page]);

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
              { page: "verification", label: "Verification", icon: <ShieldCheck size={17} />, badge: review },
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
            label: "Field",
            items: [
              { page: "workspace", label: "Field workspace", icon: <Zap size={17} /> },
              { page: "merchants", label: "My businesses", icon: <Store size={17} /> },
              { page: "followups", label: "Follow-ups", icon: <CheckSquare size={17} />, badge: openFu },
              { page: "intel", label: "Field notes", icon: <Lightbulb size={17} /> },
              { page: "funnel", label: "My stats", icon: <BarChart3 size={17} /> },
              { page: "history", label: "My history", icon: <History size={17} /> },
            ],
          },
        ];

  const agents = data.agents.filter((a) => a.status === "active");
  const title = mode === "agent" && page === "merchants" ? "My businesses" : mode === "agent" && page === "funnel" ? "My stats" : TITLES[page];

  return (
    <>
      <div className="demo-banner">Demo with sample data — try anything, it only saves in your browser.</div>
      <div className="shell">
        {menu && <div className="side-scrim" onClick={() => setMenu(false)} />}
        <nav className={`side ${menu ? "open" : ""}`}>
          <div className="brand">
            <LinqMark size={30} />
            <div>
              Linq Field
              <small>B2B sales</small>
            </div>
          </div>
          <div className="mode" role="tablist">
            <button className={mode === "master" ? "on" : ""} onClick={() => switchMode("master")}>Master</button>
            <button className={mode === "agent" ? "on" : ""} onClick={() => switchMode("agent")}>Agent</button>
          </div>
          {mode === "agent" && (
            <label className="field">
              <span style={{ paddingLeft: 4 }}>Signed in as</span>
              <select className="select" value={actingAgentId} onChange={(e) => setActingAgentId(e.target.value)}>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
          )}
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
