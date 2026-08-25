# Email channel architecture

Status: **REQUIRED for v1; planned.**

Email is a v1 channel, not a v0.1 promise. Use a managed provider rather than running an MTA. Postmark is the first end-to-end provider because it gives a bounded transactional API and inbound webhook model; the provider remains behind an `EmailProvider` port.

Email uses the general worker. It does not fake a long-lived `connect`/`disconnect` lifecycle or occupy a channel-worker slot. Channel capabilities distinguish send, receive, delivery events, and runtime health from session-oriented operations.

Inbound flow: verify webhook authenticity, store a dedupe inbox record, normalize headers/body/attachments, resolve the Organization and conversation route, then commit Message plus processing intent. `Reply-To` includes an opaque route token and is primary. `In-Reply-To`/`References` are secondary. Conservative fallback may use a signed address or known participant; subject alone is never sufficient.

Store `Message-ID`, `In-Reply-To`, and `References`. Reply parsing is best effort and preserves a safe raw/quoted boundary. Sanitize HTML, block remote images by default, and keep scripts/active content out. Attachments go to object storage only after size/type validation, quarantine, and a scanning interface; workers never trust filename extensions.

CC and participants have explicit semantics and privacy rules. Provider states distinguish accepted, delivered, bounced, and complained. Without open tracking, READ is not inferred; the default is not-read/unknown. If the provider accepts a message and the process dies before updating Postgres, the result is ambiguous and reconciliation/idempotency handles it. Recipient suppression and bounce health are first-class operational concerns.

SPF, DKIM, and DMARC are deliverability controls. They are not application-user authentication or authorization.
