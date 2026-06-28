#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const profileMap = {
  abbah: "Profile 1",
  seung: "Default",
  "Profile 1": "Profile 1",
  Default: "Default",
};

const key = process.argv[2] || "abbah";
const port = process.argv[3] || "9222";
const url = process.argv[4] || "about:blank";
const profileDir = profileMap[key] || key;

const chromeRoot = join(homedir(), "Library/Application Support/Google/Chrome");
const tmpRoot = join("/tmp", `strike-chrome-${key}`);

if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true, force: true });
mkdirSync(tmpRoot, { recursive: true });
cpSync(join(chromeRoot, "Local State"), join(tmpRoot, "Local State"));
cpSync(join(chromeRoot, profileDir), join(tmpRoot, profileDir), { recursive: true });

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
spawn(
  chrome,
  [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpRoot}`,
    `--profile-directory=${profileDir}`,
    "--no-first-run",
    url,
  ],
  { detached: true, stdio: "ignore" }
).unref();

console.log(`Chrome ${key} (${profileDir}) → port ${port}`);
