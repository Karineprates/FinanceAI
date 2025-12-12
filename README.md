# FinanceAI Dashboard

![FinanceAI Dashboard screenshot](./assets/financeai-dashboard.png)

FinanceAI Dashboard is a lightweight React + Vite financial panel that combines filters, lazy-loaded charts, and locally computed insights so you can manage income and expenses without relying on external APIs.

## Highlights
- Local persistence for transactions, filters, and theme preferences.
- Local insights that adapt to the current filters, surface alerts, and show generation time inside the dashboard.
- Reliable import/export flows for CSV and JSON (with validation and deduplication) plus backup/restore with metadata.
- Lazy-loaded charts and goals keep the bundle small while still visualizing monthly series, categories, and balance trends.
- Responsive UX with table/card views and a hamburger menu for quick actions.

## Key features
1. Create and edit entries and exits, choose categories, enter values and notes, and filter or search by month, category, or date range.
2. Persistent history with sorting, highlights, and inline edit/delete controls.
3. CSV and JSON export plus advanced import (2 MB or 2000-line limits, field validation, duplicate filtering).
4. Backup and restore operations that ship metadata for easy handoff.
5. Local insights that explain the balance, highlight alerts, and suggest next steps without leaving the browser.
6. Chart section (monthly series, categories, balance trend) with configurable goals and React.lazy loading.

## Stack
- React 19, TypeScript, and Vite
- Zustand for state management and Recharts for charts (loaded dynamically)
- Papa Parse plus custom utils for CSV/JSON import and export
- Insights live in src/utils/ai.ts and receipt parsing lives in src/utils/receiptParser.ts

## Getting started
```bash
npm install
npm run dev -- --force       # development server
npm run build                # production build
```

## Useful scripts
- `npm run dev` - run the dev server with hot reload
- `npm run build` - bundle TypeScript and Vite for production
- `npm run preview` - serve the production build locally
- `npm run lint` - run the linter
- `npm test` - run Vitest unit tests
- `npm run test:e2e` - run Playwright E2E tests (run `npx playwright install --with-deps` first)

## CI and deploy
- GitHub Actions workflow runs `npm run lint`, `npm test`, and `npm run build`.
- Deploy to Vercel or Netlify by running `npm run build` and publishing the dist folder.

## Security and env vars
- No API keys are required; `.env.example` stays empty and `.env.local` is ignored by default.
- Never commit secrets; keep configuration in the ignored `.env.local`.

## Next steps
1. Add Playwright E2E to CI (`npm run test:e2e` after `npx playwright install --with-deps`).
2. Customize goals and filters via localStorage.
3. Update `assets/financeai-dashboard.png` every time the UI changes.
