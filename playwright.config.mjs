import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir:'./e2e',
  testIgnore:['**/live-production-usability.spec.mjs'],
  fullyParallel:false,
  retries:0,
  timeout:120000,
  workers:1,
  reporter:'line',
  use:{
    baseURL:'http://127.0.0.1:3100',
    trace:'retain-on-failure'
  },
  webServer:{
    command:'pnpm dev --hostname 127.0.0.1 --port 3100',
    url:'http://127.0.0.1:3100/e2e',
    reuseExistingServer:false,
    timeout:120000,
    env:{...process.env,E2E_TEST_MODE:'1'}
  }
});
