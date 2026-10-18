/**
 * Public plan catalogue. Shown on the landing page and mirrored in the `plans` table
 * (supabase/migrations/0008_plans.sql). Change prices here and in the SQL together.
 * Prices are suggestions for India (INR per month) and are not yet confirmed.
 */
/** The free plan runs for this many days, once per account. Every plan covers one Instagram account. */
export const FREE_TRIAL_DAYS = 7;

export interface PlanInfo {
  code: "free" | "basic" | "growth" | "business";
  name: string;
  price: number;
  chatsPerAccount: number;
  keys: string;
  highlights: string[];
  featured?: boolean;
}

export const PLANS: PlanInfo[] = [
  {
    code: "free",
    name: "Free",
    price: 0,
    chatsPerAccount: 3,
    keys: "We provide the AI and Apify keys",
    highlights: ["1 Instagram account", "3 chats", "7-day free trial"],
  },
  {
    code: "basic",
    name: "Basic",
    price: 299,
    chatsPerAccount: 25,
    keys: "We provide the AI and Apify keys",
    highlights: ["1 Instagram account", "25 leads the AI can reply to", "All core features"],
  },
  {
    code: "growth",
    name: "Growth",
    price: 1499,
    chatsPerAccount: 100,
    keys: "Bring your own AI and Apify keys",
    highlights: ["100 chats", "All features"],
    featured: true,
  },
  {
    code: "business",
    name: "Business",
    price: 2999,
    chatsPerAccount: 100,
    keys: "Bring your own AI and Apify keys",
    highlights: ["100 chats", "All features"],
  },
];
