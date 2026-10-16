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

| Mode | Pages |
|---|---|
| Master | Overview, Agents (add/pause), Businesses, Verification (KYB review queue), Funnel, Follow-ups, Field intel, Territory |
| Agent | Field workspace, My businesses, Follow-ups, Field notes, My stats, My history |

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
- `src/pages.tsx` — pages; `src/App.tsx` — shell and navigation

When a backend arrives, `store.tsx` is the seam: swap the reducer's actions for
API calls and keep the pages as they are.
