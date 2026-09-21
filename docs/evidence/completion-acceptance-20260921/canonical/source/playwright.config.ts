import { defineConfig } from "@playwright/test";

const baseURL = process.env.OPF_APP_URL ?? "http://127.0.0.1:4325";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  reporter: "list",
  timeout: 45_000,
  use: {
    baseURL,
    browserName: "chromium",
    channel: process.platform === "win32" ? "msedge" : undefined,
    viewport: { width: 1440, height: 1000 },
    permissions: ["clipboard-read", "clipboard-write"],
    trace: "retain-on-failure",
    storageState: process.env.OPF_BROWSER_STORAGE_STATE,
  },
  webServer: process.env.OPF_APP_URL ? undefined : {
    command: "pnpm start --hostname 127.0.0.1 --port 4325",
    url: `${baseURL}/inspector`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
