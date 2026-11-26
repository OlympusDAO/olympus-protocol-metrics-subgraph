import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "vitest";
import { parse } from "yaml";

const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
const required = [255339842, "audit.yml"];

function releaseModule(sandbox) {
  const module = { exports: {} };
  vm.runInNewContext(readFileSync("scripts/railway-release.cjs", "utf8"), {
    ...sandbox,
    module,
  });
  return module.exports;
}

async function runWorkflowGate(script, sandbox) {
  const release = releaseModule({
    ...sandbox,
    require(name) {
      assert.fail(`Read-only gates must not load ${name}`);
    },
  });
  return vm.runInNewContext(`(async () => {${script}\n})()`, {
    ...sandbox,
    require(name) {
      assert.equal(name, "./scripts/railway-release.cjs");
      return release;
    },
  });
}

async function runGate(
  response,
  checks = [{ status: "completed", conclusion: "success" }],
  statuses = [],
  branchHead = "merged-release",
) {
  const match = workflow.match(
    / {6}- name: Wait for external checks\n[\s\S]*? {10}script: \|\n([\s\S]*?)(?=^ {6}- name:)/m,
  );
  assert(match, "production apply must wait for merge CI");
  const calls = [];
  const attempts = new Map();
  let statusReads = 0;
  const script = match[1].replace(/^ {12}/gm, "");
  const sandbox = {
    process: { env: { MERGE_COMMIT_SHA: "merged-release" } },
    context: {
      repo: { owner: "fixture", repo: "fixture" },
      runId: 42,
      sha: "merged-release",
    },
    core: { info() {} },
    setTimeout(resolve) {
      resolve();
    },
    github: {
      async paginate(method, args) {
        assert.equal(args.ref, "merged-release");
        if (method === "statuses")
          return typeof statuses === "function" ? statuses(statusReads++) : statuses;
        return checks;
      },
      rest: {
        checks: { listForRef() {} },
        repos: {
          listCommitStatusesForRef: "statuses",
          async getBranch(args) {
            assert.equal(args.branch, "master");
            return {
              data: {
                commit: { sha: typeof branchHead === "function" ? branchHead() : branchHead },
              },
            };
          },
        },
        actions: {
          async getWorkflowRun(args) {
            assert.equal(args.run_id, 42);
            return { data: { check_suite_id: 100 } };
          },
          async listWorkflowRuns(args) {
            calls.push({ ...args });
            const attempt = attempts.get(args.workflow_id) ?? 0;
            attempts.set(args.workflow_id, attempt + 1);
            return {
              data: { workflow_runs: response(args.workflow_id, attempt) },
            };
          },
        },
      },
    },
  };
  await runWorkflowGate(script, sandbox);
  return calls;
}

test("requiring release gates only declares functions without reading environment or loading providers", () => {
  const release = releaseModule({
    process: new Proxy(
      {},
      {
        get() {
          assert.fail("Module loading must not use process or tokens");
        },
      },
    ),
    require(name) {
      assert.fail(`Module loading must not read, spawn or import ${name}`);
    },
  });
  assert.equal(typeof release.waitForExternalChecks, "function");
  assert.equal(typeof release.verify, "function");
});

