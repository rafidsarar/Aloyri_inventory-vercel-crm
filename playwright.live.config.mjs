import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir:'./e2e',
  fullyParallel:false,
  retries:0,
  timeout:120000,
  workers:1,
  reporter:'line',
  use:{
    baseURL:process.env.LIVE_CRM_URL||'https://aloyriinventory-vercel-crm.vercel.app',
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    viewport:{width:1440,height:1000}
  }
});
