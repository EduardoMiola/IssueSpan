# Messaging, channels, and integrations

**Status:** Frozen abstraction; adapters are roadmap work.

~~~text
MessagingChannel → ZapoWhatsAppAdapter (v0.1)
MessagingChannel → EmailChannel → EmailProvider → Postmark (v1.0 first)
EngineeringIssueProvider → GitHub, Jira, Linear adapters
~~~

The domain depends on ports. Adapters validate, authenticate, normalize, deduplicate, and translate provider calls. Provider SDK types never leak into domain or API contracts.

Normalized envelopes carry organization, connection, stable event ID, direction, participants, content, attachments, timestamp, and correlation metadata. Canonical delivery is QUEUED/SENDING/SENT/DELIVERED/FAILED; READ, OPENED, BOUNCED, COMPLAINT, and DELIVERY_DELAYED remain channel events. Email open is not WhatsApp read.

Zapo is the flagship v0.1 integration and remains infrastructure state. Channel workers own long-lived sessions; outbound sends are queued. Credentials, QR/session state, and raw payloads require encryption, redaction, retention, and access controls.

Postmark is first for v1.0 because the design needs inbound processing and delivery signals, not only SMTP. Store provider ID separately from an IssueSpan Internet Message-ID. Route inbound mail by opaque reply token, In-Reply-To, References, trustworthy provider metadata, then conservative heuristic. A token is routing capability, not authentication. If confidence is low, create a new conversation. Sanitize HTML, block external images, and treat attachments as untrusted.

Webhook flow: verify authenticity, deduplicate, persist inbox, return promptly, process asynchronously, update projection, and emit audit/realtime events.
