# ALOYRI CRM — Vercel edition

Independent CRM website with its own email and password login. It runs on Vercel with a Neon Postgres database. Roles: owner, admin, sales employee, inventory manager, finance manager, and viewer. Admins can manage all business records, finances, settings, imports and exports. Only the owner can invite people, change roles, remove accounts or manage team access. The app does not use ChatGPT authentication.

## Deploy from GitHub to Vercel

1. Push the contents of this folder to your own GitHub repository. Keep `DATABASE_URL`, `BOOTSTRAP_SECRET`, customer backups, and `.env.local` out of GitHub.
2. Create a Vercel project from that repository. Framework preset: **Next.js**. Root directory: repository root (or this folder if this project is in a larger repository). Use Node.js 22 or newer. Build command is configured in `vercel.json` as `pnpm db:migrate && pnpm build`, so versioned database migrations run before the production build. The repository includes `pnpm-lock.yaml`.
3. In Vercel's Storage/Marketplace, connect a **Neon Postgres** database to the project. The app uses `SKINVENTORY_DB_DATABASE_URL` when connected with the `SKINVENTORY_DB` prefix, or `DATABASE_URL` for a manually configured database. The deployment migration runner creates the baseline schema and applies forward migrations automatically. `sql/001_init.sql` remains only as a legacy/manual bootstrap reference.
4. Generate a setup key (`openssl rand -hex 32`) and add it to Vercel project environment variables as `BOOTSTRAP_SECRET` for Production. Replace the public `.env.example` value; the app rejects it. Do not expose it through a `NEXT_PUBLIC_` variable. Redeploy after environment variables are set.
5. Open `https://<your-project>.vercel.app/setup`, enter the setup key, owner email and a password of 12–128 characters. Setup succeeds only once. Then log in at `/login`.
6. In **Manage staff**, invite admins, sales employees, inventory managers, finance managers and viewers. Privately send their one-time invitation links; links expire after seven days. Add your own domain under Vercel **Settings → Domains** if desired.

Schema changes are versioned under `sql/migrations/` and recorded in `crm_schema_migrations`. Do not run role-specific SQL manually on production unless recovering an older installation.

Uploading the ZIP itself is not the recommended Vercel workflow; import a GitHub repository containing the extracted source. Neither GitHub nor Vercel automatically supplies a Postgres database or the secret setup key.

## Transfer existing CRM records

The archive has no live customer records. In the existing private ALOYRI site, the owner can use **Download full backup**. On the new site, the owner or an admin can use **Import records** before making any new records. The import accepts a fresh, empty workspace only. Compare product, customer, and order counts after the move. Keep the downloaded backup private.

## Cashflow

Open **Finances → Cashflow** for dated cash in, cash out and net movement. Settled delivered orders count the payout after courier and payment fees on their settlement date; paid stock batches count their batch cost on the payment date; operating expenses count on their recorded date. Use **Record cash movement** for owner contributions, transfers and other payments, and avoid entering automatically counted movements twice. Older settled orders or paid batches without payment dates are excluded until their known movements are entered manually. Net cashflow is not a bank balance or operating profit.

## Account reconciliation

Open **Finances → Reconciliation** to track Cash, Bank, bKash and Nagad separately. Set each account's actual opening balance and date; that balance is measured before any transactions dated on the opening date. Earlier movements stay in Cashflow but are excluded from that account's ledger. Assign existing Cashflow movements to the account where the money actually moved, add a statement reference if useful and mark a movement matched only after checking the statement. A movement can be assigned to one account at a time; assigning it does not create another Cashflow entry. Enter a statement date and actual statement balance to compare it with the opening balance plus matched movements through that date. Unmatched movements are excluded from the statement comparison, while all assigned movements count toward the CRM account balance. A zero difference does not prove every movement has been entered or assigned. For a transfer between accounts, record separate cash-out and cash-in movements.

## Business profile and invoices

The business name is permanently ALOYRI. Open **Business settings** to edit the phone, email, address, optional registered BIN. Upload a PNG, JPG or WebP logo; it is resized in the browser before saving. **View invoice** now uses the ALOYRI customer-provided layout and wordmark, filling in the CRM's saved order, customer, products, delivery, discount and total. It prints or saves as a PDF. The template omits SKU, customer email, VAT/tax and partial-payment amounts because the CRM does not record them; it does not invent these values. The previous editable invoice footer and return-policy text are preserved in existing workspace data but are not shown on the new template. Business contact settings are editable by the owner and admins; changes affect future prints of older orders, while already downloaded PDFs are unchanged. Enter a BIN only when it belongs to the business. This is a customer invoice layout, not an automatic tax calculation.

## Local development

Create a Neon development database. Create `.env.local` containing `DATABASE_URL=postgresql://...` and `BOOTSTRAP_SECRET=<a different random key>`. Run `pnpm install --frozen-lockfile`, `pnpm db:migrate`, then `pnpm dev`, and open `/setup`. To check the build, run `pnpm build`. Keep development and production databases separate.

## Security

Passwords are salted PBKDF2-SHA256 hashes; sessions are backed by revocable database records and HttpOnly cookies. Staff access is checked on the server. Back up the Neon database and retain access to your Neon and Vercel accounts. `/setup` cannot create a second owner.

<!-- vercel reconnect deployment trigger -->
<!-- vercel git integration recheck 1790842919116 -->
<!-- vercel project binding recheck 1790843056314 -->
<!-- production management intelligence release -->
