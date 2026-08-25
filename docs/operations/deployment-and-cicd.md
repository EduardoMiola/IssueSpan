# Docker, AWS deployment, and CI/CD

**Status:** Frozen deployment direction; infrastructure is staged.

Local Compose provides PostgreSQL, Valkey, optional S3-compatible storage, and fake Zapo. Web, API, worker, and channel-worker are separately runnable. Use minimal non-root OCI images, pinned tools, health checks, graceful signals, staged builds, scans, and immutable commit tags.

~~~text
Route 53/TLS/ALB → ECS web/api/worker/channel-worker
                  → RDS PostgreSQL + Valkey-compatible cache
                  → S3 + Secrets Manager/KMS + CloudWatch/OTel
~~~

ECS is the initial baseline; OpenTofu manages infrastructure. Require backups, encryption, least-privilege IAM, network segmentation, restore verification, and session-aware worker deployment before production claims.

CI uses the lockfile; format/lint; typecheck; unit/integration tests; security/dependency/secret/container scans; build; migration validation; immutable artifacts; staging deploy; smoke checks; approval; and rollback-capable production deploy. Migrations are forward-compatible and reviewed. Releases record commit, Jira scope, image digests, migrations, CI, dashboards, risks, and rollback.
