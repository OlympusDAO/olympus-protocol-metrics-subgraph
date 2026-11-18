#!/usr/bin/env node
import { spawn } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const log = (message) => appendFileSync("events", `${message}\n`);

if (args[0] === "worker") {
  process.on("SIGTERM", async () => {
    await delay(100);
    log("worker stopped");
    process.exit(0);
  });
  log("worker started");
  setInterval(() => {}, 1000);
} else if (args[0] === "start") {
  log(`start ${args.slice(1).join(" ")}`);
  if (!existsSync("bounded")) {
    const worker = spawn(process.execPath, [fileURLToPath(import.meta.url), "worker"], {
      stdio: "inherit",
    });
    process.on("SIGTERM", () => {
      log("start stopping");
    });
    worker.once("exit", () => {
      log("start stopped");
      process.exit(0);
    });
  }
} else {
  log(`migration ${args.join(" ")}`);
  while (existsSync("hold")) await delay(50);
  if (existsSync("fail")) process.exit(2);
}
