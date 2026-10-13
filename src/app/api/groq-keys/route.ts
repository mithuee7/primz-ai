// src/app/api/groq-keys/route.ts

import { NextRequest, NextResponse } from "next/server";
import * as groqService from "@/lib/services/groq-keys";
import { requireUserForAction } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUserForAction();

    const keys = await groqService.getGroqKeys(user.id);

    // Don't return encrypted keys, just metadata
    const safeKeys = keys.map((k) => ({
      id: k.id,
      key_name: k.key_name,
      is_active: k.is_active,
      last_error: k.last_error,
      reset_at: k.reset_at,
      created_at: k.created_at,
    }));

    return NextResponse.json(safeKeys);
  } catch (error) {
    console.error("Error fetching Groq keys:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUserForAction();

    const { apiKey, name } = await request.json();

    if (!apiKey || typeof apiKey !== "string") {
      return new NextResponse("Invalid API key", { status: 400 });
    }

    // Validate Groq API key format (basic)
    if (!apiKey.startsWith("gsk_") && !apiKey.startsWith("sk_")) {
      return new NextResponse("Invalid Groq API key format", { status: 400 });
    }

    const key = await groqService.addGroqKey(user.id, apiKey, name || "Default");

    return NextResponse.json(
      {
        id: key.id,
        key_name: key.key_name,
        is_active: key.is_active,
        created_at: key.created_at,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error adding Groq key:", error);
    if ((error as any).code === "23505") {
      return new NextResponse("This API key is already added", { status: 400 });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

/**
 * DELETE /api/groq-keys/:id - Delete a specific key
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUserForAction();

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get("id");

    if (!keyId) {
      return new NextResponse("Missing key ID", { status: 400 });
    }

    await groqService.deleteGroqKey(user.id, keyId);

    return new NextResponse("", { status: 204 });
  } catch (error) {
    console.error("Error deleting Groq key:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

/**
 * PATCH /api/groq-keys/:id - Update a key
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUserForAction();

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get("id");
    const { key_name, is_active } = await request.json();

    if (!keyId) {
      return new NextResponse("Missing key ID", { status: 400 });
    }

    const updated = await groqService.updateGroqKey(user.id, keyId, {
      key_name,
      is_active,
    });

    return NextResponse.json({
      id: updated.id,
      key_name: updated.key_name,
      is_active: updated.is_active,
    });
  } catch (error) {
    console.error("Error updating Groq key:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
