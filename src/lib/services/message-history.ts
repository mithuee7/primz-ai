// src/lib/services/message-history.ts

import { createAdminClient } from "@/lib/supabase/clients";

export interface MetaMessage {
  mid?: string;
  id: string;
  message?: string;
  from: {
    id: string;
    email?: string;
    name?: string;
  };
  created_time: string;
  sticker?: string;
  image?: {
    height: number;
    width: number;
    image_type: string;
    url: string;
  };
}

/**
 * Fetch full message history from Meta Graph API
 * Calls the API to get more than the initial 10-15 messages
 */
export async function fetchFullMessageHistory(
  conversationId: string,
  accessToken: string,
  limit: number = 100
): Promise<MetaMessage[]> {
  try {
    const allMessages: MetaMessage[] = [];
    let after = null;
    const pageSize = 25;

    // Fetch in pages
    for (let i = 0; i < Math.ceil(limit / pageSize); i++) {
      const params = new URLSearchParams({
        access_token: accessToken,
        fields: "message,from,created_time,sticker,image",
        limit: Math.min(pageSize, limit - allMessages.length).toString(),
      });

      if (after) {
        params.append("after", after);
      }

      const url = `https://graph.instagram.com/${conversationId}/messages?${params.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Meta Graph API error: ${response.statusText} - ${await response.text()}`
        );
      }

      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        break; // No more messages
      }

      allMessages.push(...data.data);

      // Check for pagination
      if (data.paging?.cursors?.after) {
        after = data.paging.cursors.after;
      } else {
        break; // No more pages
      }

      if (allMessages.length >= limit) {
        break;
      }
    }

    return allMessages;
  } catch (error) {
    console.error("Error fetching message history:", error);
    return [];
  }
}

/**
 * Store fetched messages in Supabase and mark as loaded
 */
export async function storeMessageHistory(
  conversationId: string,
  userId: string,
  messages: MetaMessage[]
): Promise<void> {
  const supabase = createAdminClient();

  // Store the raw message history (update the conversation record)
  const { error } = await supabase
    .from("conversations")
    .update({
      full_history_loaded: true,
      message_count_cached: messages.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .eq("owner_id", userId);

  if (error) throw error;

  // Also store individual messages if needed
  // This is optional - you can fetch fresh each time if preferred
  const messagesToInsert = messages
    .filter((m) => m.message || m.sticker || m.image) // Only actual messages
    .map((m) => ({
      conversation_id: conversationId,
      sender_id: m.from.id,
      content: m.message || (m.sticker ? "[sticker]" : "[image]"),
      sent_at: new Date(m.created_time).toISOString(),
      meta_message_id: m.id,
      meta_created_time: m.created_time,
    }));

  if (messagesToInsert.length > 0) {
    // Note: This assumes you have a way to insert messages
    // Adjust based on your existing messages table structure
    const { error: insertError } = await supabase
      .from("messages")
      .upsert(messagesToInsert, { onConflict: "meta_message_id" });

    if (insertError) {
      console.warn("Could not store individual messages:", insertError);
      // Don't throw - this is non-critical
    }
  }
}

/**
 * Get or fetch message history for a conversation
 * Returns cached if already loaded, otherwise fetches from API
 */
export async function getConversationMessages(
  conversationId: string,
  userId: string,
  accessToken: string
): Promise<MetaMessage[]> {
  const supabase = createAdminClient();

  // Check if we already have the full history
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("full_history_loaded, message_count_cached")
    .eq("id", conversationId)
    .eq("owner_id", userId)
    .single();

  if (error) {
    console.warn("Could not check conversation history status:", error);
  }

  // If already loaded, fetch from database
  if (conversation?.full_history_loaded) {
    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("sent_at", { ascending: true });

    if (messages && messages.length > 0) {
      return messages.map((m: any) => ({
        id: m.meta_message_id || m.id,
        message: m.content,
        from: { id: m.sender_id },
        created_time: m.sent_at || m.meta_created_time,
      }));
    }
  }

  // Otherwise fetch fresh from Meta
  const messages = await fetchFullMessageHistory(conversationId, accessToken, 100);

  // Store for future use
  await storeMessageHistory(conversationId, userId, messages);

  return messages;
}

/**
 * Format messages for AI context
 */
export function formatMessagesForAI(messages: MetaMessage[]): string {
  return messages
    .map((m) => {
      const sender = m.from.name || m.from.id;
      const content = m.message || (m.sticker ? "[sticker sent]" : "[image sent]");
      return `${sender}: ${content}`;
    })
    .join("\n");
}

/**
 * Get recent messages for context (last N messages)
 */
export function getRecentMessagesForContext(
  messages: MetaMessage[],
  count: number = 20
): MetaMessage[] {
  // Sort by created_time descending (newest first), then take the last count
  return messages
    .sort((a, b) => new Date(b.created_time).getTime() - new Date(a.created_time).getTime())
    .slice(0, count)
    .reverse(); // Reverse to get chronological order
}
