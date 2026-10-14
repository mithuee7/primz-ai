// In settings/page.tsx, we need to:
// 1. Decrypt the apify_key_encrypted to count actual keys
// 2. But we can't do that in the server component without importing crypto

// Better approach: store key count separately OR count from the encrypted data length
// For now, we can estimate based on the groq pattern

// Let me check if we decrypt anywhere
