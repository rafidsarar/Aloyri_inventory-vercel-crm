# Aloyri CRM deployment source

Primary GitHub repository: `rafidsarar/Aloyri_inventory-vercel-crm`.

Vercel production is connected to the `main` branch of this repository. Changes should pass CRM CI before promotion to production.

Keep deployment retries out of source code: do not add docs-only or no-op files solely to trigger Vercel. Retry or redeploy from the existing Git/Vercel deployment flow instead.
