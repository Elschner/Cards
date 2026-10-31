// Takes screenshots of the main pages (used by the Preview workflow).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.env.BASE_URL || "http://localhost:3000";
const auth = { username: process.env.APP_USERNAME || "admin", password: process.env.APP_PASSWORD || "" };
const pages = [
  ["overview", "/"],
  ["purchases", "/purchases"],
  ["purchase-detail", "/purchases/1"],
  ["inventory", "/inventory?status=ALL"],
  ["import", "/import"],
  ["intake", "/intake"],
  ["pick", "/pick"],
];
mkdirSync("screenshots", { recursive: true });
const browser = await chromium.launch();
for (const [w, h, suffix] of [[1440, 1000, "desktop"], [390, 844, "mobile"]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, httpCredentials: auth, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const [name, path] of pages) {
    if (suffix === "mobile" && !["overview", "inventory", "purchase-detail"].includes(name)) continue;
    const res = await page.goto(base + path, { waitUntil: "networkidle" });
    console.log(suffix, name, res?.status());
    await page.screenshot({ path: `screenshots/${suffix}-${name}.png`, fullPage: true });
  }
  await ctx.close();
}
await browser.close();
