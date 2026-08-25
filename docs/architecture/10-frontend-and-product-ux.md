# Frontend and product UX

Status: **CURRENT product direction; planned implementation.**

The web application uses React 19.2, Vite, Router, TanStack Query, React Hook Form, Tailwind, and shadcn-style primitives. The generated API client is the only browser boundary to the API; provider SDKs and database types never reach the frontend.

Planned routes include sign-in, organization selection, inbox, conversation detail, Customer Account context, Engineering Issue/escalation views, integrations, channel diagnostics, members, and settings. Product language hides provider-specific concepts where possible: users see “Engineering issue” and “connection” rather than being forced to understand every provider's terminology.

SSE carries authorized invalidation events. TanStack Query refetches the authoritative resource; the client does not reconstruct business state from an event payload. Inbox UX must show loading, empty, error, stale/offline, permission-denied, optimistic/queued, and retry states. Conversation timelines distinguish queued, sent, delivered, failed, and ambiguous outcomes.

Customer context should make account identity, recent conversations, linked escalations, and impact visible without dumping sensitive data. Connection diagnostics explain the last known state, freshness, incident, and safe next action. A platform operator view is a separate permission boundary.

Target WCAG 2.2 AA: keyboard navigation, focus management, semantic labels, contrast, reduced motion, screen-reader status updates, and accessible error summaries are part of Definition of Done.

## State ownership and realtime

TanStack Query owns server state; URL owns filters and navigation; React Hook Form plus Zod owns forms; React state owns local UI. Theme, selected workspace, and nav collapse may use Context/localStorage because they are preferences, never secrets. Do not add Redux/Zustand without a concrete cross-cutting state need. The browser stores no bearer token; the API owns the HttpOnly session.

One workspace SSE connection carries small identity signals. A central router coalesces storms, invalidates relevant queries, and refetches after reconnect. REST remains truth. Do not retry 401/403/404/422 automatically, and do not claim external send success from optimistic state. Email HTML is sanitized and isolated. Provider resolution produces a follow-up-needed view; it does not auto-close Conversations.
