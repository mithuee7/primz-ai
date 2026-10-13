-- Add RATE_LIMITED status for reply claims that are scheduled for retry
ALTER TABLE public.reply_claims
DROP CONSTRAINT reply_claims_status_check;

ALTER TABLE public.reply_claims
ADD CONSTRAINT reply_claims_status_check
CHECK (status in ('PROCESSING', 'SENT', 'REVIEW', 'FAILED', 'ABORTED', 'UNKNOWN', 'RATE_LIMITED'));
