# Docker and local development

Status: **CURRENT for local infrastructure; production application containers are PLANNED.**

IssueSpan uses Docker Compose for dependencies that should behave the same on each developer machine: PostgreSQL 18, Valkey, and MinIO. Node/React processes run on the host with `pnpm dev` while the application is being built, keeping hot reload and debugging fast. `apps/web`, `apps/api`, `apps/worker`, and `apps/channel-worker` will receive production-shaped images in later work.

This Compose file is for local development only. It is not a hardened deployment: ports are published on the developer machine, the credentials are examples, and the services do not replace production security controls.

## Docker in five concepts

- An **image** is a packaged filesystem and startup metadata. A **container** is a running instance of an image. A container can be replaced without replacing its named volumes.
- A **Dockerfile** is a recipe for building an application image. **Compose** is a local orchestration file that starts existing images, networks them, maps ports, mounts volumes, and adds healthchecks.
- A **registry** stores and distributes images, such as Docker Hub or a private registry. Pulling an image is not the same as running a container.
- A port mapping is `host:container`: `5432:5432` means `localhost:5432` on the host reaches port `5432` inside PostgreSQL. Containers reach each other through the Compose network using service names such as `postgres`, `valkey`, and `minio`, not `localhost`.
- A **named volume** is Docker-managed storage outside the container filesystem. It lets PostgreSQL and MinIO data survive `down` and container recreation. Valkey also has a volume because its AOF persistence is useful when debugging queues locally; Valkey remains replaceable queue/cache infrastructure, not source-of-truth data.

Compose injects environment variables from `.env` and the shell. `.env.example` is safe to copy, contains no real secret, and must remain committed. Healthchecks use `pg_isready`, `valkey-cli ping`, and MinIO's live endpoint so startup and troubleshooting distinguish a running process from a ready service. `depends_on` makes the bucket initializer wait for MinIO readiness.

## Quickstart

```bash
cp .env.example .env
pnpm infra:up
pnpm infra:ps
```

The `minio-init` helper creates `issuespan-development` deterministically and exits after success. It is safe to run again because bucket creation uses `--ignore-existing`.

Run applications on the host as they are implemented:

```text
pnpm dev                 # the eventual root development command
pnpm --filter web dev    # when apps/web exists
pnpm --filter api dev    # when apps/api exists
```

The current branch only provides infrastructure scripts; application packages and their `dev` commands belong to later issues.

## Everyday commands

```bash
pnpm infra:up                 # create/start services in the background
pnpm infra:ps                 # status and health
pnpm infra:logs              # follow all logs
docker compose logs postgres # follow one service
docker compose exec postgres pg_isready -U issuespan -d issuespan
docker compose exec valkey valkey-cli ping
curl -f http://localhost:9000/minio/health/live
pnpm infra:down               # stop and remove containers; keep volumes
```

`docker compose down` removes containers and the network but keeps named volumes. `docker compose down -v`, exposed as `pnpm infra:reset`, also removes `postgres_data`, `valkey_data`, and `minio_data`. That destroys local database rows, queue-debugging state, and objects; use it only when explicitly intending a clean reset.

## Connection contract

Host applications use the values in `.env`, especially `DATABASE_URL`, `VALKEY_URL`, `S3_ENDPOINT`, and `S3_BUCKET`. Applications inside Compose use service DNS: PostgreSQL is `postgres:5432`, Valkey is `valkey:6379`, and MinIO is `http://minio:9000`. MinIO uses path-style addressing locally (`S3_FORCE_PATH_STYLE=true`) because it avoids host-bucket DNS setup.

The local Valkey command sets `maxmemory-policy noeviction`, the expected policy for BullMQ: queue keys must not silently disappear because of cache eviction. This does not make local Valkey production-safe or durable application truth; PostgreSQL owns durable intent.

## Troubleshooting and manual checks

If a port is already in use, change `POSTGRES_PORT`, `VALKEY_PORT`, `MINIO_API_PORT`, or `MINIO_CONSOLE_PORT` in `.env`. Update only host-side connection settings; container-to-container ports stay `5432`, `6379`, `9000`, and `9001`.

If a service is unhealthy, run `pnpm infra:logs`, then `docker compose ps`. Check that the Docker daemon is running and that image pulls completed. Preserve a stale volume unless a clean reset is truly intended. If the bucket is missing, run `docker compose run --rm minio-init` after MinIO is healthy.

```bash
docker compose exec postgres psql -U issuespan -d issuespan -c 'select version();'
docker compose exec valkey valkey-cli ping
curl -f http://localhost:9000/minio/health/live
```

## Local containers versus production

Local PostgreSQL, Valkey, and MinIO are disposable developer dependencies. Production is planned to use managed RDS PostgreSQL, ElastiCache Valkey, and S3, with private networking, backups, encryption, IAM/secret management, monitoring, and controlled access. Those managed services are not simply these containers moved to AWS: availability, credentials, storage, upgrades, network boundaries, and operational responsibilities differ.

Later work may build immutable multi-stage application images and run the full self-host shape. This task deliberately does not add application Dockerfiles, Kubernetes, AWS resources, Testcontainers integration, Kafka, SMTP, or production secrets tooling.
