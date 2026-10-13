// src/lib/services/apify-integration.ts

import { createAdminClient } from "@/lib/supabase/clients";
import { decryptFromStorage } from "@/lib/secrets";

export type LeadType = "influencer" | "brand" | "reseller" | "agency" | "unknown";

export interface ApifyKeyConfig {
  id: string;
  key_name: string;
  is_active: boolean;
  usage_count: number;
  monthly_limit: number;
}

/**
 * Get all Apify API keys for the user
 */
export async function getApifyKeys(userId: string): Promise<ApifyKeyConfig[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("apify_api_keys")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Add a new Apify API key
 */
export async function addApifyKey(
  userId: string,
  apiKey: string,
  keyName: string = "Default"
): Promise<ApifyKeyConfig> {
  const supabase = createAdminClient();
  const { encryptForStorage } = await import("@/lib/secrets");

  const encryptedKey = encryptForStorage(apiKey);

  const { data, error } = await supabase
    .from("apify_api_keys")
    .insert({
      owner_id: userId,
      api_key_encrypted: encryptedKey,
      key_name: keyName,
      is_active: true,
      usage_count: 0,
      monthly_limit: 10,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete an Apify API key
 */
export async function deleteApifyKey(userId: string, keyId: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("apify_api_keys")
    .delete()
    .eq("id", keyId)
    .eq("owner_id", userId);

  if (error) throw error;
}

/**
 * Get a random available Apify key (with lowest usage)
 */
export async function getAvailableApifyKey(userId: string): Promise<string | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("apify_api_keys")
    .select("id, api_key_encrypted, usage_count, monthly_limit")
    .eq("owner_id", userId)
    .eq("is_active", true)
    .lt("usage_count", 10) // Only keys with remaining quota
    .order("usage_count", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;

  try {
    return decryptFromStorage(data.api_key_encrypted);
  } catch {
    return null;
  }
}

/**
 * Increment usage counter for a key
 */
export async function incrementApifyUsage(keyId: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .rpc("increment_apify_usage", { key_id: keyId });

  if (error) {
    // Fallback if RPC doesn't exist
    const { data } = await supabase
      .from("apify_api_keys")
      .select("usage_count")
      .eq("id", keyId)
      .single();

    if (data) {
      await supabase
        .from("apify_api_keys")
        .update({ usage_count: (data.usage_count || 0) + 1 })
        .eq("id", keyId);
    }
  }
}

/**
 * Detect lead type using Apify Instagram profile scraper
 * Analyzes bio and post captions to categorize the lead
 */
export async function detectLeadType(
  igUsername: string,
  apifyKey: string
): Promise<{
  leadType: LeadType;
  bio: string;
  postCaptions: string[];
  confidence: number;
}> {
  try {
    // Use Apify Instagram Profile Scraper actor
    // This is a free actor that works with free Apify accounts
    const actorId = "apify/instagram-profile-scraper";

    // Start the actor
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apifyKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          usernames: [igUsername],
          resultsLimit: 1,
          maxPostsPerUser: 4,
          includePostCaptions: true,
        }),
      }
    );

    if (!runResponse.ok) {
      throw new Error(`Apify API error: ${runResponse.statusText}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;

    // Wait for the actor to finish (with timeout)
    let profile = null;
    const maxAttempts = 30; // 30 seconds timeout
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

      const statusResponse = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/runs/${runId}`,
        {
          headers: { Authorization: `Bearer ${apifyKey}` },
        }
      );

      const statusData = await statusResponse.json();

      if (statusData.data.status === "SUCCEEDED") {
        const datasetResponse = await fetch(
          `https://api.apify.com/v2/datasets/${statusData.data.defaultDatasetId}/items`,
          {
            headers: { Authorization: `Bearer ${apifyKey}` },
          }
        );

        const items = await datasetResponse.json();
        profile = items[0];
        break;
      } else if (statusData.data.status === "FAILED") {
        throw new Error("Apify actor run failed");
      }

      attempts++;
    }

    if (!profile) {
      throw new Error("Apify run timed out");
    }

    // Analyze the profile
    const bio = profile.biography || "";
    const postCaptions = profile.posts
      ?.map((p: any) => p.caption || "")
      .filter((c: string) => c.length > 0) || [];

    const allText = `${bio} ${postCaptions.join(" ")}`.toLowerCase();

    // Determine lead type based on keywords
    let leadType: LeadType = "unknown";
    let confidence = 0;

    const influencerKeywords = [
      "influencer",
      "collaborations",
      "dm for collab",
      "brand deals",
      "sponsored",
      "#ad",
    ];
    const brandKeywords = [
      "brand",
      "business",
      "shop",
      "products",
      "e-commerce",
      "store",
      "collection",
      "link in bio",
    ];
    const resellerKeywords = [
      "resell",
      "wholesale",
      "bulk order",
      "distributor",
      "supplier",
      "drop shipping",
    ];
    const agencyKeywords = [
      "agency",
      "marketing",
      "digital",
      "creative",
      "management",
      "consulting",
    ];

    // Count keyword matches
    let influencerScore = influencerKeywords.filter((k) =>
      allText.includes(k.toLowerCase())
    ).length;
    let brandScore = brandKeywords.filter((k) =>
      allText.includes(k.toLowerCase())
    ).length;
    let resellerScore = resellerKeywords.filter((k) =>
      allText.includes(k.toLowerCase())
    ).length;
    let agencyScore = agencyKeywords.filter((k) =>
      allText.includes(k.toLowerCase())
    ).length;

    // Determine the highest scoring type
    const scores = {
      influencer: influencerScore,
      brand: brandScore,
      reseller: resellerScore,
      agency: agencyScore,
    };

    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
    if (sorted.length > 0 && sorted[0]?.[1] && sorted[0][1] > 0) {
      leadType = sorted[0][0] as LeadType;
      confidence = sorted[0][1] / 5; // Normalize to 0-1
    }

    return {
      leadType,
      bio,
      postCaptions,
      confidence: Math.min(1, confidence),
    };
  } catch (error) {
    console.error("Error detecting lead type:", error);
    return {
      leadType: "unknown",
      bio: "",
      postCaptions: [],
      confidence: 0,
    };
  }
}

/**
 * Format lead type for display
 */
export function formatLeadType(type: LeadType): string {
  const labels: Record<LeadType, string> = {
    influencer: "Influencer",
    brand: "Brand",
    reseller: "Reseller",
    agency: "Agency",
    unknown: "Unknown",
  };
  return labels[type] || "Unknown";
}

/**
 * Get badge color for lead type
 */
export function getLeadTypeBadgeColor(
  type: LeadType
): "blue" | "purple" | "green" | "amber" | "gray" {
  const colors: Record<LeadType, "blue" | "purple" | "green" | "amber" | "gray"> = {
    influencer: "blue",
    brand: "purple",
    reseller: "green",
    agency: "amber",
    unknown: "gray",
  };
  return colors[type] || "gray";
}
