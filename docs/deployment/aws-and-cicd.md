# AWS, Docker, and CI/CD

Status: **PLANNED deployment baseline; not provisioned by PR #1.**

This document is an implementation direction, not a readiness claim. No AWS resource, secret, OpenTofu state, migration, or production deployment exists because of this documentation PR.

## Artifact model

Dockerfile is the recipe, an image is an immutable artifact, and a container is a running process instance. Multi-stage builds compile with tooling and copy only runtime output. Smaller images improve pull/deploy time and reduce attack surface. Production never relies on `latest`; build once, promote the exact image digest.

Local Compose should provide PostgreSQL 18, Valkey, and MinIO. Run Node and Vite with `pnpm dev` for fast reload; a later self-host profile may run the full web/API/worker/channel-worker set. Volumes persist local data across container replacement. Production uses managed RDS, ElastiCache, and S3 rather than container files.

Backend images are separate for `api`, `worker`, and `channel-worker`; a web image is optional for self-host. One release set uses one product version so self-host upgrades do not mix incompatible queue contracts.

## Proposed AWS topology

```text
CloudFront → S3 (Vite static assets)
                    │
                 ALB / HTTPS
                    │
        ECS Fargate API replicas across AZs
          ├─ RDS PostgreSQL Multi-AZ
          ├─ ElastiCache Valkey
          └─ S3 attachments

ECS Fargate general worker ── BullMQ / outbox
ECS on EC2 capacity provider channel worker ── Zapo / WhatsApp
```

ECS is selected over Kubernetes initially. It supplies scheduling, service discovery, autoscaling, load balancing, and rolling/blue-green primitives without adding Pods, Helm, cluster upgrades, and ingress operations before the product needs them. The channel worker uses ECS-managed EC2 capacity because long-lived sockets, memory caches, file descriptors, instance-family tuning, and cost density differ from stateless API tasks. This is still managed ECS; no SSH or manual `docker run` deployment.

Network boundaries use a public subnet only for the ALB, private application subnets for API/workers, and private database/cache subnets. PostgreSQL, Valkey, and EC2 are never directly public. NAT or controlled egress is used for Zapo, GitHub, Linear, Jira, and Postmark. Secrets Manager/KMS protects provider credentials; Zapo durable state remains in PostgreSQL, not instance disk.

Readiness is `/health/ready`, distinct from liveness. SSE heartbeats must be shorter than the ALB idle timeout. API tasks run at least two across Availability Zones once staging evidence supports the cost.

## Accounts and infrastructure as code

Start with a management account plus separated nonproduction/staging and production accounts. Separation is a blast-radius and credential boundary, not a claim that the initial team needs a large account hierarchy.

OpenTofu modules cover network, ECS, API, general worker, channel worker, database, Valkey, object storage, and observability. Remote state is versioned in S3 with locking; state is never committed. Infrastructure PRs run `fmt`, `validate`, and `plan`; staging applies automatically only after review, production requires environment approval. GitHub Actions assumes AWS roles through OIDC; no static AWS access key is stored in GitHub secrets.

## Release sequence

```text
PR → checks and image build
  → merge main
  → build release artifacts once
  → push version + SHA tags to ECR
  → deploy exact digest to staging
  → smoke / E2E / migration compatibility
  → protected production approval
  → expand migration
  → API → general worker → gradual channel worker
  → frontend assets → smoke → bake and monitor
```

Release Please can create the version/changelog PR. Production is triggered by a release rather than an arbitrary main commit initially. GitHub `production` environment approval is a deliberate control. Releases include source commit, image digests, migration/config notes, known issues, and later SBOM/provenance/signatures.

## Stateful channel deployment

Naive blue/green is unsafe for Channel Workers because both fleets could connect to the same ZapoSession. The deployment is a stateful canary: move a small illustrative percentage of partitions, observe reconnects, send failures, memory, event-loop lag, and ownership transfers, then progress gradually. Rollback uses the same ownership handoff. ECS infrastructure draining and application `ACTIVE → DRAINING` must agree.

API tasks can use blue/green once compatibility is proven. General workers roll with N/N-1 queue contract compatibility. Frontend hashed assets support reverting the release pointer. SIGTERM behavior differs: API stops intake and drains requests; general worker stops claims and drains bounded jobs; Channel Worker drains partitions, disconnects preserving credentials, releases ownership, and exits.

## Database and backup operations

RDS is the source of truth with Multi-AZ and PITR/snapshots. ElastiCache Valkey uses failover and `noeviction` for BullMQ configuration; it is not authoritative backup. Durable outbox and PostgreSQL state reconstruct queue intent. Attachments use encrypted S3 objects, lifecycle rules, tenant-checked access, and short-lived signed downloads.

Schema changes use expand → backfill → migrate reads/writes → contract over releases. For example, add `display_name`, dual-write/read compatibly, backfill, stop reading `customer_name`, and drop it in a later release. A one-off ECS migration task uses the migrator role. Restore exercises must prove application startup, tenant isolation, attachment references, and outbox recovery—not merely that a snapshot can be downloaded.

## Scaling and observability

API autoscaling candidates are CPU, memory, and request latency. General worker scaling follows queue age, queue lag, and throughput. Channel Worker scaling follows capacity units, session/memory, event-loop delay, message/reconnect rate, and partition weight; CPU alone is misleading. Scale-in is slower and drain-aware.

CloudWatch covers infrastructure; OpenTelemetry/SigNoz covers application traces, metrics, and logs. Emergency access uses audited SSM/ECS Exec, not SSH. Runbooks must cover credential failure, queue backlog, database exhaustion, deployment rollback, channel reconnect storms, and restore.

## Alternatives and revisit triggers

Kubernetes, active-active multi-region, Kafka, and self-managed PostgreSQL are deferred. Revisit when measured fleet size, provider routing, replay/fanout, regional recovery objectives, or operational economics exceed ECS/BullMQ/RDS assumptions. Multi-region is not a default scale badge; it changes tenancy, ordering, data residency, and failover semantics.
