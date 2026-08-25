# Docker and local development

Status: **CURRENT local-development direction; planned implementation.**

An image is an immutable packaged filesystem and metadata. A container is a running instance. A registry stores images. A Dockerfile describes reproducible build steps. Compose defines cooperating containers. A volume persists data outside a container. A network gives services stable names. A port maps a host port to a container port.

IssueSpan uses Docker to make Postgres, Valkey, and MinIO/object-storage behavior reproducible across laptops and CI. Initially developers may run TypeScript apps with pnpm while infrastructure runs in Compose. A later self-host path can run the complete stack as OCI images.

Compose must define health checks, named volumes, networks, safe local defaults, and clear startup ordering. Data persistence is intentional and reset procedures are documented. `.env` files are local-only; secrets are never committed. Test fixtures contain no real customer data.

Images use multi-stage builds, minimal runtime layers, non-root users where practical, deterministic lockfiles, and immutable tags/digests. A local image is not production evidence; CI scans and promotes the same digest.