test("production release checks out the exact push revision before read-only gates and gates bootstrap and credentials", async () => {
  const apply = workflow.split("\n  railway-apply:")[1];
  assert.match(apply, /^ {6}checks: read$/m);
  assert.match(apply, /^ {6}statuses: read$/m);
  const needs = apply.match(/^\s+needs:\s*\[([\s\S]*?)\]/m)?.[1];
  assert(needs, "production apply must declare its deployment gates");
  assert.deepEqual(
    needs
      .split(",")
      .map((job) => job.trim())
      .filter(Boolean)
      .sort(),
    ["source", "images"].sort(),
  );
  assert.deepEqual(parse(workflow).jobs["railway-apply"].environment, {
    name: "treasury-subgraph / production",
    deployment: false,
  });
  assert(!workflow.includes("  railway-plan:"));
  assert(!workflow.includes("run-id:"));
  assert(!apply.includes("actions/upload-artifact@"));
  assert(!apply.includes("actions/download-artifact@"));
  assert(!workflow.includes("secrets.RAILWAY_TOKEN"));
  assert.equal((workflow.match(/secrets.RAILWAY_DEPLOY_TOKEN/g) ?? []).length, 2);
  assert.match(apply, /steps:\n {6}- name: Checkout merged configuration\n/);
  const checkout = apply
    .split("- name: Checkout merged configuration")[1]
    .split("\n      - name:")[0];
  assert(checkout.includes("persist-credentials: false"));
  assert.match(checkout, /ref: \$\{\{ github\.sha \}\}/);
  assert(
    apply.indexOf("- name: Checkout merged configuration") <
      apply.indexOf("- name: Select production infrastructure change"),
  );
  assert(
    apply.indexOf("- name: Select production infrastructure change") <
      apply.indexOf("- name: Wait for external checks"),
  );
  assert(apply.indexOf("- name: Wait for external checks") < apply.indexOf("- name: Bootstrap"));
  assert(
    apply.indexOf("- name: Wait for external checks") <
      apply.indexOf("secrets.RAILWAY_DEPLOY_TOKEN"),
  );
  assert(!apply.includes('install-dependencies: "false"'));
  const steps = parse(workflow).jobs["railway-apply"].steps;
  assert.equal(
    parse(workflow).jobs["railway-apply"].if,
    "github.event_name == 'push' && github.ref == 'refs/heads/master'",
  );
  const eligibility = steps.find((step) => step.name === "Select production infrastructure change");
  assert(eligibility.id, "release selection must declare its output ID");
  const dependentSteps = [
    "Wait for external checks",
    "Bootstrap",
    "Plan production changes",
    "Verify production plan target",
    "Apply reviewed production plan",
  ];
  assert.deepEqual(
    steps.map((step) => step.name),
    ["Checkout merged configuration", "Select production infrastructure change", ...dependentSteps],
  );
  assert.equal(parse(workflow).jobs["railway-apply"]["continue-on-error"] ?? false, false);
  assert.equal(
    parse(workflow).concurrency["cancel-in-progress"],
    `\${{ github.event_name == 'pull_request' }}`,
  );
  assert.deepEqual(parse(workflow).jobs["railway-apply"].concurrency, {
    group: "railway-infrastructure-production",
    "cancel-in-progress": false,
    queue: "max",
  });
  assert.equal(
    steps.find((step) => step.name === "Wait for external checks").env.MERGE_COMMIT_SHA,
    `\${{ github.sha }}`,
  );
  for (const step of steps) assert.equal(step["continue-on-error"] ?? false, false);
  for (const [name, method, args] of [
    ["Wait for external checks", "waitForExternalChecks", "{ github, context, core }"],
    ["Plan production changes", "plan", "{ core }"],
    ["Verify production plan target", "verify", "{ github, context }"],
    ["Apply reviewed production plan", "apply", "{ github, context, core }"],
  ])
    assert.equal(
      steps.find((step) => step.name === name).with.script.trim(),
      `await require("./scripts/railway-release.cjs").${method}(${args});`,
    );
  for (const name of dependentSteps)
    assert.equal(
      steps.find((step) => step.name === name).if,
      `steps.${eligibility.id}.outputs.relevant == 'true'`,
      name,
    );
  assert.match(apply, /group: railway-infrastructure-production/);
  assert(
    workflow.indexOf("- name: Wait for external checks") <
      workflow.indexOf("- name: Apply reviewed production plan"),
  );
  const calls = await runGate((_name, attempt) =>
    attempt === 0 ? [] : [{ status: "completed", conclusion: "success" }],
  );
  assert.deepEqual([...new Set(calls.map((call) => call.workflow_id))].sort(), required.toSorted());
  for (const call of calls) {
    assert.equal(call.head_sha, "merged-release");
    assert.equal(call.event, call.workflow_id === "audit.yml" ? "push" : "dynamic");
  }
  assert.equal(calls.filter((call) => call.workflow_id === 255339842).length, 2);
  const ci = readFileSync(".github/workflows/ci.yml", "utf8");
  assert.match(ci, /^ {2}push:\n {4}branches: \[master\]$/m);
  for (const [job, path] of [["images", "security-scan.yml"]]) {
    const declaration = parse(ci).jobs[job];
    assert.equal(declaration.if, "github.event_name != 'pull_request'");
    assert.equal(declaration.uses, `./.github/workflows/${path}`);
    const reusable = readFileSync(`.github/workflows/${path}`, "utf8");
    assert.match(reusable, /^ {2}workflow_call:$/m);
    assert.match(reusable, /^ {2}pull_request:$/m);
    assert(!/^ {2}push:/m.test(reusable));
    assert(!reusable.includes(`group: \${{ github.workflow }}`));
  }
  const audit = readFileSync(".github/workflows/audit.yml", "utf8");
  assert.match(audit, /^ {2}push:\n {4}branches: \[master\]$/m);
  assert(!audit.includes("workflow_call:"));
  assert(!ci.includes("uses: ./.github/workflows/audit.yml"));
});

