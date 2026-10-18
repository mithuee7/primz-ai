import "server-only";
import { getEnv } from "@/lib/env";
import { getRepository } from "@/lib/repo";
import type { CheckerIssue, GenerationOutput } from "@/lib/schemas";
import { logActivity, type ActivityLevel } from "@/lib/services/activity-log";
import { basicGroqKeys, chatLimitReason, getPlanState, isPlatformKeyPlan, type PlanState } from "@/lib/plan-state";
import { checkAbuse } from "@/lib/services/abuse";
import { conversationModel, checkerModel } from "@/lib/services/llm/resolve";
import { getInstagramService, InstagramApiError, InstagramNotConfiguredError } from "@/lib/services/instagram";
import { LLMError } from "@/lib/services/llm/types";
import { resolveLLM } from "@/lib/services/llm/resolve";
import { cleanMessage } from "@/lib/text/cleanup";
import type { AiGeneration, ConversationFull, ConversationState, Message, ReplyClaimStatus, Service } from "@/lib/types";
import { generateReply, MalformedOutputError } from "./conversation-engine";
import { runOutputChecker } from "./output-checker";
import { CONVERSATION_PROMPT_VERSION } from "./prompts";
import { asksIfAutomated, detectInjectionAttempt, runLocalRules } from "./rules";

export type PipelineOutcome =
  | { status: "SENT"; generationId: string; messageId: string; delivery: "instagram" | "mock" }
  | { status: "SKIPPED"; reason: string }
  | { status: "NEEDS_REVIEW"; generationId: string | null; reason: string; issues: string[] }
  | { status: "ERROR_NOT_SENT"; reason: string };

export interface PipelineOptions {
  ownerId: string;
  conversationId: string;
  /** Demo-only knobs passed through to the scripted DemoLLM. */
  demo?: { forceBadDraft?: boolean };
  /** Internal: follow-up depth when a newer lead message arrived mid-flight. */
  attempt?: number;
  /**
   * A person pressed "Run AI now". Lets the run retake a message that was held for review or
   * failed. It can never retake one that was already sent or whose send outcome is unclear.
   */
  manual?: boolean;
}

const HISTORY_LIMIT = 20;
const LOCK_TTL_MS = 90_000;
const MAX_FOLLOW_UPS = 2;
/** Statuses where we KNOW nothing was sent, so a fresh automatic run may try again. */
const AUTO_RECLAIMABLE: ReplyClaimStatus[] = ["ABORTED", "RATE_LIMITED"];
const MANUAL_RECLAIMABLE: ReplyClaimStatus[] = ["ABORTED", "REVIEW", "FAILED", "RATE_LIMITED"];

/** What happened during one claimed run. Drives the final claim status. */
interface RunTrace {
  generationId: string | null;
  /** sendMessage() was called. */
  sendStarted: boolean;
  /** sendMessage() returned a message id: the reply is out. */
  sentOk: boolean;
  delivery: "instagram" | "mock";
  /** sendMessage() failed in a way that doesn't tell us whether it was delivered (timeout, 5xx). */
  sendAmbiguous: boolean;
  /** Stopped before sending (auto chat turned off, conversation changed). */
  aborted: boolean;
  /** A newer lead message arrived while we were working. */
  rerun: boolean;
}

/**
 * Incoming lead message -> checked reply -> Instagram, at most ONCE per inbound message id.
 *
 * Invariants:
 *  - A reply is sent only if every step succeeded and the checker approved it.
 *  - Before doing any AI work the run CLAIMS the inbound message id in the database (primary key),
 *    so webhook retries, double clicks, restarts and multiple servers can't produce a second reply.
 *  - A send whose outcome is unclear is never retried automatically; the chat is flagged instead.
 */
function classifyAiError(err: unknown, prefix: "ai" | "checker"): { code: string; level: ActivityLevel } {
  if (err instanceof MalformedOutputError) return { code: `${prefix}_malformed_output`, level: "error" };
  if (err instanceof LLMError) {
    if (err.kind === "rate_limit") return { code: `${prefix}_rate_limit`, level: "warn" };
    return { code: `${prefix}_llm_${err.kind}`, level: "error" };
  }
  return { code: `${prefix}_error`, level: "error" };
}

