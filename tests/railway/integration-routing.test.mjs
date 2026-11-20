import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { expect, test, vi } from "vitest";
import images from "../../.railway/images.json";

test.each([
  "integration",
  "moved-tag",
  "missing-iid",
  "wrong-iid",
  "mismatched-inspect",
  "owned-finding",
  "provider-finding",
  "provider-error",
  "shared-integration",
  "missing-shared-iid",
  "failed-shared-build",
])("canonical image provenance: %s", async (scenario) => {
  const imageID = `sha256:${"b".repeat(64)}`;
  const movedID = `sha256:${"c".repeat(64)}`;
  const invalidIID = [
    "missing-iid",
    "wrong-iid",
    "mismatched-inspect",
    "missing-shared-iid",
    "failed-shared-build",
  ].includes(scenario);
  const provider = scenario.startsWith("provider");
  const failed = invalidIID || ["owned-finding", "provider-error"].includes(scenario);
  const execFileSync = vi.fn((command, args) => {
    if (command === "git") return args[0] === "rev-parse" ? "fixture-head" : "";
    if (command === "mise") return JSON.stringify({ Version: "0.76.2" });
    if (args[0] === "image") {
      const tagMoved = Object.values(images.built).includes(args[2]) && scenario !== "integration";
      const id = tagMoved || scenario === "mismatched-inspect" ? movedID : imageID;
      return JSON.stringify([{ Id: id, RepoDigests: [], Os: "linux", Architecture: "arm64" }]);
    }
    return args[0] === "context" ? "fixture-context" : JSON.stringify("fixture-daemon");
  });
  const spawn = vi.fn((command, args) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    setImmediate(() => {
      if (
        command === "pnpm" &&
        args[1]?.startsWith("docker:build:") &&
        scenario === "failed-shared-build"
      ) {
        child.emit("close", 1, null);
        return;
      }
      if (
        command === "pnpm" &&
        args[1]?.startsWith("docker:build:") &&
        scenario !== "missing-iid"
      ) {
        const file = args[args.indexOf("--iidfile") + 1];
        if (args.includes("--iidfile"))
          writeFileSync(file, scenario === "wrong-iid" ? "not-an-iid" : imageID);
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
  const iidDirectory = ["shared-integration", "missing-shared-iid", "failed-shared-build"].includes(
    scenario,
  )
    ? mkdtempSync(join(tmpdir(), "metrics-ci-iids-"))
    : undefined;
  if (iidDirectory && scenario !== "missing-shared-iid") {
    for (const name of Object.keys(images.built))
      writeFileSync(join(iidDirectory, `build-${name}.iid`), imageID);
  }
  vi.stubEnv("METRICS_IMAGE_IID_DIR", iidDirectory);
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
        : ["integration", "shared-integration", "missing-shared-iid"].includes(scenario)
          ? "integration"
          : "all",
    ];
    await import("../../scripts/validate.mjs");
    const evidence = log.mock.calls
      .find(([line]) => line.startsWith("Validation evidence: "))[0]
      .slice("Validation evidence: ".length);
    const report = JSON.parse(readFileSync(`${evidence}/report.json`, "utf8"));
    expect(report.status).toBe(failed ? "failed" : provider ? "completed-advisory" : "passed");
    if (!["integration", "shared-integration"].includes(scenario)) {
      const inspections = execFileSync.mock.calls.filter(
        ([command, args]) => command === "docker" && args[0] === "image",
      );
      expect(inspections.every(([, args]) => !Object.values(images.built).includes(args[2]))).toBe(
        true,
      );
      const scans = spawn.mock.calls.filter(
        ([command, args]) => command === "mise" && args.includes("image"),
      );
      expect(scans).toHaveLength(invalidIID ? 0 : provider ? 1 : 5);
      expect(scans.every(([, args]) => args.at(-1) === imageID)).toBe(true);
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
    if (invalidIID || provider) {
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
      RPC_CACHE_IMAGE: imageID,
      CONTAINER_RUNTIME: "docker",
    });
    for (const [, , options] of spawn.mock.calls.filter(
      ([, args]) =>
        args.includes("test:rpc-cache") || args.includes("tests/integration/runtime.test.mjs"),
    )) {
      expect(JSON.parse(options.env.METRICS_INTEGRATION_IMAGES)).toEqual(
        Object.fromEntries(Object.keys(images.built).map((name) => [name, imageID])),
      );
    }
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
    if (iidDirectory) rmSync(iidDirectory, { recursive: true, force: true });
  }
});
