# Changelog

## Unreleased

- Resume compatible Envio 3.19.0 state and surface native startup failures.
  Rebuild incompatible state with an explicit reset from the database host.
- Add a private persistent cache for finalized historical RPC reads, separate
  from the indexer database and schema reset.
- Bound and validate artifact reads, and isolate the public Metrics API from
  private ingestion, publisher, Hasura, RPC cache and databases.
- Standardize locked runtime tools, source checks, owned-image vulnerability and
  secret scans, required integration fixtures and isolated dependency audits.
- Use PostgreSQL 18.6 for fresh ephemeral local fixtures. Configured provider
  images remain advisory scans; local fixtures are excluded from default scans.

Live Railway changes and publication require separate approval. Client-package
release history remains in [its changelog](apps/client/CHANGELOG.md).
