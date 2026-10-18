/**
 * Public plan catalogue. Shown on the landing page and mirrored in the `plans` table
 * (supabase/migrations/0008_plans.sql). Change prices here and in the SQL together.
 * price: null means "not set yet" and the page shows "Price on request".
 */
export interface PlanInfo {
  code: "basic" | "starter" | "growth" | "business";
  name: string;
  price: string | null;
  accounts: number;
  chatsPerAccount: number;
  keys: string;
  highlights: string[];
}

export const PLANS: PlanInfo[] = [
  {
    code: "basic",
    name: "Basic",
    price: null,
    accounts: 1,
    chatsPerAccount: 25,
    keys: "We provide the AI and Apify keys",
    highlights: ["25 leads the AI can talk to", "Lead type detection included", "All core features"],
  },
  {
    code: "starter",
    name: "Starter",
    price: null,
    accounts: 1,
    chatsPerAccount: 50,
    keys: "Bring your own AI and Apify keys",
    highlights: ["1 Instagram account", "50 chats", "All features"],
  },
  {
    code: "growth",
    name: "Growth",
    price: null,
    accounts: 3,
    chatsPerAccount: 100,
    keys: "Bring your own AI and Apify keys",
    highlights: ["3 Instagram accounts", "100 chats per account", "All features"],
  },
  {
    code: "business",
    name: "Business",
    price: null,
    accounts: 10,
    chatsPerAccount: 100,
    keys: "Bring your own AI and Apify keys",
    highlights: ["10 Instagram accounts", "100 chats per account", "All features"],
  },
];

export const SETUP_SERVICES = [
  { name: "Done-for-you setup", price: "₹300", detail: "We connect your Instagram and set up your services and replies." },
  { name: "Done-for-you setup, full build", price: "₹500", detail: "Everything above, plus a custom service tailored to your business." },
];
