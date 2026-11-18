# RPC caching and restart benchmark

The branch resumes compatible Envio state, provides an explicit reset command,
and routes historical RPC reads through an independent persistent eRPC cache.
The [recorded results](rpc-indexer-comparison.json) show fewer repeat archive
reads and a shorter restart on a small Robinhood fixture. They do not establish
a faster first cold replay or production billing savings.

## Measured workload

The devbox campaign ran before and after implementation with Node 24.22.3,
Envio 3.14.0, real PostgreSQL and Hasura, and the same Robinhood archive provider.
It retained the configured start block 65,044,796 and stopped at 65,664,000.
This includes the treasury funding transition and valued historical snapshots.
The baseline was commit `e499692d993d4fd1269fa508f6a9a34988ae6ea2`.
The candidate was staged tree `798bd32cc4c577d67920e4daba4dbcf400619ee9`,
subsequently included in implementation commit `2327b69a`.

Each side had three cold trials and three fresh-container restart trials.
The candidate also had three warm-cache rebuilds and one manual-reset rebuild.
Preparation and image builds were outside measured time. The first baseline
restart overlapped dependency installation; the individual samples are retained
in the results rather than discarded. The three repetitions are too few to
characterize environment noise precisely.

Completion required the persisted checkpoint, a successful bounded process exit,
and nonempty indexed records. All 16 measured phases produced exactly the same
entity digest, including two token records and one per-chain/global metric row.
Earlier Ethereum attempts with empty output or premature completion were rejected.

| Phase | Baseline median | Candidate median | Historical upstream reads | Other candidate upstream requests |
| --- | ---: | ---: | --- | --- |
| Cold start | 19.454 s | 19.769 s | 13 on both | 0 |
| Container restart | 18.871 s | 11.641 s | 13 baseline; 0 candidate | 3 discovery/finality requests |
| Warm-cache rebuild | Not separately measured | 24.041 s | 0 candidate | 3–4 discovery/finality requests |
| Manual reset and rebuild | Not separately measured | 25.398 s, one trial | 0 candidate | 3 discovery/finality requests |

The measured restart median fell about 38%. Cold-start time did not improve.
The cache retained all 13 persisted entries through the manual Envio reset.
Warm rebuilds avoided the repeat archive reads but did not demonstrate a runtime
improvement over the baseline replay on this fixture.

This is a single-chain fixture with only 13 historical reads. It does not measure
full-history catch-up, the seven-chain production workload, provider compute-unit
billing, or net savings after cache hosting and storage. A provider without a
usable finalized tag can serve requests through eRPC without persistent hits.

## Reproduce

The historical campaign command requires Linux, Podman, Node 24, frozen repository
dependencies, and the database/Hasura images identified in the recorded results.
Keep credentials, raw logs and trial directories outside the source checkout.
The private credentials JSON supplies `ENVIO_API_TOKEN` and
`ENVIO_ROBINHOOD_RPC_URL`. Do not commit either value.

```sh
pnpm install --frozen-lockfile
podman pull docker.io/library/postgres:17-alpine
podman pull docker.io/hasura/graphql-engine:v2.48.16
podman build -f Dockerfile-rpc-cache -t localhost/olympus-metrics-rpc-cache:local .
pnpm benchmark:rpc baseline <baseline-checkout> <credentials.json> <baseline-result.json> <baseline-commit> 3
pnpm benchmark:rpc candidate <candidate-checkout> <credentials.json> <candidate-result.json> <candidate-commit-or-tree> <baseline-result.json> 3
```

The runner uses disposable databases, limits the campaign to 15,000 upstream
requests, rejects a changed fixture start, verifies matching entity digests,
and records immutable image identities. For the separate synthetic cache test,
Docker or Podman is supported; see [the local stack guide](../local-compose.md#test-rpc-cache-persistence).
