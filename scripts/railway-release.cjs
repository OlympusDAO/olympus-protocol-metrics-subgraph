module.exports = {
  async waitForExternalChecks({ github, context, core }) {
    const { data: currentRun } = await github.rest.actions.getWorkflowRun({
      ...context.repo,
      run_id: context.runId,
    });
    if (!currentRun.check_suite_id)
      throw new Error("Cannot identify the CI workflow's own check suite.");
    // GitHub-managed CodeQL has no workflow file and uses the dynamic event.
    const requiredWorkflows = [
      [255339842, "dynamic"],
      ["audit.yml", "push"],
    ];
    for (let attempt = 0; attempt < 120; attempt++) {
      const { data: latestBranch } = await github.rest.repos.getBranch({
        ...context.repo,
        branch: "master",
      });
      if (latestBranch.commit.sha !== context.sha)
        throw new Error("Production branch advanced; refusing an outdated queued release.");
      let workflowsPassed = true;
      for (const [workflow, event] of requiredWorkflows) {
        const { data } = await github.rest.actions.listWorkflowRuns({
          ...context.repo,
          workflow_id: workflow,
          head_sha: process.env.MERGE_COMMIT_SHA,
          event,
          per_page: 1,
        });
        const run = data.workflow_runs[0];
        if (run?.status === "completed" && run.conclusion !== "success")
          throw new Error(`${workflow}: ${run.conclusion}`);
        workflowsPassed &&= run?.status === "completed" && run.conclusion === "success";
      }
      if (workflowsPassed) {
        const reportedChecks = await github.paginate(github.rest.checks.listForRef, {
          ...context.repo,
          ref: process.env.MERGE_COMMIT_SHA,
          filter: "latest",
          per_page: 100,
        });
        // This release job cannot finish until the gate returns.
        const checks = reportedChecks.filter(
          (check) => check.check_suite?.id !== currentRun.check_suite_id,
        );
        const failedCheck = checks.find(
          (check) =>
            check.status === "completed" &&
            !["success", "neutral", "skipped"].includes(check.conclusion),
        );
        if (failedCheck) throw new Error(`${failedCheck.name}: ${failedCheck.conclusion}`);
        const reportedStatuses = await github.paginate(github.rest.repos.listCommitStatusesForRef, {
          ...context.repo,
          ref: process.env.MERGE_COMMIT_SHA,
          per_page: 100,
        });
        // Newest first. Railway deploys wait for this workflow, so its statuses cannot gate this apply.
        const latestStatuses = new Map();
        for (const status of reportedStatuses) {
          const name = status.context.toLowerCase();
          if (!name.startsWith("treasury-subgraph - ") && !latestStatuses.has(name))
            latestStatuses.set(name, status);
        }
        const statuses = [...latestStatuses.values()];
        const failedStatus = statuses.find((status) => ["failure", "error"].includes(status.state));
        if (failedStatus) throw new Error(`${failedStatus.context}: ${failedStatus.state}`);
        if (
          checks.length > 0 &&
          checks.every((check) => check.status === "completed") &&
          statuses.every((status) => status.state === "success")
        ) {
          const { data: branch } = await github.rest.repos.getBranch({
            ...context.repo,
            branch: "master",
          });
          if (branch.commit.sha !== context.sha)
            throw new Error(
              "Production branch advanced; refusing an outdated queued release before dependency installation or Railway token use.",
            );
          core.info(
            "Native CI jobs and external checks passed; production infrastructure apply may proceed.",
          );
          return;
        }
      }
      core.info(
        "Waiting for dependency audit, CodeQL and external commit checks on the merge commit.",
      );
      await new Promise((resolve) => setTimeout(resolve, 15_000));
    }
    throw new Error(
      "Timed out waiting for external checks; production infrastructure was not applied.",
    );
  },
  async plan({ core }) {
    if (!process.env.RAILWAY_PROJECT_ID || !process.env.RAILWAY_ENVIRONMENT_ID)
      throw new Error(
        "Set explicit RAILWAY_PROJECT_ID and RAILWAY_ENVIRONMENT_ID for production apply.",
      );
    if (!process.env.RAILWAY_API_TOKEN)
      throw new Error("Set the production environment-only RAILWAY_DEPLOY_TOKEN secret.");
    // Authoring evaluation can use this token; run only trusted merged code.
    // Native saved plans and captured output may contain private values.
    process.umask(0o077);
    const planned = require("node:child_process").spawnSync(
      "railway",
      [
        "config",
        "plan",
        "--environment",
        process.env.RAILWAY_ENVIRONMENT_ID,
        "--out",
        `${process.env.RUNNER_TEMP}/railway-plan.json`,
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    if (planned.error || planned.status !== 0)
      throw new Error("Native Railway plan failed; raw output withheld.");
    core.info("Fresh native production plan saved privately for this release.");
  },
  async verify({ github, context }) {
    let plan;
    try {
      plan = JSON.parse(require("node:fs").readFileSync(process.env.PLAN_PATH, "utf8"));
    } catch {
      throw new Error("Native Railway plan could not be read; raw output withheld.");
    }
    // Native apply binds environment/sourceTree/ETag/hash to this saved plan.
    // CLI 5.75 source updates can redeploy a database despite severity=safe.
    // Main image transitions require the separately approved fresh-data release.
    if (
      plan.kind !== "railway.config.plan" ||
      plan.version !== 1 ||
      plan.changeSet?.version !== 1 ||
      !Array.isArray(plan.changeSet.changes)
    ) {
      throw new Error("Unsupported saved plan change set; refusing automatic production apply.");
    }
    for (const change of plan.changeSet.changes) {
      if (!change || typeof change.kind !== "string" || typeof change.address !== "string") {
        throw new Error("Incomplete saved plan change; refusing automatic production apply.");
      }
      if (
        change.address === "database.Postgres" &&
        change.kind === "resource.update" &&
        change.field === "source" &&
        (typeof change.before?.image !== "string" ||
          typeof change.after?.image !== "string" ||
          change.before.image !== change.after.image)
      ) {
        throw new Error(
          "Main database image transition requires a separately approved manual reset/reindex and native apply; automatic production apply is blocked.",
        );
      }
    }
    const { data: branch } = await github.rest.repos.getBranch({
      ...context.repo,
      branch: "master",
    });
    if (branch.commit.sha !== context.sha) {
      throw new Error("Production branch advanced; refusing an outdated queued apply.");
    }
  },
  async apply({ github, context, core }) {
    if (!process.env.RAILWAY_API_TOKEN)
      throw new Error("Set the production environment-only RAILWAY_DEPLOY_TOKEN secret.");
    const { data: branch } = await github.rest.repos.getBranch({
      ...context.repo,
      branch: "master",
    });
    if (branch.commit.sha !== context.sha)
      throw new Error("Production branch advanced; refusing an outdated queued apply.");
    // Native 5.75 saved-plan apply can exit zero on failed/partial results.
    // Keep both streams private: outputs/diagnostics can contain secrets.
    const applied = require("node:child_process").spawnSync(
      "railway",
      [
        "config",
        "apply",
        "--environment",
        process.env.RAILWAY_ENVIRONMENT_ID,
        "--plan",
        `${process.env.RUNNER_TEMP}/railway-plan.json`,
        "--yes",
        "--json",
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    if (applied.error || applied.status !== 0)
      throw new Error(
        "Native Railway apply failed; raw output withheld. Verify the target before any retry.",
      );
    let result;
    try {
      result = JSON.parse(applied.stdout);
    } catch {
      throw new Error("Native Railway apply returned malformed JSON; raw output withheld.");
    }
    const accepted = new Set(["applied", "noop"]);
    if (
      !accepted.has(result?.status) ||
      !Array.isArray(result.changes) ||
      !result.changes.every((change) => accepted.has(change?.status))
    ) {
      throw new Error(
        "Native Railway apply did not report applied/noop for the result and every change; raw output withheld. Do not retry blindly.",
      );
    }
    if (result.status === "noop") {
      let savedPlan;
      try {
        savedPlan = JSON.parse(
          require("node:fs").readFileSync(`${process.env.RUNNER_TEMP}/railway-plan.json`, "utf8"),
        );
      } catch {
        throw new Error("Native Railway plan could not be read; raw output withheld.");
      }
      if (
        result.changes.length !== 0 ||
        !Array.isArray(savedPlan?.changeSet?.changes) ||
        savedPlan.changeSet.changes.length !== 0
      )
        throw new Error("Native Railway no-op requires an empty saved plan and empty result.");
    }
    core.info(
      "Native apply result accepted. Deployment acceptance still requires a fresh read-only plan and complete HTTP/TCP inventory.",
    );
  },
};
