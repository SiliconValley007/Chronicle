import { defineConfig, devices } from "@playwright/test";
const launchOptions = process.env.CHROMIUM_PATH
  ? {
      executablePath: process.env.CHROMIUM_PATH,
      args: ["--no-sandbox", "--disable-gpu"],
    }
  : {};
export default defineConfig({
  testDir: "e2e",
  webServer: {
    command: "node scripts/serve.mjs",
    url: "http://localhost:4173/chronicle/",
    reuseExistingServer: true,
  },
  use: { baseURL: "http://localhost:4173/chronicle/", launchOptions },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions } },
    { name: "mobile", use: { ...devices["Pixel 5"], launchOptions } },
  ],
});