const mergedPR = {
  number: 7,
  merged_at: "2026-11-13",
  merge_commit_sha: "merged-release",
  base: { ref: "master", repo: { full_name: "fixture/fixture" } },
  head: { sha: "reviewed-head", repo: { full_name: "fixture/fixture" } },
};

async function selectRelease({
  prs,
  eventName = "push",
  ref = "refs/heads/master",
  push = {},
} = {}) {
  const match = workflow.match(
    / {6}- name: Select production infrastructure change\n[\s\S]*? {10}script: \|\n([\s\S]*?)(?=^ {6}- name:)/m,
  );
  assert(match, "CI must select trusted merged changes");
  const outputs = {};
  const calls = [];
  const sandbox = {
    require(name) {
      assert.fail(`Release eligibility must not load ${name} from the checkout`);
    },
    context: {
      repo: { owner: "fixture", repo: "fixture" },
      sha: "merged-release",
      payload: { repository: { full_name: "fixture/fixture" }, ...push },
      eventName,
      ref,
    },
    core: {
      info() {},
      setOutput(name, value) {
        outputs[name] = value;
      },
    },
    github: {
      async paginate(method, args) {
        assert.equal(method, "associated");
        assert.equal(args.commit_sha, "merged-release");
        return prs ?? [mergedPR];
      },
      rest: {
        repos: { listPullRequestsAssociatedWithCommit: "associated" },
        actions: {
          async listWorkflowRuns(args) {
            calls.push(args);
            throw new Error("PR plan lookup must not run");
          },
        },
      },
    },
  };
  const script = match[1].replace(/^ {12}/gm, "");
  await vm.runInNewContext(`(async () => {${script}\n})()`, sandbox);
  return { outputs, calls };
}

test("CI reconciles reviewed master merges including docs-only and fork PRs without PR plans", async () => {
  const { outputs, calls } = await selectRelease();
  assert.equal(outputs.relevant, "true");
  assert.deepEqual(calls, []);
  assert.equal(
    (
      await selectRelease({
        prs: [{ ...mergedPR, title: "docs: correct self-hosting guide" }],
      })
    ).outputs.relevant,
    "true",
  );
  await runGate(() => [{ status: "completed", conclusion: "success" }]);
  assert.equal(
    (
      await selectRelease({
        prs: [{ ...mergedPR, head: { repo: { full_name: "fork/fixture" } } }],
      })
    ).outputs.relevant,
    "true",
  );
  assert.equal(
    (await selectRelease({ prs: [{ ...mergedPR, head: { repo: null } }] })).outputs.relevant,
    "true",
  );
});

