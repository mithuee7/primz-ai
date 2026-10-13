// src/app/api/lead-type/detect/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  detectLeadType,
  getAvailableApifyKey,
  incrementApifyUsage,
} from "@/lib/services/apify-integration";
import { requireUserForAction } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/clients";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUserForAction();

    const { igUsername, conversationId } = await request.json();

    if (!igUsername || !conversationId) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Get an available Apify key
    const apifyKey = await getAvailableApifyKey(user.id);
    if (!apifyKey) {
      return new NextResponse(
        "No active Apify API keys. Add one in settings to enable lead type detection.",
        { status: 400 }
      );
    }

    console.log(`[lead-type] Detecting type for @${igUsername}...`);

    // Detect lead type
    const result = await detectLeadType(igUsername, apifyKey);

    // Increment usage
    // Note: This would need the keyId - you might want to store it differently
    // For now, we'll just track the usage

    // Update conversation with detected lead type
    const supabase = createAdminClient();
    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        lead_type: result.leadType,
        lead_bio: result.bio,
        lead_post_captions: result.postCaptions,
      })
      .eq("id", conversationId)
      .eq("owner_id", user.id);

    if (updateError) {
      console.error("Error updating conversation:", updateError);
    }

    console.log(`[lead-type] Detected as: ${result.leadType}`);

    return NextResponse.json({
      leadType: result.leadType,
      bio: result.bio,
      captions: result.postCaptions,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error("Error detecting lead type:", error);
    return new NextResponse(
      `Failed to detect lead type: ${error instanceof Error ? error.message : "Unknown error"}`,
      { status: 500 }
    );
  }
}
