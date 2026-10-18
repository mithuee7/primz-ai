/**
 * Signup email policy. Only large mainstream providers are accepted. Disposable and
 * unknown domains are refused. Each email is reduced to a canonical identity so that
 * alias tricks (Gmail dots, "+tag" suffixes, Yahoo "-tag") can't create a second account.
 * The same rules are mirrored in SQL (canonical_email in migration 0010).
 */

interface ProviderRule {
  label: string;
  /** Domains that belong to this provider. The first is the canonical one. */
  domains: string[];
  /** How aliases are written, so they can be stripped. */
  alias: "gmail" | "plus" | "dash" | "none";
}

const PROVIDERS: ProviderRule[] = [
  { label: "Gmail", domains: ["gmail.com", "googlemail.com"], alias: "gmail" },
  { label: "Outlook", domains: ["outlook.com"], alias: "plus" },
  { label: "Hotmail", domains: ["hotmail.com"], alias: "plus" },
  { label: "Live", domains: ["live.com"], alias: "plus" },
  { label: "Microsoft", domains: ["msn.com"], alias: "plus" },
  { label: "Yahoo", domains: ["yahoo.com", "yahoo.co.in"], alias: "dash" },
  { label: "Proton Mail", domains: ["protonmail.com", "proton.me", "pm.me"], alias: "plus" },
];

const ALLOWED_DOMAINS = new Set(PROVIDERS.flatMap((p) => p.domains));

export function allowedProviderNames(): string {
  return "Gmail, Outlook, Hotmail, Live, Yahoo or Proton Mail";
}

export type EmailCheck =
  | { ok: true; email: string; canonical: string; provider: string }
  | { ok: false; error: string };

/** Accepts only allowed providers and returns the canonical identity. */
export function checkSignupEmail(raw: string): EmailCheck {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at < 1) return { ok: false, error: "Enter a valid email." };
  let local = email.slice(0, at);
  const domain = email.slice(at + 1);

  const rule = PROVIDERS.find((p) => p.domains.includes(domain));
  if (!rule) {
    return { ok: false, error: `Sign up with ${allowedProviderNames()}. Other email providers are not accepted.` };
  }

  let canonicalDomain = rule.domains[0]!;
  if (rule.alias === "gmail") {
    local = local.split("+")[0]!.replace(/\./g, "");
  } else if (rule.alias === "plus") {
    local = local.split("+")[0]!;
  } else if (rule.alias === "dash") {
    local = local.split("-")[0]!;
  }
  if (rule.label === "Proton Mail") canonicalDomain = "protonmail.com";
  if (!local) return { ok: false, error: "Enter a valid email." };

  return { ok: true, email, canonical: `${local}@${canonicalDomain}`, provider: rule.label };
}

export { ALLOWED_DOMAINS };
