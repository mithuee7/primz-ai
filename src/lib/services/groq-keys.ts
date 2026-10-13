// src/lib/services/groq-keys.ts

import { createAdminClient } from "@/lib/supabase/clients";
import { decryptFromStorage, encryptForStorage } from "@/lib/secrets";

export interface GroqKeyConfig {
  id: string;
  owner_id: string;
  key_name: string;
  is_active: boolean;
  last_error: string | null;
  error_at: string | null;
  reset_at: string | null;
  created_at: string;
}

/**
 * Get all Groq API keys for the user
 */
export async function getGroqKeys(userId: string): Promise<GroqKeyConfig[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("groq_api_keys")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Decrypt the API keys
  return (data || []).map((row: any) => ({
    ...row,
    // API key is encrypted, don't expose it
  }));
}

/**
 * Add a new Groq API key
 */
export async function addGroqKey(
  userId: string,
  apiKey: string,
  keyName: string = "Default"
): Promise<GroqKeyConfig> {
  const supabase = createAdminClient();

  // Encrypt the API key before storing
  const encryptedKey = encryptForStorage(apiKey);

  const { data, error } = await supabase
    .from("groq_api_keys")
    .insert({
      owner_id: userId,
      api_key_encrypted: encryptedKey,
      key_name: keyName,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a Groq API key
 */
export async function deleteGroqKey(userId: string, keyId: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("groq_api_keys")
    .delete()
    .eq("id", keyId)
    .eq("owner_id", userId);

  if (error) throw error;
}

/**
 * Update key name or active status
 */
export async function updateGroqKey(
  userId: string,
  keyId: string,
  updates: { key_name?: string; is_active?: boolean }
): Promise<GroqKeyConfig> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("groq_api_keys")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", keyId)
    .eq("owner_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get a random active API key (for round-robin usage)
 */
export async function getRandomGroqKey(userId: string): Promise<string | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("groq_api_keys")
    .select("id, api_key_encrypted")
    .eq("owner_id", userId)
    .eq("is_active", true)
    .order("random()") // Random order
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
 * Mark a key as rate limited with reset time
 */
export async function markKeyRateLimited(
  keyId: string,
  resetAt: Date,
  error: string
): Promise<void> {
  const supabase = createAdminClient();

  const { error: dbError } = await supabase
    .from("groq_api_keys")
    .update({
      last_error: error,
      error_at: new Date().toISOString(),
      reset_at: resetAt.toISOString(),
      is_active: false,
    })
    .eq("id", keyId);

  if (dbError) throw dbError;
}

/**
 * Check if a key's rate limit has expired
 */
export async function checkAndResetRateLimit(keyId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("groq_api_keys")
    .select("reset_at, id")
    .eq("id", keyId)
    .single();

  if (error || !data) return false;

  const now = new Date();
  const resetAt = new Date(data.reset_at);

  if (now >= resetAt) {
    // Reset the rate limit
    await supabase
      .from("groq_api_keys")
      .update({
        is_active: true,
        reset_at: null,
        last_error: null,
        error_at: null,
      })
      .eq("id", keyId);

    return true;
  }

  return false;
}

/**
 * Get time until rate limit reset for a key
 */
export function getTimeUntilReset(resetAt: string | null): number {
  if (!resetAt) return 0;

  const now = new Date().getTime();
  const reset = new Date(resetAt).getTime();
  const diff = Math.max(0, reset - now);

  return Math.ceil(diff / 1000); // Return seconds
}
