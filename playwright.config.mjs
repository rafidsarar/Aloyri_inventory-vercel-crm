import { defineConfig } from '@playwright/test';

const useServerlessChromium=process.env.E2E_SERVERLESS_CHROMIUM==='1';
let launchOptions;
if(useServerlessChromium){
  const {default:serverlessChromium}=await import('@sparticuz/chromium');
  launchOptions={
    executablePath:await serverlessChromium.executablePath(),
    args:serverlessChromium.args.filter(arg=>arg!=='--single-process'),
  };
}

export default defineConfig({
  testDir:'./e2e',
  testIgnore:['**/live-production-usability.spec.mjs'],
  fullyParallel:false,
  retries:0,
  timeout:process.env.E2E_SERVERLESS_CHROMIUM==='1'?300000:120000,
  workers:1,
  reporter:'line',
  use:{
    baseURL:'http://127.0.0.1:3100',
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    ...(launchOptions?{launchOptions}:{})
  },
  webServer:{
    command:(process.env.E2E_PRODUCTION_BUILD==='1'?'pnpm start':'pnpm dev')+' --hostname 127.0.0.1 --port 3100',
    url:'http://127.0.0.1:3100/e2e',
    reuseExistingServer:false,
    timeout:120000,
    env:{...process.env,E2E_TEST_MODE:'1'}
  }
});
