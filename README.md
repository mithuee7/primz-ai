# Primz AI

Instagram DM conversation automation dashboard. You send the cold DM by hand. When a lead replies, you switch **Auto Chat** on for that one conversation. The AI continues the chat, a second AI checks every reply, and anything uncertain is held for you instead of being sent.

> **Instagram is not connected.** Nothing in this repo has been tested against the real Meta API. See [Connecting Instagram](#connecting-instagram).

## What's built

- Next.js 15 (App Router) + TypeScript (strict) + Tailwind + Zod + Lucide, Supabase for auth/DB, Groq for AI.
- **Pages:** Dashboard, Chats (list + DM-style conversation, mobile-first), Needs Review, Leads, Services, Settings, Login.
- **Per-chat controls:** Auto Chat toggle, Take Over, lead type, services (all or selected, stored as IDs), tone, extra instructions, read-only AI memory view.
- **Pipeline** (`src/lib/services/ai/pipeline.ts`): incoming message → conversation lookup → `auto_chat_enabled` check → last 20 messages + state + selected services → Conversation AI → schema validation → rule guards → Output Checker AI → deterministic cleanup → final validation → re-check live state → send via `InstagramService` → save message → update state.
- **Fail closed:** any error, malformed JSON, checker failure, low confidence, listed issue, or state change means nothing is sent and the chat is flagged `needs_review`.
- **Server-side enforcement:** Take Over / Auto Chat are enforced in the pipeline (re-checked immediately before every send), not just in the UI. A per-conversation lock prevents double replies.
- **Audit trail:** `ai_generations` (what the model wrote) is separate from `messages` (what was sent); `ai_reviews` holds rule, AI and manual reviews.
- **Safety extras:** prompt-injection phrases from a lead and "are you a bot?" questions are escalated to a human and never auto-answered.
- **Cleanup** (`src/lib/text/cleanup.ts`): separator dashes become `, `; `follow-up`, `AI-powered`, `co-ordinate` and numeric ranges are untouched. Unit tested.

## Run it (demo mode, no accounts needed)

```bash
npm install
cp .env.example .env.local     # DEMO_MODE=true is the default
npm run dev                    # http://localhost:3000
```

Demo mode seeds four chats (dentist, real estate, UGC creator, local business) at different stages, uses in-memory data (resets on restart), and a mock Instagram. A yellow banner shows whenever demo mode is on.

With no Groq key, demo mode uses a **scripted stand-in** (`src/lib/services/llm/demo.ts`). It is keyword rules, not an AI. Add a Groq key (Settings or `GROQ_API_KEY`) to use the real models.

In a chat, open the sliders icon → **Demo tools** to simulate lead messages, force a bad draft to watch the checker reject it, and reset data.

```bash
npm test          # 52 unit/pipeline tests
npm run typecheck
npm run build
```

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DEMO_MODE` | no | `true` forces demo. Also on automatically if Supabase vars are missing. |
| `NEXT_PUBLIC_SUPABASE_URL` | for real use | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | for real use | Used for auth only. |
| `SUPABASE_SERVICE_ROLE_KEY` | for real use | **Server only.** |
| `GROQ_API_KEY` | one of these | Or save a key in Settings (needs `APP_ENCRYPTION_KEY`). |
| `APP_ENCRYPTION_KEY` | to save keys in UI | `openssl rand -base64 32` |
| `GROQ_MODEL`, `GROQ_CHECKER_MODEL` | no | Default `llama-3.3-70b-versatile`. Also editable in Settings. |
| `CHECKER_MIN_CONFIDENCE` | no | Default 0.85. Editable in Settings. |
| `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PAGE_ACCESS_TOKEN`, `META_IG_BUSINESS_ACCOUNT_ID` | for Instagram | See below. |
| `OWNER_USER_ID` | for webhook | Supabase user id that owns incoming webhook chats (single-tenant for now). |

Only `NEXT_PUBLIC_*` values reach the browser. Secrets are read in server-only modules; the saved Groq key is AES-256-GCM encrypted and never sent back to the client.

## Database setup

1. Create a Supabase project.
2. Run `supabase/migrations/0001_init.sql` in the SQL editor (tables, foreign keys, indexes, RLS, profile trigger).
3. Fill in the three Supabase env vars, set `DEMO_MODE=false`, restart.
4. Create an account on `/login`. On first use the app seeds default settings and the services list for that user.

RLS restricts every table to `owner_id = auth.uid()`. `app_settings` has no policies on purpose (service role only). The server uses the service-role key **and** scopes every query by `owner_id`, so authorization does not depend on RLS alone.

## What is mocked

| Piece | Status |
|---|---|
| Instagram send/read | `MockInstagramService`. Messages are stored and labelled "simulated". Nothing is delivered. |
| Meta implementation | `meta.ts` is partial: webhook signature check, GET handshake and payload parsing are written; `sendMessage`, `getProfile`, `getMessages`, `getConversation` throw "not implemented". |
| AI without a key (demo only) | Scripted `DemoLLM`, clearly labelled. |
| Data in demo mode | In memory, seeded demo conversations. |

## Connecting Instagram

Not done yet. Exact steps:

1. Create a Meta app; add the Instagram messaging product; connect an Instagram **Professional** account.
2. Set `META_APP_SECRET`, `META_VERIFY_TOKEN` (any string you choose), `META_PAGE_ACCESS_TOKEN`, `META_IG_BUSINESS_ACCOUNT_ID`, and `OWNER_USER_ID`.
3. Deploy over HTTPS. In the Meta app webhook settings use `https://YOUR_DOMAIN/api/webhooks/instagram` and your verify token; subscribe to `messages`.
4. Implement the `TODO(meta)` methods in `src/lib/services/instagram/meta.ts` (send via the Graph API messages endpoint, profile lookup, history backfill, 429/5xx handling). Nothing else in the app needs to change.
5. Validate `parseMetaMessagingPayload` against real payloads, including echoes of DMs you send manually from the Instagram app.
6. Request `instagram_manage_messages` and pass App Review. Mind Meta's messaging window rules.
7. Only then should the status badge claim a connection. Today `getStatus()` always reports not connected.

## Known limitations

- **Untested against live services:** Groq calls, the Supabase repository, and Meta have not been run against the real things in this environment (no keys). The in-memory path, pipeline logic and UI are tested.
- Rate limiting is in-memory per process; use a shared store (Redis/Supabase) on serverless or multi-instance hosting.
- The webhook is single-tenant (`OWNER_USER_ID`).
- The chat view polls every 6 seconds rather than using realtime subscriptions.
- Service seed data comes from what primz-ai.onrender.com says publicly, which is brief. **Review and edit it on the Services page**; the AI treats those rows as its only source of truth.
- Webhook processing runs after the response via `after()`; on hosts that cut work off after responding, move it to a queue.
- Text/DM only: attachments, reactions and read receipts are ignored.
- The checker is an LLM and can be wrong. The deterministic rules and "approve only if confidence ≥ threshold and no issues" logic reduce risk but do not remove it; review early conversations before trusting Auto Chat broadly.
