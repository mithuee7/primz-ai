import "server-only";
import { getRepository } from "@/lib/repo";
import type { InboundEvent } from "@/lib/services/instagram";

export interface IngestResult {
  conversationId: string;
  duplicate: boolean;
  /** True when the event is a lead message on a chat with auto chat enabled. */
  shouldRunPipeline: boolean;
}

/**
 * Stores one normalized inbound event (shared by the webhook route and the demo simulator).
 * Identifies/creates the conversation, stores the message idempotently, and reports
 * whether the AI pipeline should run. It never triggers the pipeline itself.
 */
export async function ingestInboundEvent(ownerId: string, event: InboundEvent): Promise<IngestResult> {
  const repo = getRepository();
  const conv = await repo.upsertConversationByThread(ownerId, {
    external_thread_id: event.thread.externalThreadId,
    lead_external_id: event.thread.profile.externalId,
    lead_name: event.thread.profile.name,
    lead_username: event.thread.profile.username,
    lead_avatar_url: event.thread.profile.avatarUrl,
  });

  const fromLead = !event.message.isEcho;
  const { created } = await repo.addMessage(ownerId, {
    conversation_id: conv.id,
    external_message_id: event.message.externalMessageId,
    sender_type: fromLead ? "lead" : "me",
    sender_name: fromLead ? conv.lead_name : "You",
    content: event.message.text,
    created_at: event.message.timestamp,
    metadata: { source: "webhook" },
  });

  return {
    conversationId: conv.id,
    duplicate: !created,
    shouldRunPipeline: created && fromLead && conv.settings.auto_chat_enabled,
  };
}