test("CI blocks deployment for direct pushes and untrusted merge targets", async () => {
  await assert.rejects(selectRelease({ prs: [] }), /reviewed PR merged into master/);
  for (const flag of ["forced", "created", "deleted"])
    await assert.rejects(selectRelease({ push: { [flag]: true } }), /exact master push/);
  for (const input of [
    { eventName: "pull_request" },
    { eventName: "workflow_dispatch" },
    { ref: "refs/heads/MASTER" },
    { ref: "refs/heads/develop" },
  ])
    await assert.rejects(selectRelease(input), /exact master push/);
  for (const merge_commit_sha of ["another-merge", null]) {
    await assert.rejects(
      selectRelease({ prs: [{ ...mergedPR, merge_commit_sha }] }),
      /reviewed PR merged into master/,
    );
  }
  for (const pr of [
    { ...mergedPR, merged_at: null },
    { ...mergedPR, base: { ...mergedPR.base, ref: "another-branch" } },
    {
      ...mergedPR,
      base: { ref: "master", repo: { full_name: "another/fixture" } },
    },
    { ...mergedPR, base: { ref: "master", repo: null } },
  ]) {
    await assert.rejects(selectRelease({ prs: [pr] }), /reviewed PR merged into master/);
  }
});

test("production apply blocks failed managed CodeQL and additional commit checks", async () => {
  await assert.rejects(
    runGate((name) => [
      {
        status: "completed",
        conclusion: name === 255339842 ? "failure" : "success",
      },
    ]),
    /255339842: failure/,
  );
  for (const status of ["completed", "in_progress"]) {
    await assert.rejects(
      runGate(
        () => [{ status: "completed", conclusion: "success" }],
        [
          {
            name: "Socket Security",
            status,
            conclusion: status === "completed" ? "failure" : null,
          },
        ],
      ),
      status === "completed" ? /Socket Security/ : /Timed out/,
    );
  }
});

test("production apply rejects failed or skipped merge CI", async () => {
  for (const workflow of required)
    for (const conclusion of ["failure", "cancelled", "skipped"]) {
      await assert.rejects(
        runGate((name) => [
          {
            status: "completed",
            conclusion: name === workflow ? conclusion : "success",
          },
        ]),
        new RegExp(conclusion),
      );
    }
});

test("production apply times out when merge CI never finishes", async () => {
  await assert.rejects(
    runGate(() => [{ status: "in_progress", conclusion: null }]),
    /Timed out/,
  );
  await assert.rejects(
    runGate(() => []),
    /Timed out/,
  );
  await assert.rejects(
    runGate((name) =>
      name === "audit.yml" ? [] : [{ status: "completed", conclusion: "success" }],
    ),
    /Timed out/,
  );
  await assert.rejects(
    runGate(() => [{ status: "completed", conclusion: "success" }], []),
    /Timed out/,
  );
});

test("optional neutral or skipped checks do not block successful required workflows", async () => {
  await runGate(
    () => [{ status: "completed", conclusion: "success" }],
    [
      { status: "completed", conclusion: "neutral" },
      { status: "completed", conclusion: "skipped" },
    ],
  );
});

test("production apply excludes its own check suite without ignoring other apply jobs", async () => {
  const ownCheck = {
    name: "apply",
    status: "in_progress",
    conclusion: null,
    check_suite: { id: 100 },
  };
  const success = { status: "completed", conclusion: "success" };
  await runGate(() => [success], [ownCheck, success]);
  await assert.rejects(
    runGate(() => [success], [ownCheck, { ...ownCheck, check_suite: { id: 101 } }, success]),
    /Timed out/,
  );
});

