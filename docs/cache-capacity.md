# Persistent cache capacity

The eRPC PostgreSQL cache is separate from Envio's application database. An
operator reset rebuilds Envio state; it must not erase the eRPC database. Both
services retain their existing volume identities. The source capacity floors
are 20,000 MB for eRPC PostgreSQL and 50,000 MB for the main database; existing
larger volumes are preserved. Volume alerts remain at 80%, 95% and 100%.

Historical finalized eRPC policies use `ttl: "0s"` (no expiry). There is no
approved age-based eviction schedule or automatic volume cleanup. New blocks,
contracts, methods and arguments can increase stored rows even when repeated
requests become hits. Do not infer a lifetime storage budget from a short
benchmark.

Use the existing private eRPC metrics endpoint on port 4001. Compare rates for
`erpc_cache_get_success_hit_duration_seconds_count`,
`erpc_cache_get_success_miss_duration_seconds_count` and
`erpc_cache_get_error_duration_seconds_count`; compare
`erpc_cache_set_original_bytes_total` and `erpc_cache_set_compressed_bytes_total`
with PostgreSQL's actual disk usage. These counters are available in the pinned
[eRPC telemetry implementation](https://github.com/erpc/erpc/blob/0.5.0/telemetry/metrics.go).
They are not provider invoices and do not include PostgreSQL index/WAL overhead.
Keep metrics access private; do not add a public service domain for observation.

Run read-only SQL through an approved private database connection:

```sql
SELECT pg_database_size(current_database()) AS database_bytes;
SELECT pg_total_relation_size('rpc_cache') AS cache_bytes;
SELECT n_live_tup AS estimated_cache_rows
FROM pg_stat_user_tables WHERE relname = 'rpc_cache';
```

Use `pg_total_relation_size`/`pg_stat_user_tables` in the main database as well
to identify application and Envio effect-cache growth. Measure rates over both
backfill and steady indexing, including WAL, indexes, free space and backup
headroom. Counters reset when their process restarts; compare rates over
consistent intervals. Use the observed positive bytes/day slope and available
headroom to estimate time to the next capacity threshold; no growth is not a
promise of permanent capacity.

Before adopting retention, establish which historical ranges must remain cheap
to replay, whether the provider can still serve them, and the cold-cache RPC
cost/latency. Review supported cache expiry/maintenance behavior for the pinned
versions and recovery needs. Capacity increases or retention changes require
separate approval. This branch defines no cache-deletion operation or policy.
