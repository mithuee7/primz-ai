# Complete Integration Guide - Primz AI Features

## 📋 Files to Add/Modify

### 1. Database Migration
**File:** `supabase/migrations/0005_add_api_keys_and_features.sql`
- Run this migration in Supabase SQL editor
- Creates `groq_api_keys` and `apify_api_keys` tables
- Adds new columns to `conversations` and `messages`

### 2. Service Files (Add to `src/lib/services/`)
- `groq-keys.ts` - Groq API key management
- `apify-integration.ts` - Apify lead type detection
- `message-history.ts` - Fetch full message history from Meta

### 3. Components (Add to `src/components/`)

Create `src/components/api-keys/`:
- `groq-keys-manager.tsx`
- `apify-keys-manager.tsx`

Create `src/components/chat/`:
- `rate-limit-timer.tsx`

Create `src/components/leads/`:
- `lead-display-components.tsx` (contains AiModeToggle, LeadTypeBadge, LeadTypeDetector, LeadProfile)
- `lead-deletion-modal.tsx`

### 4. API Routes (Add to `src/app/api/`)

#### Groq Keys API
**File:** `groq-keys/route.ts`
```
GET  /api/groq-keys - List all keys
POST /api/groq-keys - Add new key
PATCH /api/groq-keys?id=KEY_ID - Update key
DELETE /api/groq-keys?id=KEY_ID - Delete key
```

#### Apify Keys API
**File:** `apify-keys/route.ts`
```
GET  /api/apify-keys - List all keys
POST /api/apify-keys - Add new key
DELETE /api/apify-keys?id=KEY_ID - Delete key
```

#### Lead Type Detection
**File:** `lead-type/detect/route.ts`
```
POST /api/lead-type/detect - Detect lead type using Apify
Body: { igUsername, conversationId }
```

#### Message History
**File:** `message-history/fetch/route.ts`
```
POST /api/message-history/fetch - Fetch full history from Meta
Body: { conversationId, accessToken }
```

#### Lead Deletion
**File:** `leads/[id]/delete/route.ts`
```
POST /api/leads/[id]/delete - Delete a lead completely
```

---

## 🔧 Integration Steps

### Step 1: Update Supabase Schema
1. Copy `0005_add_api_keys_and_features.sql`
2. Go to Supabase → SQL Editor
3. Paste and execute
4. Verify tables are created

### Step 2: Add Service Files
1. Copy all 3 service files to `src/lib/services/`
2. Update `src/lib/repo/supabase.ts` to add methods for new tables:

```typescript
// Add these methods to the Repository class

// Groq Keys
async getGroqKeys(userId: string) {
  return this.supabase
    .from("groq_api_keys")
    .select("*")
    .eq("owner_id", userId);
}

async addGroqKey(userId: string, apiKey: string, name: string) {
  const encrypted = encryptForStorage(apiKey);
  return this.supabase
    .from("groq_api_keys")
    .insert({ owner_id: userId, api_key_encrypted: encrypted, key_name: name })
    .single();
}

// Apify Keys
async getApifyKeys(userId: string) {
  return this.supabase
    .from("apify_api_keys")
    .select("*")
    .eq("owner_id", userId);
}

async addApifyKey(userId: string, apiKey: string, name: string) {
  const encrypted = encryptForStorage(apiKey);
  return this.supabase
    .from("apify_api_keys")
    .insert({ owner_id: userId, api_key_encrypted: encrypted, key_name: name })
    .single();
}

// Conversations
async updateConversation(id: string, updates: any) {
  return this.supabase
    .from("conversations")
    .update(updates)
    .eq("id", id)
    .single();
}
```

### Step 3: Add Components
1. Create folder structure in `src/components/`
2. Copy all component files
3. Update component imports if needed

### Step 4: Add API Routes
1. Create folder structure in `src/app/api/`
2. Copy all API route files
3. Update imports (especially `getAuth()`)

### Step 5: Update Settings Page
In `src/app/(app)/settings/page.tsx`, add these sections:

```tsx
import { GroqKeysManager } from "@/components/api-keys/groq-keys-manager";
import { ApifyKeysManager } from "@/components/api-keys/apify-keys-manager";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      {/* Existing settings... */}

      <section className="border-t pt-6">
        <h2 className="text-xl font-bold mb-4">API Keys Management</h2>
        <div className="space-y-6">
          <GroqKeysManager />
          <ApifyKeysManager />
        </div>
      </section>
    </div>
  );
}
```

### Step 6: Update Chat Component
In your chat view component, add:

```tsx
import { AiModeToggle } from "@/components/leads/lead-display-components";
import { LeadTypeBadge } from "@/components/leads/lead-display-components";
import { RateLimitTimer } from "@/components/chat/rate-limit-timer";
import { LeadDeleteButton } from "@/components/leads/lead-deletion-modal";

// In your chat header:
<div className="flex gap-2 items-center">
  <LeadTypeBadge leadType={conversation.lead_type} />
  <AiModeToggle
    conversationId={conversation.id}
    isAiMode={conversation.is_ai_mode}
    onToggle={async (newMode) => {
      // Update in DB and state
    }}
  />
  <LeadDeleteButton
    leadName={conversation.lead_name}
    conversationId={conversation.id}
    onDelete={async () => {
      // Call API to delete
    }}
  />
</div>

// Show rate limit timer
<RateLimitTimer resetAt={rateLimitKey?.reset_at} keyName={rateLimitKey?.key_name} />
```