test("production apply blocks failed or pending external commit statuses", async () => {
  const codeql = () => [{ status: "completed", conclusion: "success" }];
  for (const state of ["failure", "error", "pending"]) {
    await assert.rejects(
      runGate(codeql, undefined, [{ context: "security/snyk (Olympus DAO)", state }]),
      state === "pending" ? /Timed out/ : /security\/snyk/,
    );
  }
  const calls = await runGate(codeql, undefined, (attempt) => [
    {
      context: "security/snyk (Olympus DAO)",
      state: attempt === 0 ? "pending" : "success",
    },
  ]);
  assert.equal(calls.length, required.length * 2);
});

test("production apply uses the newest status per context and excludes downstream deployments", async () => {
  const codeql = () => [{ status: "completed", conclusion: "success" }];
  await runGate(codeql, undefined, [
    { context: "security/snyk (Olympus DAO)", state: "success" },
    { context: "security/snyk (Olympus DAO)", state: "failure" },
    { context: "treasury-subgraph - snapshot-publisher", state: "pending" },
    { context: "treasury-subgraph - snapshot-monitor", state: "failure" },
  ]);
  await assert.rejects(
    runGate(codeql, undefined, [
      { context: "security/snyk (Olympus DAO)", state: "pending" },
      { context: "security/snyk (Olympus DAO)", state: "success" },
    ]),
    /Timed out/,
  );
});

async function verifyPlan({
  raw,
  branchHead = "merged-release",
  kind = "railway.config.plan",
  version = 1,
  changeSet = { version: 1, changes: [] },
} = {}) {
  const sandbox = {
    process: {
      env: {
        PLAN_PATH: "reviewed-plan",
        RAILWAY_ENVIRONMENT_ID: "production",
      },
    },
    context: {
      repo: { owner: "fixture", repo: "fixture" },
      sha: "merged-release",
    },
    require(name) {
      if (name === "node:fs")
        return {
          readFileSync(path) {
            assert.equal(path, "reviewed-plan");
            if (raw !== undefined) return raw;
            return JSON.stringify({
              kind,
              version,
              changeSet,
            });
          },
        };
      assert.fail(`Unexpected custom saved-plan verification: ${name}`);
    },
    github: {
      rest: {
        repos: {
          async getBranch(args) {
            assert.equal(args.branch, "master");
            return { data: { commit: { sha: branchHead } } };
          },
        },
      },
    },
  };
  await releaseModule(sandbox).verify(sandbox);
}

test("automatic apply blocks existing main DB image transitions but permits normal unrelated changes", async () => {
  await assert.rejects(verifyPlan({ raw: "fixture-private-plan-do-not-log" }), (error) => {
    assert.match(error.message, /Native Railway plan could not be read/);
    assert(!error.message.includes("fixture-private-plan-do-not-log"));
    return true;
  });
  const sourceUpdate = {
    kind: "resource.update",
    address: "database.Postgres",
    field: "source",
    before: {
      type: "image",
      image: "ghcr.io/railwayapp-templates/postgres-ssl:16",
    },
    after: {
      type: "image",
      image: "ghcr.io/railwayapp-templates/postgres-ssl:18@sha256:fixture",
    },
    severity: "safe",
    deployEffect: "deploy",
  };
  const check = (changes) => verifyPlan({ changeSet: { version: 1, changes } });
  await assert.rejects(check([sourceUpdate]), /separately approved manual reset/);
  await assert.rejects(check([{ ...sourceUpdate, before: null }]), /manual reset/);
  await assert.rejects(check([{ ...sourceUpdate, after: {} }]), /manual reset/);
  await check([{ ...sourceUpdate, address: "service.frontend" }]);
  await check([{ ...sourceUpdate, field: "deploy", before: {}, after: {} }]);
  await check([{ ...sourceUpdate, before: sourceUpdate.after }]);
  await check([
    {
      kind: "resource.create",
      address: "database.Postgres",
      resource: { source: sourceUpdate.after },
    },
  ]);
  for (const changeSet of [null, {}, { version: 2, changes: [] }, { version: 1, changes: [null] }])
    await assert.rejects(verifyPlan({ changeSet }), /saved plan/i);
  await assert.rejects(verifyPlan({ kind: "unknown" }), /saved plan/i);
  await assert.rejects(verifyPlan({ version: 2 }), /saved plan/i);
});

