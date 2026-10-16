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

Home is a **pipeline board**: every business is a card moving left to right
through Linq's stages — Talked → Signed up → Verified → Pay link → First
payment → Regular. Column colour runs red → green (green is money). Each card
shows what's blocking it and has a → button for its next step. A "biggest
leak" callout filters the board to stuck businesses.

| Page | Who | What |
|---|---|---|
| Pipeline | everyone | The board, last-7-days numbers, agent filter |
| Today | everyone | Who to chase: overdue, today, coming up |
| Team | master | Agent cards with stage spread, add/pause agents |
| Notes | everyone | Market notes feed: merchant's words vs agent's take |
| Checks | master | Tiered KYB queue (approve, reject, retry CAC) |
| Insights | everyone | Stage flow, objections, competitors, retention, markets |

"Viewing as" in the top bar switches between the master and any agent.

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
- `src/pages.tsx` — pages; `src/App.tsx` — top bar, phone tab bar, routing

When a backend arrives, `store.tsx` is the seam: swap the reducer's actions for
API calls and keep the pages as they are.