interface LogContext {
  lead_username: string;
  lead_name: string;
  incoming_message: string | null;
  incoming_at: string | null;
}

function contextFrom(conv: ConversationFull, lastLead: Message | null): LogContext {
  return {
    lead_username: conv.lead_username || conv.lead_name || "unknown",
    lead_name: conv.lead_name,
    incoming_message: lastLead ? lastLead.content : null,
    incoming_at: lastLead ? lastLead.created_at : null,
  };
}

/** Best-effort lookup of who the lead is and what they last said. Never throws. */
async function loadLogContext(ownerId: string, conversationId: string): Promise<LogContext | null> {
  try {
    const repo = getRepository();
    const conv = await repo.getConversation(ownerId, conversationId);
    if (!conv) return null;
    const recent = await repo.listRecentMessages(ownerId, conversationId, 10);
    const lastLead = [...recent].reverse().find((m) => m.sender_type === "lead") ?? null;
    return contextFrom(conv, lastLead);
  } catch {
    return null;
  }
}

async function logOutcome(ownerId: string, conversationId: string, outcome: PipelineOutcome, ctx: LogContext | null): Promise<void> {
  const base = { ownerId, conversationId, details: ctx ? { ...ctx } : null };
  switch (outcome.status) {
    case "SENT":
      // The send itself is logged in processClaimed, where the reply text is known.
      return;
    case "SKIPPED":
      await logActivity({ ...base, level: "info", step: "skip", message: `No reply to @${ctx?.lead_username ?? "lead"}: ${outcome.reason}.` });
      return;
    case "NEEDS_REVIEW":
      await logActivity({ ...base, level: "warn", step: "review", message: `Held for your review (@${ctx?.lead_username ?? "lead"}): ${outcome.reason}`, details: { ...(base.details ?? {}), issues: outcome.issues, generation_id: outcome.generationId } });
      return;
    case "ERROR_NOT_SENT":
      await logActivity({ ...base, level: "error", step: "error", message: `Failed, nothing sent to @${ctx?.lead_username ?? "lead"}: ${outcome.reason}` });
      return;
  }
}

export async function runPipeline(opts: PipelineOptions): Promise<PipelineOutcome> {
  let current = opts;
  let best: PipelineOutcome | null = null;

  for (;;) {
    const { outcome, followUp } = await runOnce(current);
    await logOutcome(current.ownerId, current.conversationId, outcome, await loadLogContext(current.ownerId, current.conversationId));
    if (best === null || outcome.status !== "SKIPPED") best = outcome;
    if (!followUp) return best;
    current = followUp;
  }
}

