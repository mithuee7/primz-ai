import "server-only";
import { ApifyClient } from "./apify/client";
import { resolveLLM } from "./llm/resolve";
import type { LeadType } from "../types";
import { LEAD_TYPES } from "../types";
import type { AppSettings } from "../types";

/**
 * Auto-detect lead type using:
 * 1. Apify to fetch Instagram bio + recent captions
 * 2. AI to analyze and classify the lead
 */
export async function detectLeadType(
  settings: AppSettings,
  instagramUsername: string,
  apifyKey: string | null,
): Promise<LeadType> {
  try {
    // If no Apify key, default to "other"
    if (!apifyKey) return "other";

    const apify = new ApifyClient(apifyKey);
    const profile = await apify.getInstagramProfileInfo(instagramUsername);

    // Use AI to analyze the profile and determine lead type
    const llm = resolveLLM(settings);
    const analysisPrompt = `Analyze this Instagram profile and determine what type of lead this is.

Username: ${profile.username}
Bio: ${profile.bio}
Recent post captions:
${profile.recentCaptions.map((c) => `- ${c}`).join("\n")}

Based on this profile, the lead type is one of: ${LEAD_TYPES.join(", ")}

Respond with ONLY the lead type keyword, nothing else. Be concise and accurate.`;

    const result = await llm.complete({
      purpose: "conversation",
      model: settings.groq_model,
      system: "You are an expert at classifying Instagram profiles. Return only the lead type.",
      user: analysisPrompt,
      temperature: 0.3,
      maxTokens: 50,
      timeoutMs: 10000,
    });

    const detected = result.toLowerCase().trim();
    const matchedType = LEAD_TYPES.find((t) => detected.includes(t));
    return matchedType || "other";
  } catch (err) {
    console.error("[lead-detection]", err);
    return "other";
  }
}
