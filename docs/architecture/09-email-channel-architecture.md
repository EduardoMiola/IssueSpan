# Email channel architecture

Status: **REQUIRED for v1; planned.**

Email is a v1 channel, not a v0.1 promise. Use a managed provider rather than running an MTA. Postmark is the first end-to-end provider because it gives a bounded transactional API and inbound webhook model; the provider remains behind an `EmailProvider` port.

Email uses the general worker. It does not fake a long-lived `connect`/`disconnect` lifecycle or occupy a channel-worker slot. Channel capabilities distinguish send, receive, delivery events, and runtime health from session-oriented operations.

Inbound flow: verify webhook authenticity, store a dedupe inbox record, normalize headers/body/attachments, resolve the Organization and conversation route, then commit Message plus processing intent. `Reply-To` includes an opaque route token and is primary. `In-Reply-To`/`References` are secondary. Conservative fallback may use a signed address or known participant; subject alone is never sufficient.

Store `Message-ID`, `In-Reply-To`, and `References`. Reply parsing is best effort and preserves a safe raw/quoted boundary. Sanitize HTML, block remote images by default, and keep scripts/active content out. Attachments go to object storage only after size/type validation, quarantine, and a scanning interface; workers never trust filename extensions.

CC and participants have explicit semantics and privacy rules. Provider states distinguish accepted, delivered, bounced, and complained. Without open tracking, READ is not inferred; the default is not-read/unknown. If the provider accepts a message and the process dies before updating Postgres, the result is ambiguous and reconciliation/idempotency handles it. Recipient suppression and bounce health are first-class operational concerns.

SPF, DKIM, and DMARC are deliverability controls. They are not application-user authentication or authorization.

## Threading and privacy detail

Outbound mail gets an IssueSpan-owned RFC Message-ID before the provider call and an opaque random Reply-To route token. Store only a token hash in `email_reply_routes` with Organization, ChannelConnection, and Conversation. The token routes a reply but does not authenticate the sender because forwarding can leak it.

Resolve inbound threading by route token, `In-Reply-To`, `References`, trustworthy provider metadata, then conservative participant/subject/time heuristics. Never use subject alone; ambiguous mail starts a new Conversation because a false split is safer than cross-customer disclosure. Keep provider Message ID separate from RFC Internet Message-ID, preserve original addresses, and model To/Cc/Reply-All participants explicitly.

Email delivery semantics differ from WhatsApp: provider acceptance is SENT, receiving mail-system acceptance is DELIVERED, and OPENED is not READ. Permanent bounce or complaint can suppress a recipient. Mail loops and auto-replies need classification and rate limits.
