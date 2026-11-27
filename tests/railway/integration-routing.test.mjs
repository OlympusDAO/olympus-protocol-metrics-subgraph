import { EventEmitter } from "node:events";
import { readFileSync, rmSync } from "node:fs";
import { PassThrough } from "node:stream";
import { expect, test, vi } from "vitest";
import images from "../../.railway/images.json";

test.each([
  ["integration", "integration", "passed"],
  ["context-precedence", "images", "passed"],
  ["missing-image", "integration", "failed"],
  ["failed-build", "all", "failed"],
  ["setup-abort", "all", "failed"],
  ["owned-finding", "all", "failed"],
  ["provider-finding", "provider", "completed-advisory"],
  ["provider-error", "provider", "failed"],
])("canonical image routing: %s", async (scenario, mode, status) => {
  const provider = mode === "provider";
  const execFileSync = vi.fn((command, args) => {
    if (command === "git") return args[0] === "rev-parse" ? "fixture-head" : "";
    if (command === "mise") return JSON.stringify({ Version: "0.76.2" });
    if (args[0] === "image") {
      if (scenario === "missing-image" && args[2] === images.built.indexer)
        throw new Error("No such image");
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
      if (scenario === "setup-abort" && command === "mise" && args[0] === "install") {
        child.emit("close", 2, null);
        return;
      }
      if (scenario === "failed-build" && command === "pnpm" && args[1] === "build:docker:indexer") {
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
  if (scenario === "context-precedence") {
    vi.stubEnv("DOCKER_CONTEXT", "fixture-context");
    vi.stubEnv("DOCKER_HOST", "unix:///fixture-other-daemon");
  }
  vi.stubEnv("TRIVY_IGNORE_UNFIXED", provider ? "true" : "false");
  try {
    vi.resetModules();
    process.argv = [process.execPath, "scripts/validate.mjs", mode];
    await import("../../scripts/validate.mjs");
    const evidence = log.mock.calls
      .find(([line]) => line.startsWith("Validation evidence: "))[0]
      .slice("Validation evidence: ".length);
    const report = JSON.parse(readFileSync(`${evidence}/report.json`, "utf8"));
    if (scenario === "missing-image")
      expect(execFileSync).toHaveBeenCalledWith(
        "docker",
        ["image", "inspect", images.built.indexer],
        { encoding: "utf8" },
      );
    expect(report.status).toBe(status);
    if (scenario === "context-precedence") {
      const scans = spawn.mock.calls.filter(
        ([command, args]) => command === "mise" && args.includes("image"),
      );
      expect(scans).toHaveLength(Object.keys(images.built).length);
      for (const [, , options] of scans) expect(options.env.DOCKER_HOST).toBeUndefined();
      expect(process.env.DOCKER_HOST).toBe("unix:///fixture-other-daemon");
      return;
    }
    if (scenario === "owned-finding")
      expect(report.steps.slice(0, 8).map(({ command }) => command)).toEqual([
        ["pnpm", "install", "--frozen-lockfile"],
        ...["check:runtime-versions", "codegen", "check", "typecheck", "build", "test"].map(
          (script) => ["pnpm", "run", script],
        ),
        ["pnpm", "audit", "--audit-level", "moderate"],
      ]);
    if (scenario === "failed-build" || scenario === "setup-abort") {
      // Old local tags remain available; incomplete builds must not use them.
      expect(report.groups.find(({ name }) => name === "integration")).toMatchObject({
        status: "failed",
        error: expect.stringMatching(/Integration not run/),
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
      expect(process.exitCode).toBe(scenario === "setup-abort" ? 2 : 1);
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
        expect(args.filter((arg) => arg.startsWith("--ignore-unfixed"))).toEqual(
          provider ? ["--ignore-unfixed=false"] : [],
        );
        expect(args.includes("--image-config-scanners")).toBe(!provider);
        if (!provider) expect(args[args.indexOf("--image-config-scanners") + 1]).toBe("secret");
      }
    }
    const call = spawn.mock.calls.find(
      ([command, args]) => command === "pnpm" && args[1] === "test:rpc-cache",
    );
    if (scenario === "missing-image" || provider) {
      expect(call).toBeUndefined();
      expect(spawn).not.toHaveBeenCalledWith(
        process.execPath,
        ["--test", "tests/integration/runtime.test.mjs"],
        expect.anything(),
      );
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
    const runtimeIndex = spawn.mock.calls.findIndex(
      ([command, args]) =>
        command === process.execPath &&
        args[0] === "--test" &&
        args[1] === "tests/integration/runtime.test.mjs",
    );
    expect(runtimeIndex).toBeGreaterThan(spawn.mock.calls.indexOf(call));
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