test("production apply rejects an older queued release after master advances", async () => {
  let branchReads = 0;
  await assert.rejects(
    runGate(
      () => [],
      undefined,
      [],
      () => (++branchReads === 1 ? "merged-release" : "newer-release"),
    ),
    /advanced/,
  );
  await assert.rejects(
    runGate(() => [{ status: "completed", conclusion: "success" }], undefined, [], "newer-release"),
    /advanced/,
  );
  await assert.rejects(verifyPlan({ branchHead: "newer-release" }), /advanced/);
  assert(
    workflow.indexOf("- name: Verify production plan target") <
      workflow.indexOf("- name: Apply reviewed production plan"),
  );
});

async function checkNativeApplyResult(result, options = {}) {
  const {
    exitCode = 0,
    raw,
    savedPlan = JSON.stringify({ changeSet: { changes: [] } }),
    error,
    operation = "apply",
    branchHead = "merged-release",
    branchError = false,
    token = "fixture-only",
    project,
    environment,
  } = {
    project: "fixture-project-id",
    environment: "fixture-production-id",
    ...options,
  };
  assert(
    workflow.includes(
      `await require("./scripts/railway-release.cjs").${operation}({ ${operation === "apply" ? "github, context, core" : "core"} });`,
    ),
    "CI must invoke the extracted native command with private output",
  );
  let branchChecked = false;
  let privateUmask = false;
  const privateMarker = "fixture-private-output-do-not-log";
  const logs = [];
  try {
    const sandbox = {
      context: { repo: { owner: "fixture", repo: "fixture" }, sha: "merged-release" },
      github: {
        rest: {
          repos: {
            async getBranch(args) {
              assert.deepEqual(
                { ...args },
                { owner: "fixture", repo: "fixture", branch: "master" },
              );
              if (branchError) throw new Error("fixture branch unavailable");
              branchChecked = true;
              return { data: { commit: { sha: branchHead } } };
            },
          },
        },
      },
      process: {
        env: {
          RAILWAY_API_TOKEN: token,
          RUNNER_TEMP: "/fixture-private",
          RAILWAY_PROJECT_ID: project,
          RAILWAY_ENVIRONMENT_ID: environment,
        },
        umask(mode) {
          assert.equal(mode, 0o077);
          privateUmask = true;
        },
      },
      core: {
        info(message) {
          logs.push(message);
        },
      },
      require(name) {
        if (name === "node:fs")
          return {
            readFileSync(path, encoding) {
              assert.equal(path, "/fixture-private/railway-plan.json");
              assert.equal(encoding, "utf8");
              return savedPlan;
            },
          };
        assert.equal(name, "node:child_process");
        return {
          spawnSync(command, args, options) {
            assert.equal(command, "railway");
            if (operation === "apply") {
              assert(branchChecked, "master must be checked before native apply");
              assert.equal(branchHead, "merged-release");
            }
            if (operation === "plan")
              assert(privateUmask, "plan files must be private before native write");
            assert.equal(
              JSON.stringify(args),
              JSON.stringify(
                operation === "apply"
                  ? [
                      "config",
                      "apply",
                      "--environment",
                      "fixture-production-id",
                      "--plan",
                      "/fixture-private/railway-plan.json",
                      "--yes",
                      "--json",
                    ]
                  : [
                      "config",
                      "plan",
                      "--environment",
                      "fixture-production-id",
                      "--out",
                      "/fixture-private/railway-plan.json",
                    ],
              ),
            );
            assert.equal(JSON.stringify(options.stdio), '["ignore","pipe","pipe"]');
            return {
              status: exitCode,
              error,
              stdout: raw ?? JSON.stringify({ ...result, outputs: privateMarker }),
              stderr: privateMarker,
            };
          },
        };
      },
    };
    await releaseModule(sandbox)[operation](sandbox);
    assert.equal(logs.length, 1);
  } catch (failure) {
    assert(!failure.message.includes(privateMarker));
    throw failure;
  } finally {
    assert(logs.every((message) => !message.includes(privateMarker)));
  }
}

