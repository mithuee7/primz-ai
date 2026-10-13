import { NextResponse, type NextRequest } from "next/server";
import { getRepository } from "@/lib/repo";
import { runPipeline } from "@/lib/services/ai/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Internal cron endpoint to process due retries from the queue.
 * Call this periodically (e.g., every 5 minutes) from a cron service.
 *
 * Authenticate with a Authorization: Bearer <CRON_SECRET> header.
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;

  if (!auth || auth !== expected) {
    console.error("[retry-queue] unauthorized request");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const repo = getRepository();
  let processed = 0;
  let failed = 0;
  const startTime = Date.now();

  try {
    const dueRetries = await repo.listDueRetries();
    console.log(`[retry-queue] START found ${dueRetries.length} due retries`);

    for (const retry of dueRetries) {
      try {
        console.log(`[retry-queue] retry owner=${retry.owner_id} conversation=${retry.conversation_id}`);
        const outcome = await runPipeline({ ownerId: retry.owner_id, conversationId: retry.conversation_id });
        console.log(`[retry-queue] ✓ outcome=${outcome.status}`);
        processed++;
      } catch (err) {
        console.error(`[retry-queue] ✗ exception:`, err instanceof Error ? err.message : "unknown");
        failed++;
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[retry-queue] DONE processed=${processed} failed=${failed} elapsed=${elapsed}ms`);

    return NextResponse.json({
      processed,
      failed,
      total: dueRetries.length,
      elapsed_ms: elapsed,
    });
  } catch (err) {
    console.error(`[retry-queue] FAILED:`, err instanceof Error ? err.message : "unknown");
    return new NextResponse("Internal error", { status: 500 });
  }
}