### Step 7: Update Conversation Engine
In `src/lib/services/ai/conversation-engine.ts`:

```typescript
import { getRandomGroqKey, checkAndResetRateLimit } from "@/lib/services/groq-keys";
import { getConversationMessages } from "@/lib/services/message-history";

// When calling Groq API:
let apiKey = await getRandomGroqKey(userId);
if (!apiKey) {
  throw new Error("No active Groq API keys configured");
}

try {
  // Your existing Groq API call
  const response = await groq.chat.completions.create({
    model: "mixtral-8x7b-32768",
    messages: formattedMessages,
    // ...
  });
} catch (error) {
  if (error.status === 429) {
    // Rate limited - mark key as limited
    const resetTime = new Date(Date.now() + 60000); // 1 minute retry
    await markKeyRateLimited(keyId, resetTime, error.message);
    
    // Try with another key
    apiKey = await getRandomGroqKey(userId);
    if (!apiKey) {
      throw new Error("All Groq API keys are rate limited");
    }
    // Retry with new key...
  }
  throw error;
}
```

### Step 8: Update Webhook for Full Message History
In your Instagram webhook handler:

```typescript
import { fetchFullMessageHistory } from "@/lib/services/message-history";

// When receiving a new message:
const messages = await fetchFullMessageHistory(
  conversationId,
  accessToken,
  100 // Fetch last 100 messages
);

// Include in AI context
const allMessages = formatMessagesForAI(messages);
const context = `Conversation history:\n${allMessages}\n\nNew message: ...`;
```

---

## 🚀 Usage Examples

### Using Groq Keys Manager in Component
```tsx
import { GroqKeysManager } from "@/components/api-keys/groq-keys-manager";

export function MySettings() {
  return (
    <div className="p-6">
      <GroqKeysManager />
    </div>
  );
}
```

### Detecting Lead Type
```tsx
import { LeadTypeDetector } from "@/components/leads/lead-display-components";

export function LeadHeader() {
  return (
    <LeadTypeDetector
      conversationId="123"
      igUsername="john_doe"
      onDetect={async (type, bio, captions) => {
        // Save to DB
        await updateLead(conversationId, {
          lead_type: type,
          lead_bio: bio,
          lead_post_captions: captions,
        });
      }}
    />
  );
}
```

### Fetching Message History
```tsx
import { getConversationMessages } from "@/lib/services/message-history";

// In an action or component
const messages = await getConversationMessages(
  conversationId,
  userId,
  accessToken
);

const contextText = formatMessagesForAI(messages);
```

---

## 🔑 Environment Variables (Optional)

If using free Apify accounts, consider adding:
```env
# No environment variables needed - keys stored in DB
# But you can add optional defaults:
APIFY_MAX_CALLS_PER_ACCOUNT=10
GROQ_DEFAULT_KEY_ROTATION_STRATEGY=round_robin # or random
```

---

## 📊 Database Changes Summary

### New Tables
- `groq_api_keys` - Store multiple Groq API keys
- `apify_api_keys` - Store multiple Apify API keys

### New Columns
- `conversations.lead_type` - Lead category (influencer, brand, etc)
- `conversations.is_ai_mode` - Toggle between auto/manual mode
- `conversations.lead_bio` - Lead's Instagram bio
- `conversations.lead_post_captions` - Last 3-4 post captions
- `conversations.full_history_loaded` - Has full message history been fetched
- `messages.is_ai_response` - Mark AI-generated messages
- `messages.groq_key_used` - Which API key was used

---

## 🧪 Testing Checklist

- [ ] Add Groq API key in Settings
- [ ] Verify key appears in list
- [ ] Delete a key
- [ ] Add Apify API key
- [ ] Trigger rate limit (send many messages fast)
- [ ] Verify timer shows and counts down
- [ ] Verify app switches to next API key
- [ ] Detect lead type manually
- [ ] Verify lead type badge shows
- [ ] Toggle AI/Manual mode
- [ ] Delete a lead completely
- [ ] Verify conversation disappears

---

## 🔗 GitHub Auto-Deployment

To auto-deploy to your GitHub repo:

1. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Primz-AI

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm run deploy # or your deployment command
```

2. Or use GitHub's web UI to auto-deploy on push

---

## 📝 Notes

- All API keys are encrypted using your existing encryption logic
- Groq rate limits detected by 429 status code
- Apify has 10 free calls/month per account
- Lead type detection is optional - shows "Unknown" if not detected
- Messages can be loaded manually or automatically on new lead creation
- AI mode toggle is per conversation, not global

---

## Support

If you have issues:
1. Check Supabase SQL editor for table creation
2. Verify API key encryption is working
3. Check Render logs for API errors
4. Ensure component imports match your project structure
5. Test API routes with Postman/curl first

---

Done! You now have a fully feature-rich Primz AI with:
✅ Multiple API key management (Groq & Apify)
✅ Rate limit detection and auto-switching
✅ Full message history fetching
✅ Lead type detection via Apify
✅ AI/Manual mode toggle
✅ Lead deletion with confirmation
✅ Beautiful UI components
✅ TypeScript throughout