test("native apply rechecks master before sending the saved plan", async () => {
  const result = { status: "applied", changes: [] };
  await checkNativeApplyResult(result);
  await assert.rejects(checkNativeApplyResult(result, { branchHead: "newer-release" }), /advanced/);
  await assert.rejects(checkNativeApplyResult(result, { branchError: true }), /branch unavailable/);
});

test("native CI apply requires applied/noop result and every change, never exit zero or raw output", async () => {
  await checkNativeApplyResult({
    status: "applied",
    changes: [{ status: "applied" }, { status: "noop" }],
  });
  await checkNativeApplyResult({ status: "noop", changes: [] });
  await assert.rejects(
    checkNativeApplyResult({ status: "noop", changes: [{ status: "applied" }] }),
    /no-op requires an empty/,
  );
  await assert.rejects(
    checkNativeApplyResult(
      { status: "noop", changes: [] },
      {
        savedPlan: JSON.stringify({
          changeSet: { changes: [{ kind: "update", address: "service.fixture" }] },
        }),
      },
    ),
    /no-op requires an empty/,
  );
  await assert.rejects(
    checkNativeApplyResult(
      { status: "noop", changes: [] },
      { savedPlan: "fixture-private-output-do-not-log invalid JSON" },
    ),
    /plan could not be read/,
  );
  for (const status of ["failed", "partially_applied", "applying", "staged", "unknown", null]) {
    await assert.rejects(
      checkNativeApplyResult({ status, changes: [] }),
      /did not report applied\/noop/,
    );
    await assert.rejects(
      checkNativeApplyResult({ status: "applied", changes: [{ status }] }),
      /did not report applied\/noop/,
    );
  }
  for (const result of [
    {},
    { status: "applied" },
    { status: "applied", changes: {} },
    { status: "applied", changes: [null] },
  ])
    await assert.rejects(checkNativeApplyResult(result), /did not report applied\/noop/);
  await assert.rejects(
    checkNativeApplyResult({}, { raw: "not JSON fixture-private-output-do-not-log" }),
    /malformed JSON/,
  );
  await assert.rejects(
    checkNativeApplyResult({ status: "applied", changes: [] }, { exitCode: 7 }),
    /Native Railway apply failed/,
  );
  await assert.rejects(
    checkNativeApplyResult({}, { error: { code: "ENOENT" } }),
    /Native Railway apply failed/,
  );
});

test("native CI planning is private, fails on missing token and retains native errors", async () => {
  for (const field of ["project", "environment"])
    for (const value of ["", undefined])
      await assert.rejects(
        checkNativeApplyResult({}, { operation: "plan", [field]: value }),
        /RAILWAY_PROJECT_ID|RAILWAY_ENVIRONMENT_ID/,
      );
  await checkNativeApplyResult({}, { operation: "plan" });
  await assert.rejects(
    checkNativeApplyResult({}, { operation: "plan", exitCode: 7 }),
    /Native Railway plan failed/,
  );
  await assert.rejects(
    checkNativeApplyResult({}, { operation: "plan", error: { code: "ENOENT" } }),
    /Native Railway plan failed/,
  );
  await assert.rejects(
    checkNativeApplyResult({}, { operation: "plan", token: "" }),
    /RAILWAY_DEPLOY_TOKEN/,
  );
  await assert.rejects(checkNativeApplyResult({}, { token: "" }), /RAILWAY_DEPLOY_TOKEN/);
});
