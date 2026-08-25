# AWS and CI/CD

Status: **PLANNED paid-cloud architecture; not deployed by this PR.**

The reference deployment uses ECS: API and general worker on Fargate; channel-worker on ECS/EC2 capacity providers when its long-lived, stateful profile requires host-level operational control. RDS PostgreSQL Multi-AZ, ElastiCache/Valkey, S3, Secrets Manager, ALB, and CloudFront where appropriate complete the baseline. GHCR may publish public OSS images; managed cloud images use ECR.

GitHub Actions runs format/lint/typecheck/tests, contract checks, security scans, image builds, and provenance checks. OIDC federates short-lived AWS access; no long-lived cloud keys are stored in GitHub. Build once and promote the same immutable digest from staging to production. Main deploys staging automatically. Production is protected by environment approval initially; a measured canary can become automatic later.

Release Please, SemVer, and Conventional Commits make release intent visible. Migrations use expand → migrate/backfill → contract; overlapping app versions must remain compatible. API/general worker rollouts may be rolling or blue/green. Channel-worker uses canary, drain, lease handoff, and reconnect observation.

Rollback normally means app-digest rollback. Destructive database changes require a forward fix because rollback may not restore data. Backups, restore verification, and DR exercises are release responsibilities. Self-host users receive release notifications and migration docs; IssueSpan does not silently force remote updates.
