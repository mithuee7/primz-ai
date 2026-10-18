/**
 * Public plan catalogue. Shown on the landing page and mirrored in the `plans` table
 * (supabase/migrations/0008_plans.sql). Change prices here and in the SQL together.
 * Prices are suggestions for India (INR per month) and are not yet confirmed.
 */
export interface PlanInfo {
  code: "free" | "basic" | "growth" | "business";
  name: string;
  price: number;
  accounts: number;
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
    accounts: 1,
    chatsPerAccount: 3,
    keys: "We provide the AI and Apify keys",
    highlights: ["1 Instagram account", "3 chats to try it", "Fair-use rate limit"],
  },
  {
    code: "basic",
    name: "Basic",
    price: 299,
    accounts: 1,
    chatsPerAccount: 25,
    keys: "We provide the AI and Apify keys",
    highlights: ["1 Instagram account", "25 leads the AI can reply to", "All core features"],
  },
  {
    code: "growth",
    name: "Growth",
    price: 1499,
    accounts: 3,
    chatsPerAccount: 100,
    keys: "Bring your own AI and Apify keys",
    highlights: ["3 Instagram accounts", "100 chats per account", "All features"],
    featured: true,
  },
  {
    code: "business",
    name: "Business",
    price: 4999,
    accounts: 10,
    chatsPerAccount: 100,
    keys: "Bring your own AI and Apify keys",
    highlights: ["10 Instagram accounts", "100 chats per account", "All features"],
  },
];
