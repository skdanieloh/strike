#!/usr/bin/env node
import { chromium } from "playwright-core";

const CLIENT_ID = "134464708973-r7il3pe2jrppk298bu965073mbf85thq";
const REDIRECTS = [
  "https://strike-rosy.vercel.app/api/auth/callback/google",
  "http://localhost:3000/api/auth/callback/google",
];
const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const browser = await chromium.connectOverCDP(CDP);
  const context = browser.contexts()[0] || (await browser.newContext());
  const page = context.pages()[0] || (await context.newPage());

  const url = `https://console.cloud.google.com/auth/clients/${CLIENT_ID}?project=expedition-14546`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await sleep(6000);

  const confirm = page.getByRole("button", { name: "확인" }).first();
  if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirm.click();
    await sleep(800);
  }

  let bodyText = await page.locator("body").innerText();
  if (bodyText.includes("로그인") || bodyText.includes("Sign in")) {
    throw new Error("Google(아빠 프로필) 로그인이 필요합니다.");
  }

  const allInputs = page.locator('input[placeholder="https://www.example.com"]');
  const addRedirectBtn = page.locator("button").filter({ hasText: "URI 추가" }).nth(1);

  for (const uri of REDIRECTS) {
    if (bodyText.includes(uri)) {
      console.log("OK redirect:", uri);
      continue;
    }
    await addRedirectBtn.click();
    await sleep(600);
    const count = await allInputs.count();
    await allInputs.nth(count - 1).fill(uri);
    console.log("Added redirect:", uri);
    bodyText = await page.locator("body").innerText();
  }

  // Fix duplicate JS origins blocking Save
  const n = await allInputs.count();
  const seen = new Set();
  for (let i = 0; i < Math.min(n, 5); i++) {
    const val = (await allInputs.nth(i).inputValue()).trim();
    if (!val) {
      await allInputs.nth(i).fill("https://strike-rosy.vercel.app");
      continue;
    }
    if (seen.has(val)) {
      await allInputs.nth(i).fill("https://strike-rosy.vercel.app");
    }
    seen.add(val);
  }

  const save = page.getByRole("button", { name: "저장" });
  if (!(await save.isDisabled())) {
    await save.click();
    await sleep(3000);
    console.log("GCP OAuth client saved (아빠/uxidesigner).");
  } else {
    console.log("GCP redirects already configured (Save disabled = no changes).");
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
