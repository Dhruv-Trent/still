# Contributing

Use Node.js 24 LTS. Install with `npm ci`, copy `.env.example` to `.env.local`, and follow README setup. Use a development Supabase project; never test destructive workflows against production users.

Keep UI, date logic, local synchronization, validation and database mutations separate. Use strict TypeScript, accessible semantic controls and existing design tokens. Never accept a browser-supplied owner ID as authorization. Every schema change needs a migration and cross-user tests. Existing published migrations are immutable; add a new forward migration.

Run `npm run format`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and Playwright for affected flows. Use meaningful regression tests for synchronization, recurrence, authorization and reminders. Add a real-provider check where mocks cannot prove behavior. Document skipped checks and limitations in the PR.

Submit a focused PR explaining the concrete problem, changed behavior, validation and risks. Include mobile/desktop screenshots for UI changes using only disposable task data. Do not commit environment files, test credentials, browser sessions, database backups or private task content. Contributions are under the MIT License.