async function runOnce(opts: PipelineOptions): Promise<{ outcome: PipelineOutcome; followUp: PipelineOptions | null }> {
  const { ownerId, conversationId } = opts;
  const repo = getRepository();
  const attempt = opts.attempt ?? 0;
  let lockHeld = false;
  let planState: PlanState | null = null;

  try {
    // 1-2. Find conversation, check auto_chat_enabled
    const conv = await repo.getConversation(ownerId, conversationId);
    if (!conv) return skip("Conversation not found");
    if (!conv.settings.auto_chat_enabled) return skip("Auto chat is off");
    // Plan and chat limits are enforced against Supabase. Tests and demo mode have no database.
    if (process.env.NODE_ENV !== "test" && process.env.DEMO_MODE !== "true") {
      const plan = await getPlanState(ownerId);
      planState = plan;
      const all = await repo.listConversations(ownerId);
      const autoOn = all.filter((c) => c.settings.auto_chat_enabled).sort((a, b) => a.created_at.localeCompare(b.created_at));
      const rank = autoOn.findIndex((c) => c.id === conversationId);
      const planReason = chatLimitReason(plan, rank < 0 ? 0 : rank);
      if (planReason) return skip(planReason);
      const abuse = await checkAbuse(ownerId);
      if (abuse.action !== "ok") return skip(abuse.reason);
    }
    if (conv.state.conversation_stage === "HUMAN_TAKEOVER") return skip("Human has taken over");
    if (conv.state.needs_review) return skip("Waiting on a human review");

    lockHeld = await repo.acquireLock(ownerId, conversationId, LOCK_TTL_MS);
    if (!lockHeld) return skip("Another reply is already being processed");

    // 3-5. Latest 20 messages
    const messages = await repo.listRecentMessages(ownerId, conversationId, HISTORY_LIMIT);
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.sender_type !== "lead") return skip("No unanswered message from the lead");

    // Exactly-once gate: claim THIS inbound message before any AI work or sending.
    const claim = await repo.claimReply(ownerId, conversationId, lastMessage.id, opts.manual ? MANUAL_RECLAIMABLE : AUTO_RECLAIMABLE);
    if (!claim.claimed) {
      const existing = claim.existing;
      const reason = claimSkipReason(existing?.status);
      // A message that needs a person must be on Needs Review, not only in the logs.
      if (existing && (existing.status === "FAILED" || existing.status === "REVIEW" || existing.status === "UNKNOWN") && !conv.state.needs_review) {
        try {
          await repo.updateState(ownerId, conversationId, { needs_review: true, review_reason: reason, pending_generation_id: existing.generation_id });
        } catch {
          // flag is best-effort; the skip is still logged
        }
      }
      return skip(reason);
    }

    const trace: RunTrace = { generationId: null, sendStarted: false, sentOk: false, delivery: "instagram", sendAmbiguous: false, aborted: false, rerun: false };
    let outcome: PipelineOutcome;
    try {
      outcome = await processClaimed({ opts, conv, messages, lastMessage, trace, planState });
    } catch (err) {
      outcome = await handleUnexpected(err, ownerId, conv, trace);
    }
    await settleClaim(ownerId, lastMessage.id, outcome, trace);

    // Work out whether another lead message needs its own (separate) reply.
    let followUp: PipelineOptions | null = null;
    if (attempt < MAX_FOLLOW_UPS) {
      if (trace.rerun) {
        followUp = { ...opts, attempt: attempt + 1 };
      } else if (outcome.status === "SENT") {
        const newest = (await repo.listRecentMessages(ownerId, conversationId, 1))[0];
        if (newest && newest.sender_type === "lead" && newest.id !== lastMessage.id) followUp = { ...opts, attempt: attempt + 1 };
      }
    }
    return { outcome, followUp };
  } catch (err) {
    // Failed before a claim existed (DB down, etc.): nothing was sent. Best-effort flag.
    console.error("[pipeline] failed before claim, nothing sent:", errText(err));
    await logActivity({ ownerId, conversationId, level: "error", step: "internal", message: `Could not start the reply: ${errText(err)}`, details: { code: "db_or_setup_error" } });
    try {
      await repo.updateState(ownerId, conversationId, { needs_review: true, review_reason: `Processing failed: ${errText(err)}` });
    } catch {
      // DB itself is down; the error is returned to the caller.
    }
    return { outcome: { status: "ERROR_NOT_SENT", reason: errText(err) }, followUp: null };
  } finally {
    if (lockHeld) {
      try {
        await repo.releaseLock(ownerId, conversationId);
      } catch {
        // lock expires on its own after LOCK_TTL_MS; the claim, not the lock, prevents double replies
      }
    }
  }
}

function skip(reason: string): { outcome: PipelineOutcome; followUp: null } {
  return { outcome: { status: "SKIPPED", reason }, followUp: null };
}

function claimSkipReason(status: ReplyClaimStatus | undefined): string {
  switch (status) {
    case "SENT":
      return "Already replied to this message";
    case "PROCESSING":
      return "This message is already being processed";
    case "REVIEW":
      return "This message was held for review";
    case "FAILED":
      return "The last attempt on this message failed and needs a person";
    case "UNKNOWN":
      return "An earlier send for this message is unconfirmed. Check Instagram before replying";
    default:
      return "This message was already handled";
  }
}

