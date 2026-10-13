// src/app/api/apify-keys/route.ts

import { NextRequest, NextResponse } from "next/server";
import * as apifyService from "@/lib/services/apify-integration";
import { requireUserForAction } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUserForAction();

    const keys = await apifyService.getApifyKeys(user.id);

    // Return safe metadata only
    const safeKeys = keys.map((k) => ({
      id: k.id,
      key_name: k.key_name,
      is_active: k.is_active,
      usage_count: k.usage_count,
      monthly_limit: k.monthly_limit,
    }));

    return NextResponse.json(safeKeys);
  } catch (error) {
    console.error("Error fetching Apify keys:", error);
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

    const key = await apifyService.addApifyKey(user.id, apiKey, name || "Default");

    return NextResponse.json(
      {
        id: key.id,
        key_name: key.key_name,
        is_active: key.is_active,
        usage_count: key.usage_count,
        monthly_limit: key.monthly_limit,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error adding Apify key:", error);
    if ((error as any).code === "23505") {
      return new NextResponse("This API key is already added", { status: 400 });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUserForAction();

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get("id");

    if (!keyId) {
      return new NextResponse("Missing key ID", { status: 400 });
    }

    await apifyService.deleteApifyKey(user.id, keyId);

    return new NextResponse("", { status: 204 });
  } catch (error) {
    console.error("Error deleting Apify key:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
