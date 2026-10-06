import "server-only";
import { verifyMetaSignature } from "@/lib/crypto";
import { getEnv } from "@/lib/env";
import {
  InstagramNotConfiguredError,
  WebhookValidationError,
  type ConnectionStatus,
  type InboundEvent,
  type InstagramMessage,
  type InstagramProfile,
  type InstagramService,
  type InstagramThread,
  type SendMessageInput,
  type SendMessageResult,
} from "./types";

/**
 * Real Meta (Instagram Messaging API) implementation.
 *
 * STATUS: PARTIAL AND UNTESTED AGAINST LIVE META.
 *  - Webhook signature verification: implemented + unit tested (crypto.test.ts).
 *  - Webhook GET handshake: implemented (compares META_VERIFY_TOKEN).
 *  - Webhook payload parsing: written against Meta's documented `entry[].messaging[]`
 *    shape but NOT validated against real payloads.
 *  - sendMessage / getProfile / getMessages / getConversation: NOT implemented,
 *    they throw so nothing can silently "succeed".
 *
 * TODO(meta) before going live:
 *  1. Create a Meta app, add the Instagram product (Instagram API with Instagram Login or
 *     Messenger Platform for Instagram), and connect an Instagram Professional account.
 *  2. Set META_APP_SECRET, META_VERIFY_TOKEN, META_PAGE_ACCESS_TOKEN (long-lived),
 *     META_IG_BUSINESS_ACCOUNT_ID in the server environment.
 *  3. Request instagram_manage_messages (and pages_messaging if using a Page token) and pass
 *     App Review. Respect the 24h standard messaging window.
 *  4. Subscribe the app to the `messages` webhook field, callback URL /api/webhooks/instagram.
 *  5. Implement the Graph API calls below (POST /{ig-id}/messages, GET /{ig-scoped-id}
 *     profile fields, GET /{conversation-id}/messages), including 429/5xx handling.
 */
export class MetaInstagramService implements InstagramService {
  readonly kind = "meta" as const;

  private requireEnv(...keys: Array<"META_APP_SECRET" | "META_VERIFY_TOKEN" | "META_PAGE_ACCESS_TOKEN" | "META_IG_BUSINESS_ACCOUNT_ID">) {
    const env = getEnv();
    const missing = keys.filter((k) => !env[k]);
    if (missing.length) throw new InstagramNotConfiguredError(`Missing Meta configuration: ${missing.join(", ")}`);
    return env;
  }

  async getStatus(): Promise<ConnectionStatus> {
    const env = getEnv();
    const missing = (["META_APP_SECRET", "META_VERIFY_TOKEN", "META_PAGE_ACCESS_TOKEN", "META_IG_BUSINESS_ACCOUNT_ID"] as const).filter((k) => !env[k]);
    return {
      kind: "meta",
      connected: false,
      label: "Not connected",
      detail: missing.length
        ? `Missing: ${missing.join(", ")}. Sending is not implemented yet.`
        : "Credentials present, but the Meta send/read API calls are not implemented yet.",
    };
  }

  async getConversation(_externalThreadId: string): Promise<InstagramThread | null> {
    throw new InstagramNotConfiguredError("MetaInstagramService.getConversation is not implemented (TODO(meta)).");
  }

  async getMessages(_externalThreadId: string, _limit: number): Promise<InstagramMessage[]> {
    throw new InstagramNotConfiguredError("MetaInstagramService.getMessages is not implemented (TODO(meta)).");
  }

  async sendMessage(_input: SendMessageInput): Promise<SendMessageResult> {
    throw new InstagramNotConfiguredError("MetaInstagramService.sendMessage is not implemented (TODO(meta)). Nothing was sent.");
  }

  async getProfile(_externalUserId: string): Promise<InstagramProfile | null> {
    throw new InstagramNotConfiguredError("MetaInstagramService.getProfile is not implemented (TODO(meta)).");
  }

  verifyWebhookChallenge(params: URLSearchParams): string | null {
    const { META_VERIFY_TOKEN } = getEnv();
    if (!META_VERIFY_TOKEN) return null;
    if (params.get("hub.mode") !== "subscribe") return null;
    if (params.get("hub.verify_token") !== META_VERIFY_TOKEN) return null;
    return params.get("hub.challenge");
  }

  async handleWebhook(rawBody: string, headers: Headers): Promise<InboundEvent[]> {
    const env = this.requireEnv("META_APP_SECRET");
    const signature = headers.get("x-hub-signature-256");
    if (!verifyMetaSignature(rawBody, signature, env.META_APP_SECRET as string)) {
      throw new WebhookValidationError("Invalid webhook signature");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new WebhookValidationError("Webhook body is not valid JSON");
    }
    return parseMetaMessagingPayload(payload, env.META_IG_BUSINESS_ACCOUNT_ID ?? null);
  }
}

interface MetaMessagingEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean };
}

/** Exported for tests. TODO(meta): validate against real payloads. */
export function parseMetaMessagingPayload(payload: unknown, businessAccountId: string | null): InboundEvent[] {
  const events: InboundEvent[] = [];
  const entries = (payload as { entry?: Array<{ messaging?: MetaMessagingEvent[] }> } | null)?.entry;
  if (!Array.isArray(entries)) return events;

  for (const entry of entries) {
    for (const ev of entry.messaging ?? []) {
      const text = ev.message?.text;
      const mid = ev.message?.mid;
      const senderId = ev.sender?.id;
      const recipientId = ev.recipient?.id;
      if (!text || !mid || !senderId || !recipientId) continue; // attachments, reads, reactions: ignored for now

      const isEcho = Boolean(ev.message?.is_echo) || (businessAccountId !== null && senderId === businessAccountId);
      const leadId = isEcho ? recipientId : senderId;
      events.push({
        thread: {
          externalThreadId: leadId,
          // Real name/username must come from getProfile() once implemented.
          profile: { externalId: leadId, username: leadId, name: leadId, avatarUrl: null },
        },
        message: {
          externalMessageId: mid,
          externalThreadId: leadId,
          senderExternalId: senderId,
          isEcho,
          text,
          timestamp: new Date(ev.timestamp ?? Date.now()).toISOString(),
        },
      });
    }
  }
  return events;
}
