# Artifact storage permissions

The API uses only `GetObject` under `v2/`. The publisher needs `GetObject`,
`PutObject`, `DeleteObject` and prefix-scoped `ListBucket` under `v2/`. Its
conditional writes and deletes maintain the publisher lock and deployment
cleanup; removing those permissions breaks publishing.

Where the storage provider supports IAM, create separate API and publisher
principals. Adapt the policies in `config/artifact-reader-policy.json` and
`config/artifact-publisher-policy.json`, replacing `YOUR_BUCKET`. Assign each
principal's credentials to that service's existing `ARTIFACT_ACCESS_KEY_ID` and
`ARTIFACT_SECRET_ACCESS_KEY` variables. No anonymous bucket access is required.
The API needs no list or write permission. Keep both the keys and policy-expanded
bucket names out of Git.

Railway's current bucket credentials grant bucket-wide access: they cannot be
restricted to read-only, an object prefix or specific operations. Separate copies
of those credentials do not establish a permission boundary. See
[Railway bucket permissions](https://station.railway.com/questions/railway-buckets-permissions-credentia-1f66e048)
and [storage buckets](https://docs.railway.com/storage-buckets).
The source therefore preserves the existing credentials. Enforcing API read-only
storage requires scoped credentials from a provider that supports them, or new
Railway functionality. Choosing that provider and changing live credentials
require separate approval; the repository performs neither action.

Artifact reads default to a 30-second total request deadline, a 10-second body
deadline and a 64 MiB response cap. These are per object. Override with positive
integers in `METRICS_API_ARTIFACT_REQUEST_TIMEOUT_MS`,
`METRICS_API_ARTIFACT_BODY_TIMEOUT_MS` and `METRICS_API_ARTIFACT_MAX_BYTES` after
measuring shard sizes. Reads abort and destroy the body when a deadline or cap
is reached. Invalid JSON or runtime shapes return a safe HTTP 503 response.