function claimStatusFor(outcome: PipelineOutcome, trace: RunTrace): ReplyClaimStatus {
  if (trace.sentOk) return "SENT";
  if (trace.sendAmbiguous) return "UNKNOWN";
  if (trace.aborted) return "ABORTED";
  switch (outcome.status) {
    case "NEEDS_REVIEW":
      return "REVIEW";
    case "SENT":
      return "SENT";
    case "SKIPPED":
      return "ABORTED";
    case "ERROR_NOT_SENT":
      return "FAILED";
  }
}

async function settleClaim(ownerId: string, triggerMessageId: string, outcome: PipelineOutcome, trace: RunTrace) {
  try {
    await getRepository().setClaimStatus(ownerId, triggerMessageId, claimStatusFor(outcome, trace), trace.generationId);
  } catch (err) {
    // Leaving it PROCESSING is the safe failure: nothing will auto-retry it, and the stale sweep flags it.
    console.error("[pipeline] couldn't settle reply claim:", errText(err));
  }
}

/** An exception after the claim. The question that matters: did a reply possibly go out? */
async function handleUnexpected(err: unknown, ownerId: string, conv: ConversationFull, trace: RunTrace): Promise<PipelineOutcome> {
  console.error("[pipeline] unexpected error:", errText(err));
  await logActivity({ ownerId, conversationId: conv.id, level: trace.sentOk ? "warn" : "error", step: "internal", message: `Unexpected error: ${errText(err)}`, details: { ...contextFrom(conv, null), code: "internal_error", sent_ok: trace.sentOk } });
  if (trace.sentOk) {
    // Reply is out; only our bookkeeping failed. Don't flag it or send anything else.
    return { status: "SENT", generationId: trace.generationId ?? "", messageId: "", delivery: trace.delivery };
  }
  if (trace.sendStarted) trace.sendAmbiguous = true;
  const reason = trace.sendAmbiguous
    ? `A send was attempted but the result is unclear (${errText(err)}). Check Instagram before sending anything to this lead.`
    : `Processing failed: ${errText(err)}`;
  try {
    await getRepository().updateState(ownerId, conv.id, { needs_review: true, review_reason: reason, pending_generation_id: trace.generationId });
  } catch {
    // DB itself is down
  }
  return { status: "ERROR_NOT_SENT", reason };
}

