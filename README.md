# FinanceAI Dashboard

Dashboard financeiro em React + Vite com gráficos (lazy-load), importação/exportação CSV/JSON, insights locais (sem depender de APIs externas) e persistência local.

## Stack
- React 19 + TypeScript + Vite
- Zustand (estado), Recharts (gráficos), Papa Parse (CSV)
- Insights calculados localmente em `src/utils/ai.ts`

## Rodando local
```bash
npm install
npm run dev -- --force       # dev server
npm run build                # build produção
```

## Deploy (Vercel / Netlify)
1. Suba o repo para GitHub.
2. Build command: `npm run build`
3. Output: `dist`

### Notas de segurança
- Não há dependência de chaves de API; `.env.example` permanece vazio.
- Não commitar chaves em `.env.local`.

## Funcionalidades principais
- Entradas/saídas com edição, filtros (mês, categoria, intervalo de datas, busca), persistência de filtros no `localStorage` e na URL.
- Importar/Exportar CSV e JSON (limite 2MB/2000 linhas, validação de campos), Backup/Restore com metadados; import deduplica registros.
- Insights locais com hora de geração, contexto dos filtros e botão de recalcular.
- Gráficos lazy-loaded, com meta configurável na tendência e no gráfico mensal.
- Menu hambúrguer para ações rápidas (import/export/backup) em qualquer tamanho de tela.

## Scripts
- `npm run dev` – dev server
- `npm run build` – build produção (tsc + Vite)
- `npm run preview` – servir build local
- `npm run lint` – lint
- `npm test` – testes unitários (Vitest)
- `npm run test:e2e` – testes E2E (Playwright; instale deps com `npx playwright install`)

## CI
- Workflow GitHub Actions roda `npm run lint`, `npm test` e `npm run build`. Etapas E2E podem ser habilitadas adicionando `npx playwright install --with-deps` e `npm run test:e2e`.
