# Client Package Release

The `@olympusdao/treasury-subgraph-client` package is released from
`apps/client`. It is the drop-in replacement for the historical
`@olympusdao/treasury-subgraph-client` package and includes typed v2 REST
helpers, deprecated legacy `/operations/*` helpers, and `openapi.json`.

## Versioning

- Patch: implementation fixes, type fixes, OpenAPI corrections, or additive
  legacy compatibility fixes that do not require caller changes.
- Minor: additive v2 methods, additive response fields, or new exported types
  that do not break existing callers.
- Major: removing or renaming exported APIs, changing legacy `/operations/*`
  compatibility, or changing response shapes in a way that requires caller
  updates.

## Release Checklist

1. Use Node.js 24+ and the pinned workspace pnpm version.
2. Bump `apps/client/package.json` to the intended version.
3. Commit the version bump and related changes. The release check intentionally
   fails on a dirty git tree.
4. Run the client release gate:

   ```sh
   pnpm --dir apps/client run release:check
   ```

   This runs `pnpm install --frozen-lockfile`, builds the client, regenerates
   `openapi.json`, runs client tests, runs `pnpm audit --audit-level moderate`,
   and verifies that `npm pack --dry-run` only includes `dist`, `CHANGELOG.md`,
   `openapi.json`, and package metadata.

5. Review the tarball contents:

   ```sh
   pnpm --dir apps/client run pack:dry-run
   ```

6. Publish from `apps/client`:

   ```sh
   pnpm --dir apps/client run publish:client
   ```

   The publish script uses `npm publish --access public --provenance` with a
   temporary npm cache, so npm can attach provenance when running from a
   supported CI environment without depending on a developer's global npm cache.
   If publishing locally, use an npm account with 2FA enabled and avoid
   long-lived local automation tokens.

7. Record the package version, git commit, and npm package URL in the release
   notes or PR thread.

Do not commit `.npmrc` files with tokens. Prefer trusted publishing or
short-lived npm automation credentials when possible.
