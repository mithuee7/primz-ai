import "server-only";
import { LLMError } from "../llm/types";

interface ActorRunResponse {
  data: {
    resultUrl?: string;
    status?: string;
    error?: string;
  };
}

interface InstagramActorResult {
  username?: string;
  biography?: string;
  posts?: Array<{
    caption?: string;
  }>;
}

export class ApifyClient {
  constructor(private apiKey: string) {}

  /**
   * Fetch Instagram profile info using Apify's Instagram Profile Scraper actor.
   * Returns: bio, username, and recent 3-4 post captions
   */
  async getInstagramProfileInfo(username: string): Promise<{
    username: string;
    bio: string;
    recentCaptions: string[];
  }> {
    try {
      // Use the free Instagram Profile Scraper actor
      const actorId = "apify/instagram-profile-scraper";
      const input = {
        directUrls: [`https://www.instagram.com/${username}/`],
        resultsLimit: 1,
      };

      // Start the actor run
      const runResponse = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(input),
      });

      if (!runResponse.ok) {
        throw new Error(`Apify API error: ${runResponse.status}`);
      }

      const run = (await runResponse.json()) as ActorRunResponse;
      if (run.data?.error) {
        throw new Error(`Apify error: ${run.data.error}`);
      }

      if (!run.data?.resultUrl) {
        throw new Error("No result URL from Apify");
      }

      // Fetch the results
      const resultResponse = await fetch(run.data.resultUrl, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      if (!resultResponse.ok) {
        throw new Error(`Failed to fetch Apify results: ${resultResponse.status}`);
      }

      const results = await resultResponse.json() as Array<InstagramActorResult>;
      const profile = results[0];

      if (!profile) {
        throw new Error("No profile data returned");
      }

      return {
        username: profile.username || username,
        bio: profile.biography || "",
        recentCaptions: (profile.posts || [])
          .slice(0, 4)
          .map((p) => p.caption || "")
          .filter((c) => c),
      };
    } catch (err) {
      throw new Error(`Failed to fetch Instagram profile: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }
}

export async function getApifyClient(apiKey: string | null): Promise<ApifyClient | null> {
  if (!apiKey) return null;
  return new ApifyClient(apiKey);
}
