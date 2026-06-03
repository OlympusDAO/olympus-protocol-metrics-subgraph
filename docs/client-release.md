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
4. Run the client release gate before logging in to npm:

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

6. Stage the package from `apps/client`:

   ```sh
   pnpm --dir apps/client run publish:client
   ```

   The publish script logs in to npm with the directory-local
   `apps/client/.npmrc.local`, runs
   `npm stage publish --access public --provenance`, then logs out and removes
   `.npmrc.local` in a cleanup step. The package's npm access policy is set to
   "Require two-factor authentication and disallow tokens", so direct
   token-based publishing is rejected. Staged publishing uploads the tarball
   without making it installable; approval is a separate 2FA-protected step.

7. Review and approve the staged package through npmjs.com. The npm staged
   publishing docs recommend opening the **Staged Packages** tab to review a
   staged package, then clicking **Approve** from that tab. Use the web
   frontend as the primary approval path so approval is not coupled to local
   npm CLI or development-environment issues:

   <https://www.npmjs.com/package/@olympusdao/treasury-subgraph-client>

   Confirm the staged version, tag, package contents, changelog, and git commit
   before approving. npm will prompt for 2FA in the web flow before publishing
   the staged package to the live registry.

   The CLI path is optional and should be used only when you want to list,
   view, or download the staged tarball locally before website approval. It
   requires a short npm login session because the staging commands are
   authenticated:

   ```sh
   cd apps/client
   pnpm run auth:login
   pnpm run stage:list
   npm stage view <stage-id> --userconfig ./.npmrc.local
   npm stage download <stage-id> --userconfig ./.npmrc.local
   pnpm run auth:logout
   ```

   Reject the stage instead of approving it if the tarball contents, version,
   git commit, or changelog do not match the intended release. Always run
   `pnpm run auth:logout` after any CLI review session.

8. Record the package version, git commit, and npm package URL in the release
   notes or PR thread.

Do not commit `.npmrc` files with tokens. `apps/client/.npmrc.local` is
gitignored and should only exist during the short login windows above. Prefer
trusted publishing configured with stage-only permissions for CI, and keep
package-level direct token publishing disabled.
