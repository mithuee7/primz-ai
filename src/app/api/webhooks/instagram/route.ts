import crypto from "crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { getRepository } from "@/lib/repo";
import { rateLimit } from "@/lib/rate-limit";
import { runPipeline } from "@/lib/services/ai/pipeline";
import { sweepStaleReplyClaims } from "@/lib/services/ai/claims";
import { enrichConversation, ingestInboundEvent, type IngestResult } from "@/lib/services/ingest";
import { InstagramNotConfiguredError, WebhookValidationError } from "@/lib/services/instagram";
import { MetaInstagramService, extractEntryIds } from "@/lib/services/instagram/meta";
import { loadMetaConfig } from "@/lib/services/instagram/meta-config";
import { ensureFreshInstagramToken } from "@/lib/services/instagram/token";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Validates Meta x-hub-signature-256 header directly against the raw binary request buffer.
 * Prints exact received vs. computed HMAC SHA-256 hashes for precise debugging.
 */
function verifyMetaSignature(rawBuffer: Buffer, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !appSecret) {
    console.error("[webhook-debug] Signature check failed: missing header or secret");
    return false;
  }

  const receivedHash = signatureHeader.replace(/^sha256=/, "").trim();
  const secret = appSecret.trim();

  // Compute HMAC directly on the exact raw binary buffer sent by Meta
  const computedHash = crypto
    .createHmac("sha256", secret)
    .update(rawBuffer)
    .digest("hex");

  console.log("[webhook-debug] --------------------------------------------------");
  console.log("[webhook-debug] RECEIVED FROM META:    ", receivedHash);
  console.log("[webhook-debug] COMPUTED BY SERVER:  ", computedHash);
  console.log("[webhook-debug] SECRET KEY PREFIX:    ", secret.substring(0, 10));
  console.log("[webhook-debug] RAW BUFFER BYTE SIZE: ", rawBuffer.length);
  console.log("[webhook-debug] --------------------------------------------------");

  const receivedBuffer = Buffer.from(receivedHash, "utf-8");
  const computedBuffer = Buffer.from(computedHash, "utf-8");

  if (receivedBuffer.length !== computedBuffer.length) {
    console.error("[webhook-debug] Buffer length mismatch:", receivedBuffer.length, "vs", computedBuffer.length);
    return false;
  }

  return crypto.timingSafeEqual(receivedBuffer, computedBuffer);
}

/**
 * GET: Meta's subscription handshake.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const token = params.get("hub.verify_token");
  if (params.get("hub.mode") !== "subscribe" || !token) return new NextResponse("Forbidden", { status: 403 });

  const ownerId = await getRepository().findOwnerByMeta({ verifyToken: token });
  const cfg = ownerId ? await loadMetaConfig(ownerId) : null;
  const challenge = cfg ? new MetaInstagramService(cfg).verifyWebhookChallenge(params) : null;
  if (challenge === null) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

/**
 * POST: incoming Instagram messages.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`webhook:${ip}`, 300, 60_000).ok) return new NextResponse("Too many requests", { status: 429 });

  // 1. Read exact binary bytes to prevent UTF-8 string encoding discrepancies
  const arrayBuffer = await request.arrayBuffer();
  const rawBuffer = Buffer.from(arrayBuffer);
  const rawBody = rawBuffer.toString("utf-8");

  let entryIds: string[];
  try {
    entryIds = extractEntryIds(JSON.parse(rawBody));
  } catch (err) {
    console.error("[webhook] extract failed:", err instanceof Error ? err.message : "unknown");
    return new NextResponse("Bad request", { status: 400 });
  }

  console.log("[webhook] extracted entryIds:", entryIds);

  const repo = getRepository();
  const ownerId = await repo.findOwnerByMeta({ igIds: entryIds });
  console.log("[webhook] findOwnerByMeta result:", ownerId ? "found" : "NOT FOUND");
  const cfg = ownerId ? await loadMetaConfig(ownerId) : null;
  if (!ownerId || !cfg) {
    console.error("[webhook] account not found or config missing. entryIds:", entryIds, "ownerId:", ownerId);
    return new NextResponse("Unknown account", { status: 401 });
  }

  await ensureFreshInstagramToken(ownerId);
  const freshCfg = (await loadMetaConfig(ownerId)) ?? cfg;
  const ig = new MetaInstagramService(freshCfg);

  const sigHeader = request.headers.get("x-hub-signature-256");

  // 2. Perform timing-safe binary HMAC verification with hash logs
  const isValidSig = verifyMetaSignature(rawBuffer, sigHeader, freshCfg.appSecret);
  if (!isValidSig) {
    console.error("[webhook] Direct signature verification FAILED");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  // 3. Construct compatible headers for Meta service handler
  const headersObject = Object.fromEntries(request.headers.entries());
  const compatibleHeaders = Object.assign(headersObject, {
    get: (key: string) => request.headers.get(key),
  });

  let events;
  try {
    events = await ig.handleWebhook(rawBody, compatibleHeaders as unknown as Headers);
    console.log("[webhook] signature verified, events parsed:", events.length);
  } catch (err) {
    if (err instanceof WebhookValidationError) {
      console.error("[webhook] ig.handleWebhook validation failed:", err.message);
      return new NextResponse("Invalid signature", { status: 401 });
    }
    if (err instanceof InstagramNotConfiguredError) return new NextResponse("Instagram integration not configured", { status: 503 });
    console.error("[webhook] parse failure:", err instanceof Error ? err.message : "unknown");
    return new NextResponse("Bad request", { status: 400 });
  }

  // 4. Ingest inbound events idempotently
  const accepted: IngestResult[] = [];
  try {
    for (const event of events) accepted.push(await ingestInboundEvent(ownerId, event));
  } catch (err) {
    console.error("[webhook] storage failure:", err instanceof Error ? err.message : "unknown");
    return new NextResponse("Storage error", { status: 500 });
  }

  const duplicates = accepted.filter((r) => r.duplicate).length;
  const toEnrich = accepted.filter((r) => r.isNew || r.needsProfile);
  const toProcess = new Set(accepted.filter((r) => r.shouldRunPipeline).map((r) => r.conversationId));

  // 5. Trigger background processing post-response
  if (toEnrich.length > 0 || toProcess.size > 0) {
    after(async () => {
      try {
        const seen = new Set<string>();
        for (const info of toEnrich) {
          if (seen.has(info.conversationId)) continue;
          seen.add(info.conversationId);
          await enrichConversation(ownerId, info, ig);
        }
        await sweepStaleReplyClaims(ownerId);
        for (const conversationId of toProcess) {
          const outcome = await runPipeline({ ownerId, conversationId });
          console.log(`[pipeline] conversation=${conversationId} outcome=${outcome.status}`);
        }
      } catch (err) {
        console.error("[webhook] background work failed:", err instanceof Error ? err.message : "unknown");
      }
    });
  }

  return NextResponse.json({ received: events.length, duplicates });
}
