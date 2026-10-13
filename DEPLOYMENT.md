# Primz AI Production Deployment Checklist

## Features Implemented
✅ Multi-key Groq API support with automatic key rotation
✅ Automatic retry queue for rate-limited messages (5-10 min random delay)
✅ JSON response format enforcement (groq `json_object` response_format)
✅ Malformed JSON repair function for LLM output
✅ Webhook signature verification with Meta X-Hub-Signature-256
✅ Exactly-once message delivery semantics
✅ Real Instagram integration via Meta Business Account

## Pre-Deployment Configuration

### 1. Environment Variables
Add to Render deployment:
```
# Groq API Keys (comma-separated for multi-key support)
GROQ_API_KEYS=gsk_key1,gsk_key2,gsk_key3
# OR single key for backward compatibility:
GROQ_API_KEY=gsk_...

# Models
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_CHECKER_MODEL=llama-3.3-70b-versatile

# Encryption
APP_ENCRYPTION_KEY=<generate 32-byte base64>

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Cron Job (for retry queue)
CRON_SECRET=<generate secure random token>
```

### 2. Database Migrations
Run in Supabase SQL Editor:
```sql
-- Migration 0003: Create retry queue table
-- Migration 0004: Add RATE_LIMITED status to reply_claims
```

### 3. Cron Job Setup
Set up external cron service (e.g., EasyCron, AWS EventBridge):
```
Call: https://your-render-app.onrender.com/api/cron/retry-queue
Method: POST
Headers: Authorization: Bearer <CRON_SECRET>
Frequency: Every 5 minutes
```

### 4. Meta Business Account Setup
1. Create Instagram Business Account
2. Create Meta App in App Dashboard
3. Configure Webhooks:
   - Callback URL: https://your-render-app.onrender.com/api/webhooks/instagram
   - Verify Token: Auto-generated (shown in Settings page)
   - Subscribe to: `messages` field

4. Add Instagram account to app:
   - Go to Settings page
   - Paste access token and app secret
   - Connect & Verify

## Testing Checklist

### Unit Tests
```bash
npm run test
```

### Build Verification
```bash
npm run build
```

### Manual Testing
- [ ] Settings page loads without errors
- [ ] Can enter single Groq API key
- [ ] Can enter multiple comma-separated Groq keys
- [ ] Key count displays correctly in status badge
- [ ] Settings save successfully
- [ ] Demo mode works (simulated Instagram)
- [ ] Real Instagram connection works
- [ ] AI generates replies to lead messages
- [ ] Checker approves/rejects replies
- [ ] Rate-limited messages retry automatically (check logs)
- [ ] Retry queue cron job runs every 5 minutes

### Logging Checks
Monitor Render logs for:
```
[llm] Using 3 Groq API keys with rotation
[groq-multi] Rate limit on key 0, trying next key
[retry-queue] START found X due retries
[retry-queue] ✓ outcome=SENT
[retry-queue] DONE processed=X failed=Y elapsed=Zms
```

## Deployment Steps

1. **Build verification**
   ```bash
   npm run build
   ```

2. **Push to Git**
   ```bash
   git add -A
   git commit -m "Deploy: multi-key Groq support with automatic retry"
   git push origin main
   ```

3. **Deploy to Render**
   - Render auto-deploys on push to main
   - Monitor build logs
   - Verify environment variables are set

4. **Run database migrations** (one-time)
   - Open Supabase SQL Editor
   - Run migrations 0003 and 0004

5. **Set up cron job** (one-time)
   - Use EasyCron or similar service
   - Configure to call `/api/cron/retry-queue` every 5 minutes
   - Add Authorization header with CRON_SECRET

6. **Configure Meta Webhooks** (one-time)
   - Get Verify Token from Settings page
   - Add webhook configuration in Meta App Dashboard

## Post-Deployment Validation

1. Check Render logs for any startup errors
2. Visit Settings page - verify status shows correctly
3. Try entering test API keys
4. Send test message via Instagram webhook
5. Verify reply is generated and sent
6. Monitor logs for retry queue execution

## Key Architecture Notes

### Multi-Key Strategy
- Keys stored encrypted (AES-256-GCM)
- GroqMultiClient tracks failures per key
- Rate limit failures weighted 3x to skip failing keys
- Success gradually reduces failure count
- Attempts up to 3 keys before failing

### Retry Mechanism
- Rate-limited messages marked with RATE_LIMITED status
- Scheduled in retry_queue table with 5-10 min random delay
- Cron job processes due retries every 5 minutes
- Pipeline automatically retries from same conversation/message

### Rate Limit Handling
- Generation rate limits: caught, scheduled for retry
- Checker rate limits: caught, scheduled for retry
- Non-retryable errors: marked REVIEW/FAILED (human review)

## Troubleshooting

### Rate limits still happening
- [ ] Verify all keys are working (test each individually)
- [ ] Check key usage across accounts
- [ ] Increase GROQ_API_KEYS to more keys
- [ ] Check cron job is running (logs)

### Retry queue not processing
- [ ] Verify CRON_SECRET matches env var
- [ ] Check cron service is calling correct URL
- [ ] Verify /api/cron/retry-queue endpoint responds 200
- [ ] Check Render logs for [retry-queue] messages

### JSON validation errors
- [ ] Verify response_format: { type: "json_object" }
- [ ] Check JSON repair function is running
- [ ] Review model output in logs
- [ ] Try with different Groq model

## Files Modified

- `src/components/settings/settings-form.tsx` - Multi-key UI
- `src/lib/services/llm/groq-multi.ts` - Multi-key client
- `src/lib/services/llm/resolve.ts` - Key resolution logic
- `src/app/actions.ts` - Key saving with comma support
- `src/lib/schemas.ts` - Validation for comma-separated keys
- `src/lib/env.ts` - GROQ_API_KEYS environment variable
- `src/app/api/cron/retry-queue/route.ts` - Retry queue processor
- `supabase/migrations/0003_retry_queue.sql` - Retry table
- `supabase/migrations/0004_add_rate_limited_status.sql` - Status update
