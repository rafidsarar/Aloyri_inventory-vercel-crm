# Skinventory CRM — Vercel edition

Independent CRM website with its own email and password login. It runs on Vercel with a Neon Postgres database. Roles: owner, sales employee, inventory manager, and viewer. Only the owner can manage staff and import a backup. The app does not use ChatGPT authentication.

## Deploy from GitHub to Vercel

1. Push the contents of this folder to your own GitHub repository. Keep `DATABASE_URL`, `BOOTSTRAP_SECRET`, customer backups, and `.env.local` out of GitHub.
2. Create a Vercel project from that repository. Framework preset: **Next.js**. Root directory: repository root (or this folder if this project is in a larger repository). Use Node.js 22 or newer. Build command: `pnpm build` (Vercel can detect the framework default). The repository includes `pnpm-lock.yaml`.
3. In Vercel's Storage/Marketplace, connect a **Neon Postgres** database to the project. Confirm the project has a server-side `DATABASE_URL` environment variable for Production, with the Neon Postgres connection string. In the Neon SQL Editor for that database, run `sql/001_init.sql` once. This creates the required tables.
4. Generate a setup key (`openssl rand -hex 32`) and add it to Vercel project environment variables as `BOOTSTRAP_SECRET` for Production. Do not expose it through a `NEXT_PUBLIC_` variable. Redeploy after environment variables are set.
5. Open `https://<your-project>.vercel.app/setup`, enter the setup key, owner email and a password of 12–128 characters. Setup succeeds only once. Then log in at `/login`.
6. In **Manage staff**, invite sales employees and inventory managers. Privately send their one-time invitation links; links expire after seven days. Add your own domain under Vercel **Settings → Domains** if desired.

Uploading the ZIP itself is not the recommended Vercel workflow; import a GitHub repository containing the extracted source. Neither GitHub nor Vercel automatically supplies a Postgres database or the secret setup key.

## Transfer existing CRM records

The archive has no live customer records. In the existing private Skinventory site, the owner can use **Download full backup**. On the new site, use **Import records** before making any new records. The import accepts a fresh, empty workspace only. Compare product, customer, and order counts after the move. Keep the downloaded backup private.

## Local development

Create a Neon development database and run `sql/001_init.sql` in its SQL Editor. Create `.env.local` containing `DATABASE_URL=postgresql://...` and `BOOTSTRAP_SECRET=<a different random key>`. Run `pnpm install --frozen-lockfile`, `pnpm dev`, and open `/setup`. To check the build, run `pnpm build`. Keep development and production databases separate.

## Security and recovery

Passwords are salted PBKDF2-SHA256 hashes; sessions are backed by revocable database records and HttpOnly cookies. Staff access is checked on the server. Back up the Neon database and retain access to your Neon and Vercel accounts. If an owner loses their password, account recovery requires an administrative database procedure; `/setup` cannot create a second owner.
