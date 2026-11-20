import { EventEmitter } from "node:events";
import { readFileSync, rmSync } from "node:fs";
import { PassThrough } from "node:stream";
import { expect, test, vi } from "vitest";
import images from "../../.railway/images.json";

test.each([
  "integration",
  "missing-image",
  "failed-build",
  "owned-finding",
  "provider-finding",
  "provider-error",
])("canonical image routing: %s", async (scenario) => {
  const provider = scenario.startsWith("provider");
  const failed = ["missing-image", "failed-build", "owned-finding", "provider-error"].includes(
    scenario,
  );
  const execFileSync = vi.fn((command, args) => {
    if (command === "git") return args[0] === "rev-parse" ? "fixture-head" : "";
    if (command === "mise") return JSON.stringify({ Version: "0.76.2" });
    if (args[0] === "image") {
      if (scenario === "missing-image") throw new Error("No such image");
      return JSON.stringify([
        { Id: "fixture-image", RepoDigests: [], Os: "linux", Architecture: "arm64" },
      ]);
    }
    return args[0] === "context" ? "fixture-context" : JSON.stringify("fixture-daemon");
  });
  const spawn = vi.fn((command, args) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    setImmediate(() => {
      if (scenario === "failed-build" && command === "pnpm" && args[1] === "docker:build:indexer") {
        child.emit("close", 1, null);
        return;
      }
      const scan = command === "mise" && args.includes("image");
      const code =
        scan && scenario === "provider-error"
          ? 2
          : scan && ["owned-finding", "provider-finding"].includes(scenario)
            ? Number(args[args.indexOf("--exit-code") + 1])
            : 0;
      child.emit("close", code, null);
    });
    return child;
  });
  vi.doMock("node:child_process", () => ({ execFileSync, spawn }));
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const argv = process.argv;
  const exitCode = process.exitCode;
  vi.stubEnv("RPC_CACHE_IMAGE", "unrelated:caller-image");
  vi.stubEnv("CONTAINER_RUNTIME", "podman");
  vi.stubEnv("TRIVY_EXIT_CODE", "19");
  vi.stubEnv("TRIVY_IGNORE_UNFIXED", provider ? "true" : "false");
  try {
    vi.resetModules();
    process.argv = [
      process.execPath,
      "scripts/validate.mjs",
      provider
        ? "provider"
        : ["failed-build", "owned-finding"].includes(scenario)
          ? "all"
          : "integration",
    ];
    await import("../../scripts/validate.mjs");
    const evidence = log.mock.calls
      .find(([line]) => line.startsWith("Validation evidence: "))[0]
      .slice("Validation evidence: ".length);
    const report = JSON.parse(readFileSync(`${evidence}/report.json`, "utf8"));
    expect(report.status).toBe(failed ? "failed" : provider ? "completed-advisory" : "passed");
    if (scenario === "owned-finding")
      expect(report.steps.slice(0, 8).map(({ command }) => command)).toEqual([
        ["pnpm", "install", "--frozen-lockfile"],
        ...["check:runtime-versions", "codegen", "check", "typecheck", "build", "test"].map(
          (script) => ["pnpm", "run", script],
        ),
        ["pnpm", "audit", "--audit-level", "moderate"],
      ]);
    if (scenario === "failed-build") {
      // The inspect mock still offers the old local tag; a failed build must not use it.
      expect(report.groups.find(({ name }) => name === "integration")).toMatchObject({
        status: "failed",
        error: expect.stringMatching(/not run.*build failed/),
      });
      expect(spawn.mock.calls.some(([, args]) => args[0] === "pull")).toBe(false);
      expect(
        spawn.mock.calls.some(
          ([, args]) =>
            args.includes("test:rpc-cache") || args.includes("tests/integration/runtime.test.mjs"),
        ),
      ).toBe(false);
      expect(
        execFileSync.mock.calls.some(
          ([command, args]) =>
            command === "docker" && args[0] === "image" && args[2] === images.built.indexer,
        ),
      ).toBe(false);
      expect(process.exitCode).toBe(1);
      return;
    }
    if (provider || scenario === "owned-finding") {
      const scans = spawn.mock.calls.filter(
        ([command, args]) => command === "mise" && args.includes("image"),
      );
      expect(scans.map(([, args]) => args.at(-1))).toEqual(
        Object.values(provider ? images.provider : images.built),
      );
      for (const [, args] of scans) {
        for (const [flag, value] of [
          ["--scanners", provider ? "vuln" : "vuln,secret"],
          ["--format", "table"],
          ["--output", ""],
          ["--input", ""],
          ["--exit-code", provider ? "0" : "1"],
          ["--ignorefile", provider ? "/dev/null" : ".trivyignore"],
          ["--severity", provider ? "UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL" : "MEDIUM,HIGH,CRITICAL"],
        ])
          expect(args[args.indexOf(flag) + 1]).toBe(value);
        expect(args).toContain(`--ignore-unfixed=${!provider}`);
      }
    }
    const call = spawn.mock.calls.find(
      ([command, args]) => command === "pnpm" && args[1] === "test:rpc-cache",
    );
    if (scenario === "missing-image" || provider) {
      expect(call).toBeUndefined();
      if (provider)
        expect(
          spawn.mock.calls.filter(([command]) => command === "docker").map(([, args]) => args),
        ).toEqual([
          ["info", "--format", "{{.ServerVersion}}"],
          ["pull", images.provider["postgres-production"]],
        ]);
      return;
    }
    expect(call?.[2].env).toMatchObject({
      RPC_CACHE_IMAGE: images.built["rpc-cache"],
      CONTAINER_RUNTIME: "docker",
    });
    expect(
      execFileSync.mock.calls.some(
        ([command, args]) => command === "docker" && args[0] === "image",
      ),
    ).toBe(true);
  } finally {
    process.argv = argv;
    process.exitCode = exitCode;
    const evidence = log.mock.calls
      .find(([line]) => line.startsWith("Validation evidence: "))?.[0]
      .slice("Validation evidence: ".length);
    log.mockRestore();
    error.mockRestore();
    vi.unstubAllEnvs();
    vi.doUnmock("node:child_process");
    if (evidence) rmSync(evidence, { recursive: true, force: true });
  }
});
