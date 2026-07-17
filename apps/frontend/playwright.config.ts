import { defineConfig } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: path.resolve(__dirname, "..", "..", "e2e", "tests"),
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["html", { outputFolder: "../e2e/report" }], ["list"]],
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "on",
    video: "off",
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
