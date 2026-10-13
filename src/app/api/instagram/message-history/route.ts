import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getRepository } from "@/lib/repo";
import { getInstagramService } from "@/lib/services/instagram";

/**
 * Fetch last 10-15 messages from Instagram for a conversation.
 * Used to provide better context to the AI when generating replies.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const { conversation_id } = (await request.json()) as { conversation_id: string };

    const repo = getRepository();
    const conv = await repo.getConversation(user.id, conversation_id);
    if (!conv) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const ig = await (await getInstagramService(user.id)).getStatus();
    if (!ig.connected) {
      return NextResponse.json({ error: "Instagram not connected" }, { status: 400 });
    }

    // Fetch message history from database (last 15 messages)
    const dbMessages = await repo.listRecentMessages(user.id, conversation_id, 15);

    const messages = dbMessages
      .map((m) => ({
        text: m.content,
        sender: m.sender_name || (m.sender_type === "lead" ? "lead" : "ai"),
        timestamp: m.created_at,
      }))
      .reverse(); // Reverse to get oldest first

    return NextResponse.json({ messages });
  } catch (err) {
    console.error("[message-history]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
