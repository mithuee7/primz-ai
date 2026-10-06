import { after, NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { runPipeline } from "@/lib/services/ai/pipeline";
import { ingestInboundEvent } from "@/lib/services/ingest";
import { getInstagramService, InstagramNotConfiguredError, WebhookValidationError } from "@/lib/services/instagram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET: Meta subscription handshake (hub.mode / hub.verify_token / hub.challenge).
 * TODO(meta): set META_VERIFY_TOKEN, then enter this URL + token in the Meta app's webhook settings.
 */
export async function GET(request: NextRequest) {
  const challenge = getInstagramService().verifyWebhookChallenge(request.nextUrl.searchParams);
  if (challenge === null) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

/**
 * POST: incoming Instagram messages.
 * validate signature -> identify conversation -> store (idempotent) -> if auto chat on, run the AI pipeline.
 * The pipeline runs AFTER the 200 response (Meta retries slow or failed webhooks).
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`webhook:${ip}`, 300, 60_000).ok) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  const rawBody = await request.text(); // raw bytes are required for signature verification
  const ig = getInstagramService();

  let events;
  try {
    events = await ig.handleWebhook(rawBody, request.headers);
  } catch (err) {
    if (err instanceof WebhookValidationError) return new NextResponse("Invalid signature", { status: 401 });
    if (err instanceof InstagramNotConfiguredError) return new NextResponse("Instagram integration not configured", { status: 503 });
    console.error("[webhook] parse failure:", err instanceof Error ? err.message : "unknown");
    return new NextResponse("Bad request", { status: 400 });
  }

  const ownerId = getEnv().OWNER_USER_ID;
  if (!ownerId) {
    // TODO(meta): single-tenant for now. Map the IG business account id to an owner when going multi-tenant.
    console.error("[webhook] OWNER_USER_ID is not set; dropping events");
    return new NextResponse("Server not configured", { status: 503 });
  }

  const toProcess: string[] = [];
  try {
    for (const event of events) {
      const result = await ingestInboundEvent(ownerId, event);
      if (result.shouldRunPipeline) toProcess.push(result.conversationId);
    }
  } catch (err) {
    // Non-2xx so Meta retries; storage is idempotent so retries are safe.
    console.error("[webhook] storage failure:", err instanceof Error ? err.message : "unknown");
    return new NextResponse("Storage error", { status: 500 });
  }

  for (const conversationId of new Set(toProcess)) {
    after(async () => {
      const outcome = await runPipeline({ ownerId, conversationId });
      console.log(`[pipeline] conversation=${conversationId} outcome=${outcome.status}`);
    });
  }

  return NextResponse.json({ received: events.length });
}