async function processClaimed(args: {
  opts: PipelineOptions;
  conv: ConversationFull;
  messages: Message[];
  lastMessage: Message;
  trace: RunTrace;
  planState: PlanState | null;
}): Promise<PipelineOutcome> {
  const { opts, conv, messages, lastMessage, trace, planState } = args;
  const { ownerId, conversationId } = opts;
  const repo = getRepository();

  const [allServices, appSettings] = await Promise.all([repo.listServices(ownerId), repo.getAppSettings(ownerId)]);
  const allowed = allowedServicesFor(conv, allServices);

  let llm;
  try {
    llm = resolveLLM(appSettings, { platformGroqKeys: planState && isPlatformKeyPlan(planState) ? basicGroqKeys() : [] });
  } catch (err) {
    return await flag(ownerId, conv, null, errText(err), ["CHECKER_FAILURE"]);
  }

  // 6. Conversation AI
  const leadReplyCount = messages.filter((m) => m.sender_type === "lead").length;
  let generated;
  try {
    generated = await generateReply(
      llm,
      { conversation: conv, messages, allowedServices: allowed, settings: appSettings },
      {
        model: conversationModel(appSettings),
        demo: {
          lastLeadMessage: lastMessage.content,
          leadReplyCount,
          stage: conv.state.conversation_stage,
          pitchStatus: conv.state.pitch_status,
          currentTopic: conv.state.current_topic,
          identifiedProblem: conv.state.identified_problem,
          allowedServices: allowed.map((s) => ({ id: s.id, name: s.name })),
          forceBadDraft: opts.demo?.forceBadDraft,
        },
      },
    );
  } catch (err) {
    const raw = err instanceof MalformedOutputError ? err.raw : null;
    const errMsg = errText(err);
    const classified = classifyAiError(err, "ai");
    await logActivity({
      ownerId,
      conversationId,
      level: classified.level,
      step: "draft",
      message: `AI could not write a reply for @${conv.lead_username}: ${errMsg}`,
      details: { ...contextFrom(conv, lastMessage), code: classified.code, raw_output: raw ? raw.slice(0, 500) : null },
    });

    // If it's a rate limit, schedule a retry instead of flagging
    if (err instanceof LLMError && err.kind === "rate_limit") {
      console.log(`[pipeline] Groq rate limit hit, scheduling retry for conversation=${conversationId}`);
      trace.generationId = null;
      try {
        await repo.scheduleRetry(ownerId, conversationId, `Groq rate limit: ${errMsg}`);
      } catch (retryErr) {
        console.error(`[pipeline] failed to schedule retry:`, errText(retryErr));
      }
      // Mark the claim as RATE_LIMITED so it can be auto-retried when the cron runs
      await repo.setClaimStatus(ownerId, lastMessage.id, "RATE_LIMITED", null);
      return { status: "ERROR_NOT_SENT", reason: `Rate limited. Will retry automatically in 5-10 minutes: ${errMsg}` };
    }

    const gen = await repo.createGeneration(ownerId, {
      conversation_id: conversationId,
      generated_text: raw,
      model: conversationModel(appSettings),
      prompt_version: CONVERSATION_PROMPT_VERSION,
      status: "PENDING_REVIEW",
      error: errMsg,
      state_update: null,
    });
    trace.generationId = gen.id;
    const issue: CheckerIssue = err instanceof MalformedOutputError ? "BROKEN_OUTPUT" : "CHECKER_FAILURE";
    return await flag(ownerId, conv, gen.id, `AI generation failed: ${errMsg}`, [issue]);
  }

  // 7. Validate schema (done by the engine) + record the raw generation for audit
  const { output } = generated;
  const logCtx = contextFrom(conv, lastMessage);
  await logActivity({ ownerId, conversationId: conv.id, level: "info", step: "draft", message: `Drafted a reply to @${logCtx.lead_username} (stage ${output.state_update.conversation_stage}, pitch ${output.state_update.pitch_status}).`, details: { ...logCtx, reply: output.reply, model: generated.model, stage: output.state_update.conversation_stage, pitch_status: output.state_update.pitch_status } });
  const gen = await repo.createGeneration(ownerId, {
    conversation_id: conversationId,
    generated_text: output.reply,
    model: generated.model,
    prompt_version: generated.promptVersion,
    status: "PENDING_REVIEW",
    error: null,
    state_update: output.state_update,
  });
  trace.generationId = gen.id;

  // 7b. Deterministic guards before spending a checker call
  const guard = deterministicGuard({ output, conv, messages, allowed, allServices });
  if (!guard.ok) {
    await logActivity({ ownerId, conversationId: conv.id, level: "warn", step: "guard", message: `Draft blocked by safety rules: ${guard.reason}`, details: { ...contextFrom(conv, lastMessage), code: "guard_rejected", issues: guard.issues } });
    await repo.addReview(ownerId, { generation_id: gen.id, reviewer: "rules", approved: false, confidence: 1, issues: guard.issues, reason: guard.reason });
    return await flag(ownerId, conv, gen.id, guard.reason, guard.issues);
  }

  // 8. Output checker AI
  let check;
  try {
    check = await runOutputChecker(
      llm,
      {
        conversation: conv,
        messages,
        candidate: output.reply,
        proposedState: {
          potential_service_id: output.state_update.potential_service_id,
          pitch_status: output.state_update.pitch_status,
          conversation_stage: output.state_update.conversation_stage,
        },
        allowedServices: allowed,
        allServices,
      },
      {
        model: checkerModel(appSettings),
        minConfidence: appSettings.checker_min_confidence ?? getEnv().CHECKER_MIN_CONFIDENCE,
        demo: {
          candidate: output.reply,
          lastLeadMessage: lastMessage.content,
          pitchStatus: output.state_update.pitch_status,
          previousPitchStatus: conv.state.pitch_status,
          potentialServiceId: output.state_update.potential_service_id,
          allowedServiceIds: allowed.map((s) => s.id),
        },
      },
    );
  } catch (err) {
    // If checker hits rate limit, schedule retry
    if (err instanceof LLMError && err.kind === "rate_limit") {
      console.log(`[pipeline] Checker rate limit hit, scheduling retry for conversation=${conversationId}`);
      try {
        await repo.scheduleRetry(ownerId, conversationId, `Checker rate limit: ${errText(err)}`);
      } catch (retryErr) {
        console.error(`[pipeline] failed to schedule retry:`, errText(retryErr));
      }
      // Mark the claim as RATE_LIMITED so it can be auto-retried when the cron runs
      await repo.setClaimStatus(ownerId, lastMessage.id, "RATE_LIMITED", gen.id);
      return { status: "ERROR_NOT_SENT", reason: `Checker rate limited. Will retry automatically in 5-10 minutes: ${errText(err)}` };
    }
    const classified = classifyAiError(err, "checker");
    await logActivity({ ownerId, conversationId: conv.id, level: classified.level, step: "checker", message: `Checker could not run for @${conv.lead_username}: ${errText(err)}`, details: { ...contextFrom(conv, lastMessage), code: classified.code } });
    // Other errors: flag for review
    await repo.addReview(ownerId, { generation_id: gen.id, reviewer: "ai", approved: false, confidence: 0, issues: ["CHECKER_FAILURE"], reason: `Checker error: ${errText(err)}` });
    return await flag(ownerId, conv, gen.id, `Checker failed: ${errText(err)}`, ["CHECKER_FAILURE"]);
  }

  await repo.addReview(ownerId, {
    generation_id: gen.id,
    reviewer: "ai",
    approved: check.approved,
    confidence: check.confidence,
    issues: check.issues,
    reason: check.reason,
  });

  await logActivity({
    ownerId,
    conversationId: conv.id,
    level: check.approved ? "info" : "warn",
    step: "checker",
    message: check.approved ? `Checker approved the draft for @${logCtx.lead_username} (confidence ${check.confidence.toFixed(2)}).` : `Checker rejected the draft for @${logCtx.lead_username}: ${check.reason || "no reason given"}`,
    details: { ...logCtx, issues: check.issues, confidence: check.confidence, reason: check.reason || null },
  });

  // 9. Rejected: DO NOT SEND
  if (!check.approved) {
    return await flag(ownerId, conv, gen.id, check.reason || "Rejected by output checker", check.issues);
  }

  // 10-11. Deterministic cleanup + final validation
  const finalText = cleanMessage(output.reply);
  const final = runLocalRules(finalText, { recentOwnMessages: recentOwn(messages) });
  if (!final.ok || finalText.length === 0 || finalText.length > 1000) {
    const reason = `Final validation failed: ${final.reason || "invalid length"}`;
    await repo.addReview(ownerId, {
      generation_id: gen.id,
      reviewer: "rules",
      approved: false,
      confidence: 1,
      issues: final.issues.length ? final.issues : ["BROKEN_OUTPUT"],
      reason,
    });
    return await flag(ownerId, conv, gen.id, reason, final.issues);
  }

  // 12. Re-check live state immediately before sending (Take Over / toggle / newer message)
  const fresh = await repo.getConversation(ownerId, conversationId);
  const newest = (await repo.listRecentMessages(ownerId, conversationId, 1))[0];
  if (!fresh || !fresh.settings.auto_chat_enabled || fresh.state.conversation_stage === "HUMAN_TAKEOVER" || fresh.state.needs_review) {
    trace.aborted = true;
    await repo.updateGeneration(ownerId, gen.id, { status: "ABORTED", error: "Auto chat was turned off before sending" });
    return { status: "SKIPPED", reason: "Auto chat was turned off before the reply could be sent" };
  }
  if (newest && newest.id !== lastMessage.id) {
    trace.aborted = true;
    trace.rerun = newest.sender_type === "lead";
    await repo.updateGeneration(ownerId, gen.id, { status: "ABORTED", error: "Conversation changed while generating" });
    return { status: "SKIPPED", reason: "Conversation changed while generating" };
  }

  // 13. Send through the Instagram service. One attempt. Never retried here.
  const ig = await getInstagramService(ownerId);
  let sent;
  trace.sendStarted = true;
  try {
    sent = await ig.sendMessage({
      externalThreadId: fresh.external_thread_id,
      recipientExternalId: fresh.lead_external_id ?? fresh.external_thread_id,
      text: finalText,
    });
  } catch (err) {
    // Instagram answering with a clear 4xx (bad token, etc.) means it was NOT delivered.
    // A timeout / network error / 5xx doesn't tell us either way, so treat it as possibly delivered.
    const definitelyNotSent = err instanceof InstagramNotConfiguredError || (err instanceof InstagramApiError && !err.retryable);
    trace.sendAmbiguous = !definitelyNotSent;
    await repo.updateGeneration(ownerId, gen.id, { error: `Send failed: ${errText(err)}` });
    const sendCode = err instanceof InstagramNotConfiguredError
      ? "instagram_not_configured"
      : /190|expired|OAuth/i.test(errText(err))
        ? "instagram_token_expired"
        : definitelyNotSent
          ? "instagram_rejected"
          : "instagram_unconfirmed";
    await logActivity({ ownerId, conversationId: conv.id, level: "error", step: "send", message: `Could not send to @${conv.lead_username}: ${errText(err)}`, details: { ...contextFrom(conv, lastMessage), code: sendCode, generation_id: gen.id, may_have_been_delivered: !definitelyNotSent } });
    const reason = definitelyNotSent
      ? `Instagram didn't accept the message: ${errText(err)}`
      : `Instagram didn't confirm the send (${errText(err)}). It may or may not have been delivered. Check the chat on Instagram before sending anything.`;
    return await flag(ownerId, conv, gen.id, reason, ["OTHER"]);
  }
  trace.sentOk = true;
  trace.delivery = sent.delivery;
  await logActivity({
    ownerId,
    conversationId: conv.id,
    level: "success",
    step: "send",
    message: `Reply sent to @${logCtx.lead_username}.`,
    details: { ...logCtx, reply: finalText, delivery: sent.delivery, generation_id: gen.id, checker_confidence: check.confidence },
  });

  // 14-15. Save message + update state. The reply is already out, so failures here are only logged.
  let messageId = "";
  try {
    const metadata = {
      generation_id: gen.id,
      trigger_message_id: lastMessage.id,
      delivery: sent.delivery,
      checker_confidence: check.confidence,
      cleaned: finalText !== output.reply,
    };
    const added = await repo.addMessage(ownerId, {
      conversation_id: conversationId,
      external_message_id: sent.externalMessageId,
      sender_type: "ai",
      sender_name: "Primz AI",
      content: finalText,
      metadata,
    });
    messageId = added.message.id;
    // Instagram's echo of our own message can arrive before we save it and be stored as "You".
    if (!added.created) {
      await repo.updateMessage(ownerId, added.message.id, { sender_type: "ai", sender_name: "Primz AI", metadata });
    }
    await repo.updateGeneration(ownerId, gen.id, { status: "SENT" });
    await repo.updateState(ownerId, conversationId, {
      ...nextState(conv.state, output),
      last_ai_message: finalText,
      needs_review: false,
      review_reason: null,
      pending_generation_id: null,
    });
  } catch (err) {
    console.error("[pipeline] reply was SENT but recording it failed:", errText(err));
  }
  return { status: "SENT", generationId: gen.id, messageId, delivery: sent.delivery };
}

