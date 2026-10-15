"use client";

import { RotateCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runAiNowAction } from "@/app/actions";
import { Badge, Button } from "@/components/ui/primitives";
import type { ActivityEntry, ActivityLevel } from "@/lib/services/activity-log";

const LEVEL_TONE: Record<ActivityLevel, "green" | "amber" | "red" | "neutral"> = {
  success: "green",
  info: "neutral",
  warn: "amber",
  error: "red",
};

const FIELD_LABELS: Record<string, string> = {
  lead_username: "To",
  lead_name: "Lead name",
  incoming_message: "Lead said",
  incoming_at: "Lead sent at",
  reply: "Reply",
  model: "Model",
  stage: "Stage",
  pitch_status: "Pitch",
  delivery: "Delivery",
  generation_id: "Generation ID",
  checker_confidence: "Checker confidence",
  confidence: "Checker confidence",
  issues: "Issues",
  reason: "Checker reason",
};

const QUOTED = new Set(["incoming_message", "reply"]);

/** 12-hour clock in the viewer's own timezone, e.g. "Oct 15, 6:29:05 PM". */
export function formatLogTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function displayValue(key: string, value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "none";
  if (key === "lead_username" && typeof value === "string") return `@${value}`;
  if (key === "incoming_at" || key === "created_at") return typeof value === "string" ? formatLogTime(value) : String(value);
  if ((key === "confidence" || key === "checker_confidence") && typeof value === "number") return value.toFixed(2);
  return String(value);
}

export function LogRow({ entry }: { entry: ActivityEntry }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const details = entry.details ?? {};
  const fields = Object.entries(details).filter(([k, v]) => FIELD_LABELS[k] && v !== null && v !== undefined && v !== "");
  const canRetry = Boolean(entry.conversation_id) && (entry.level === "error" || entry.level === "warn");

  const retry = () => {
    if (!entry.conversation_id) return;
    start(async () => {
      const res = await runAiNowAction(entry.conversation_id as string);
      if (res.ok) {
        setResult({ ok: res.data?.status !== "ERROR_NOT_SENT" && res.data?.status !== "NEEDS_REVIEW", text: res.data?.message ?? "Retry finished." });
      } else {
        setResult({ ok: false, text: res.error });
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:gap-3">
      <div className="flex shrink-0 flex-col gap-1 sm:w-44">
        <Badge tone={LEVEL_TONE[entry.level]} className="w-fit">{entry.level}</Badge>
        <time dateTime={entry.created_at} suppressHydrationWarning className="text-[11px] text-zinc-500">
          {formatLogTime(entry.created_at)}
        </time>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <p className="break-words text-sm text-zinc-900">
          <span className="mr-1.5 font-mono text-[11px] text-zinc-500">[{entry.step}]</span>
          {entry.message}
        </p>

        {fields.length > 0 ? (
          <dl className="grid gap-x-3 gap-y-1.5 rounded-lg bg-zinc-50 p-2.5 text-xs sm:grid-cols-[9rem_1fr]">
            {fields.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-zinc-500">{FIELD_LABELS[k]}</dt>
                <dd className={`min-w-0 break-words text-zinc-800 ${QUOTED.has(k) ? "whitespace-pre-wrap rounded-md border border-zinc-200 bg-white p-2" : ""}`}>
                  {displayValue(k, v)}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {entry.conversation_id ? (
            <Link href={`/chats/${entry.conversation_id}`} className="text-xs text-blue-600 hover:underline">
              Open chat
            </Link>
          ) : null}
          {canRetry ? (
            <Button size="sm" variant="secondary" disabled={pending} onClick={retry}>
              <RotateCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} /> {pending ? "Retrying…" : "Retry"}
            </Button>
          ) : null}
        </div>
        {result ? (
          <p role="status" className={`text-xs ${result.ok ? "text-emerald-700" : "text-red-700"}`}>{result.text}</p>
        ) : null}
      </div>
    </div>
  );
}
