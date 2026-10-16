# Linq Field — B2B field sales demo

Clickable demo of the dashboard for Linq B2B's field agents and their master
agent. **Frontend only, sample data.** Every change is saved in the viewer's
browser (localStorage) and nobody else sees it; Settings → Reset demo data
starts over.

## Run / build

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

## Host

It's a static site with hash routing (`#/master/overview`), so any static host
works with no rewrites:

- **Vercel:** `vercel --prod` from this folder (framework: Vite, output: `dist`)
- **Netlify:** build `npm run build`, publish `dist`
- Or drag the `dist/` folder into Netlify Drop

Links can point straight at a page, e.g. `/#/agent/workspace`.

## What's in it

The layout deliberately follows the field-sales tool our partner already uses
(sidebar, Master/Agent switch, same kinds of pages) so there's nothing new to
learn, with Linq's own additions on top.

| Mode | Pages |
|---|---|
| Master | Overview, Agents, Businesses, KYC checks, Funnel, Follow-ups, Field intel, Territory |
| Agent | Field workspace, My businesses, Follow-ups, Field intel, My stats, My history |

Linq additions: a "biggest leak" callout (where businesses are stuck, and
which ones), a List/Board toggle on Businesses, a blocker flag on every
business ("No bank yet", "KYB review", "Quiet 14d+"), follow-ups grouped into
overdue/today/coming up with a call button, a stage bar per agent, the tiered
KYB explainer, and a "biggest drop" sentence on the funnel.

Styling follows the Front-style DESIGN.md: aubergine canvas, lilac hairlines
instead of shadows, lilac-mist number cards, lime only on the primary action.

Demo-only controls (live, these come from Linq B2B automatically):
stage buttons on a business, "Simulate a payment", and the simulated Smile ID
checks. In the KYB modal: a NIN starting `000` isn't found, an account number
ending `0` resolves to someone else's name (goes to master review), a CAC number
ending `0` isn't found and ending `9` simulates the registry being down.

## Code map

- `src/types.ts` — data model and the fixed lists (markets, objections, competitors)
- `src/seed.ts` — deterministic sample data
- `src/derive.ts` — funnel maths and the follow-up rules
- `src/store.tsx` — state, persisted to localStorage
- `src/overlays.tsx` — modals and drawers (interaction, note, KYB, agent, business)
- `src/pages.tsx` — pages; `src/App.tsx` — sidebar shell and routing

When a backend arrives, `store.tsx` is the seam: swap the reducer's actions for
API calls and keep the pages as they are.
