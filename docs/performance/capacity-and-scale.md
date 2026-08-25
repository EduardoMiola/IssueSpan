# Capacity and scale

Status: **PLANNED measurement framework; no production benchmarks claimed.**

Workload models separate API reads/writes, outbox throughput, general jobs, SSE connections, and Zapo sessions. “1M RPS” must name the workload, payload, tenant mix, durability, and provider side effect; API, worker, and channel-worker scaling are independent.

Budget Postgres connections across every replica and worker. Observe query latency, locks, pool wait, WAL, storage, and replica lag. Observe Valkey memory, command latency, queue depth, retries, and eviction. Apply tenant fairness, queue quotas, bulkheads, and load shedding before adding capacity.

k6 profiles: steady state, spike, soak, and breakpoint. Zapo benchmarks vary memory/session, message rate, media, reconnect frequency, file descriptors, cache size, event-loop lag, and GC pauses. Autoscaling signals include queue age, lease utilization, event-loop lag, connection health, and saturation—not CPU alone.

Evolution is measured partitioning, cells, read replicas, dedicated databases, and multi-region. Each step needs a failure-domain argument, data movement plan, observability, and rollback story.
