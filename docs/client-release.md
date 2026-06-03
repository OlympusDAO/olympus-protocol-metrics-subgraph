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

1. Use Node.js 24+, npm 11.15.0+, and the pinned workspace pnpm version.
2. Bump `apps/client/package.json` to the intended version.
3. Commit the version bump and related changes. The release check intentionally
   fails on a dirty git tree.
4. Log in to npm from `apps/client` using a directory-local npm config:

   ```sh
   cd apps/client
   pnpm run auth:login
   pnpm run auth:whoami
   ```

   `auth:login` writes credentials to `apps/client/.npmrc.local`, which is
   gitignored and used only by the client package publish scripts. Do not use a
   repository-root `.npmrc`, and do not commit npm credentials. Remove
   `.npmrc.local` after publishing if you do not want to keep the local session.

5. Run the client release gate:

   ```sh
   pnpm --dir apps/client run release:check
   ```

   This runs `pnpm install --frozen-lockfile`, builds the client, regenerates
   `openapi.json`, runs client tests, runs `pnpm audit --audit-level moderate`,
   and verifies that `npm pack --dry-run` only includes `dist`, `CHANGELOG.md`,
   `openapi.json`, and package metadata.

6. Review the tarball contents:

   ```sh
   pnpm --dir apps/client run pack:dry-run
   ```

7. Stage the package from `apps/client`:

   ```sh
   pnpm --dir apps/client run publish:client
   ```

   The publish script uses `npm stage publish --access public --provenance`
   with the directory-local npm config and a temporary npm cache. The package's
   npm access policy is set to "Require two-factor authentication and disallow
   tokens", so direct token-based publishing is rejected. Staged publishing
   uploads the tarball without making it installable; approval is a separate
   2FA-protected step.

8. Review and approve the staged package:

   ```sh
   cd apps/client
   pnpm run stage:list
   npm stage view <stage-id> --userconfig ./.npmrc.local
   npm stage download <stage-id> --userconfig ./.npmrc.local
   npm stage approve <stage-id> --userconfig ./.npmrc.local
   ```

   `npm stage approve` prompts for 2FA. Reject the stage instead of approving
   it if the tarball contents, version, git commit, or changelog do not match
   the intended release.

9. Record the package version, git commit, and npm package URL in the release
   notes or PR thread.

Do not commit `.npmrc` files with tokens. Prefer trusted publishing configured
with stage-only permissions for CI, and keep package-level direct token
publishing disabled.
