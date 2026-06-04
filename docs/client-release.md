# Client Package Release

The `@olympusdao/treasury-subgraph-client` package is released with the manual
GitHub Actions workflow **Release treasury-subgraph-client**.

## Why this workflow lives on master

GitHub only shows a `workflow_dispatch` workflow in the Actions UI after the
workflow file exists on the repository default branch. Keep this workflow on
`master` even when the package version being tested or released lives on a
feature branch.

When running the workflow from the Actions UI, use the branch selector to choose
the branch or tag that contains the package source, `apps/client/package.json`,
`apps/client/scripts/ci-release.ts`, and the matching changelog entry.

## Modes

Use `mode=dry-run` first. This is the default.

Dry-run mode:

- validates `expected_version` against `apps/client/package.json`
- runs the client release checks
- packs the package
- uploads the tarball, npm pack metadata, and release notes as workflow
  artifacts
- does not stage anything on npm
- does not create a git tag
- does not create a GitHub Release

Use `mode=stage` only after the dry-run artifact has been reviewed.

Stage mode:

- performs the same validation and package packing
- stages the tarball on npm through trusted publishing
- creates the `treasury-subgraph-client-v<version>` GitHub tag and Release only
  after npm staging succeeds

The staged npm package still needs manual approval in npm's web UI before it is
published to the live registry.

## Running A Release

1. Open **Actions**.
2. Select **Release treasury-subgraph-client**.
3. Click **Run workflow**.
4. Select the branch containing the intended package release.
5. Enter `expected_version`, for example `3.0.0`.
6. Leave `mode` as `dry-run`.
7. Review the uploaded workflow artifacts.
8. Rerun the workflow with the same branch and `mode=stage`.
9. Review and approve the staged package on npmjs.com.

Do not use local npm tokens or local `npm stage publish` for this package.
