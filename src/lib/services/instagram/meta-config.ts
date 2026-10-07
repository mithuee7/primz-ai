import "server-only";
import { getRepository } from "@/lib/repo";
import { tryDecrypt } from "@/lib/secrets";

/** Decrypted Instagram connection for one owner. Never serialize this to the client. */
export interface MetaConfig {
  ownerId: string;
  igAccountId: string;
  igScopedId: string | null;
  username: string | null;
  accessToken: string;
  appSecret: string;
  verifyToken: string;
  expiresAt: string | null;
}

export async function loadMetaConfig(ownerId: string): Promise<MetaConfig | null> {
  const s = await getRepository().getAppSettings(ownerId);
  const accessToken = tryDecrypt(s.meta_token_encrypted);
  const appSecret = tryDecrypt(s.meta_app_secret_encrypted);
  
  // DEBUG LOGGING
  console.log("[loadMetaConfig] checking stored values:");
  console.log("[loadMetaConfig]   meta_ig_account_id:", s.meta_ig_account_id);
  console.log("[loadMetaConfig]   meta_token_encrypted exists:", Boolean(s.meta_token_encrypted));
  console.log("[loadMetaConfig]   meta_app_secret_encrypted exists:", Boolean(s.meta_app_secret_encrypted));
  console.log("[loadMetaConfig]   meta_verify_token:", s.meta_verify_token);
  console.log("[loadMetaConfig] decrypted values:");
  console.log("[loadMetaConfig]   accessToken decrypted:", Boolean(accessToken), "length:", accessToken?.length);
  console.log("[loadMetaConfig]   appSecret decrypted:", Boolean(appSecret), "length:", appSecret?.length);
  if (appSecret) {
    console.log("[loadMetaConfig]   appSecret first 10 chars:", appSecret.substring(0, 10));
    console.log("[loadMetaConfig]   appSecret has leading/trailing space:", appSecret !== appSecret.trim());
  }
  
  if (!s.meta_ig_account_id || !accessToken || !appSecret || !s.meta_verify_token) {
    console.log("[loadMetaConfig] REJECTING config - missing field(s)");
    return null;
  }
  return {
    ownerId,
    igAccountId: s.meta_ig_account_id,
    igScopedId: s.meta_ig_scoped_id,
    username: s.meta_ig_username,
    accessToken,
    appSecret,
    verifyToken: s.meta_verify_token,
    expiresAt: s.meta_token_expires_at,
  };
}
