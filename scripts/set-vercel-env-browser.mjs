#!/usr/bin/env node
import { chromium } from "playwright-core";

const CDP = process.env.CDP_URL || "http://127.0.0.1:9223";
const AUTH_SECRET = process.env.AUTH_SECRET;
const AUTH_GOOGLE_ID = process.env.AUTH_GOOGLE_ID;
const AUTH_GOOGLE_SECRET = process.env.AUTH_GOOGLE_SECRET;

if (!AUTH_SECRET || !AUTH_GOOGLE_ID || !AUTH_GOOGLE_SECRET) {
  console.error("Set AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET env vars.");
  process.exit(1);
}

const ENV_VARS = [
  ["AUTH_SECRET", AUTH_SECRET],
  ["AUTH_GOOGLE_ID", AUTH_GOOGLE_ID],
  ["AUTH_GOOGLE_SECRET", AUTH_GOOGLE_SECRET],
];

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const browser = await chromium.connectOverCDP(CDP);
  const page =
    browser.contexts()[0].pages().find((p) => p.url().includes("vercel.com")) ||
    browser.contexts()[0].pages()[0];

  await page.goto(
    "https://vercel.com/skdanielohs-projects/strike/settings/environment-variables",
    { waitUntil: "domcontentloaded", timeout: 90000 }
  );
  await sleep(5000);

  for (const [key, value] of ENV_VARS) {
    const body = await page.locator("body").innerText();
    if (body.includes(key)) {
      console.log("OK:", key);
      continue;
    }
    await page.getByRole("button", { name: "Add Environment Variable" }).first().click();
    await sleep(700);
    await page.getByLabel("environment variable key").fill(key);
    await page.locator("textarea").first().fill(value);
    await page.getByRole("button", { name: "Save" }).click();
    await sleep(2500);
    console.log("Added:", key);
  }

  console.log("Vercel env done (승균/Default profile).");
  await browser.close();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
