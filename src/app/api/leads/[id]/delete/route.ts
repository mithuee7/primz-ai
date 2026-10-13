// src/app/api/leads/[id]/delete/route.ts

import { NextRequest, NextResponse } from "next/server";
import { requireUserForAction } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/clients";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUserForAction();
    const { id: conversationId } = await params;

    if (!conversationId) {
      return new NextResponse("Missing conversation ID", { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify ownership
    const { data: conversation, error: fetchError } = await supabase
      .from("conversations")
      .select("id, owner_id")
      .eq("id", conversationId)
      .single();

    if (fetchError || !conversation) {
      return new NextResponse("Conversation not found", { status: 404 });
    }

    if (conversation.owner_id !== user.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    console.log(`[lead-delete] Deleting conversation ${conversationId}`);

    // Delete all messages first (due to foreign key constraints)
    const { error: messagesError } = await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", conversationId);

    if (messagesError) {
      console.error("Error deleting messages:", messagesError);
      return new NextResponse("Failed to delete messages", { status: 500 });
    }

    // Delete the conversation
    const { error: convError } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationId)
      .eq("owner_id", user.id);

    if (convError) {
      console.error("Error deleting conversation:", convError);
      return new NextResponse("Failed to delete conversation", { status: 500 });
    }

    console.log(`[lead-delete] Successfully deleted conversation ${conversationId}`);

    return NextResponse.json({
      success: true,
      message: "Lead and all associated data deleted",
    });
  } catch (error) {
    console.error("Error in lead deletion:", error);
    return new NextResponse(
      `Internal Server Error: ${error instanceof Error ? error.message : "Unknown"}`,
      { status: 500 }
    );
  }
}
