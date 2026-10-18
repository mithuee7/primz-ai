import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "primz_admin";

function expectedToken(password: string): string {
  return createHash("sha256").update(`primz-admin-v1:${password}`).digest("hex");
}

export function passwordMatches(input: string): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(password);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const want = Buffer.from(expectedToken(password));
  const got = Buffer.from(token);
  return got.length === want.length && timingSafeEqual(got, want);
}

export function adminCookieValue(): string {
  return expectedToken(process.env.ADMIN_PASSWORD ?? "");
}