/* -------------------------------------------------------------------------- */

export function allowedServicesFor(conv: ConversationFull, all: Service[]): Service[] {
  // Services are switched on/off per chat only (there is no global toggle).
  if (conv.settings.all_services) return all;
  const chosen = new Set(conv.service_ids);
  return all.filter((s) => chosen.has(s.id));
}

function recentOwn(messages: Message[]): string[] {
  return messages.filter((m) => m.sender_type !== "lead").slice(-6).map((m) => m.content);
}

function errText(err: unknown): string {
  if (err instanceof LLMError) return err.message;
  return err instanceof Error ? err.message : "Unknown error";
}

async function flag(
  ownerId: string,
  conv: ConversationFull,
  generationId: string | null,
  reason: string,
  issues: string[],
): Promise<PipelineOutcome> {
  await getRepository().updateState(ownerId, conv.id, {
    needs_review: true,
    review_reason: issues.length ? `${issues.join(", ")}: ${reason}` : reason,
    pending_generation_id: generationId,
  });
  return { status: "NEEDS_REVIEW", generationId, reason, issues };
}

interface Guard {
  ok: boolean;
  issues: CheckerIssue[];
  reason: string;
}

function deterministicGuard(args: {
  output: GenerationOutput;
  conv: ConversationFull;
  messages: Message[];
  allowed: Service[];
  allServices: Service[];
}): Guard {
  const { output, conv, messages, allowed, allServices } = args;
  const issues = new Set<CheckerIssue>();
  const reasons: string[] = [];
  const add = (i: CheckerIssue, r: string) => {
    issues.add(i);
    reasons.push(r);
  };
  const update = output.state_update;
  const lastLead = [...messages].reverse().find((m) => m.sender_type === "lead")?.content ?? "";

  if (output.escalate_reason) {
    const code: CheckerIssue = output.escalate_reason === "PROMPT_MANIPULATION" ? "INJECTION_ATTEMPT" : "UNCERTAIN";
    add(code, `The AI asked for a human to handle this turn (${output.escalate_reason}).`);
  }
  if (detectInjectionAttempt(lastLead)) add("INJECTION_ATTEMPT", "The lead's message looks like an attempt to manipulate the AI.");
  if (asksIfAutomated(lastLead)) add("UNCERTAIN", "The lead is asking whether this is automated. A human should answer that.");

  if (update.conversation_stage === "HUMAN_TAKEOVER") add("BROKEN_OUTPUT", "AI tried to set the HUMAN_TAKEOVER stage.");

  const allowedIds = new Set(allowed.map((s) => s.id));
  if (update.potential_service_id && !allowedIds.has(update.potential_service_id)) {
    add("SERVICE_NOT_SELECTED", "The AI referenced a service that isn't selected/active for this chat.");
  }
  const newlyPitching = update.pitch_status === "PITCHED" && conv.state.pitch_status === "NOT_PITCHED";
  if (newlyPitching && (allowed.length === 0 || !update.potential_service_id)) {
    add("PREMATURE_PITCH", "The AI tried to pitch without a valid selected service.");
  }

  // Variants of one offering share a base name ("AI Receptionist (Real Estate)" / "(Clinics)").
  // A mention that matches an allowed service's base name is not treated as a non-selected service.
  const baseName = (name: string) => name.replace(/\s*\(.*?\)/g, "").trim().toLowerCase();
  const allowedBases = new Set(allowed.map((s) => baseName(s.name)));
  const lower = output.reply.toLowerCase();
  for (const s of allServices) {
    if (allowedIds.has(s.id)) continue;
    const base = baseName(s.name);
    if (allowedBases.has(base)) continue;
    if (base.length >= 6 && lower.includes(base)) add("SERVICE_NOT_SELECTED", `Mentions "${s.name}", which isn't selected for this chat.`);
  }

  const rules = runLocalRules(output.reply, { recentOwnMessages: recentOwn(messages) });
  for (const i of rules.issues) issues.add(i);
  if (rules.reason) reasons.push(rules.reason);

  return { ok: issues.size === 0, issues: [...issues], reason: reasons.join(" ") };
}

/** Apply the model's state update; pitch status never regresses once PITCHED. */
export function nextState(current: ConversationState, output: GenerationOutput): Partial<Omit<ConversationState, "conversation_id">> {
  const u = output.state_update;
  return {
    current_topic: u.current_topic ?? current.current_topic,
    identified_problem: u.identified_problem ?? current.identified_problem,
    potential_service_id: u.potential_service_id ?? current.potential_service_id,
    interest_level: u.interest_level,
    conversation_stage: u.conversation_stage,
    pitch_status: current.pitch_status === "PITCHED" ? "PITCHED" : u.pitch_status,
    objection: u.objection,
  };
}

export type { AiGeneration };
