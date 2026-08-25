# Roadmap

Status: **PLANNED; sequence is directional and Jira is authoritative for delivery.**

1. Repository foundation: documentation, ADRs, CI conventions, local stack, and OSS governance.
2. Walking skeleton: tenancy/RLS, sessions, domain modules, Conversation/Message, API, outbox, worker, React shell, SSE, and golden path.
3. Zapo hardening: channel-worker ownership, leases/fencing, reconnect control, diagnostics, and fake-provider E2E.
4. Engineering workflow: GitHub full, Customer Impact projection, then Linear and Jira capability-based adapters.
5. v1 Email: Postmark inbound/outbound, threading, attachments, delivery/suppression, and operational runbooks.
6. Production hardening: AWS ECS/OpenTofu, backups/restore, security gates, performance profiles, release automation, and self-host update documentation.
7. Later scale: partitioned workers, cells, read replicas, dedicated databases, multi-region, and additional channels only where evidence supports them.

Deferred: microservices by default, a graph database, self-hosted MTA, WebSockets before SSE limitations appear, multi-region active/active, custom RBAC UI before capability policy is stable, and invented benchmark promises.
