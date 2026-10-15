"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { runAiNowAction } from "@/app/actions";
import type { ActivityEntry, ActivityLevel } from "@/lib/services/activity-log";

const LEVEL_LABEL: Record<ActivityLevel, string> = {
  error: "ERROR",
  warn: "WARN ",
  info: "INFO ",
  success: "OK   ",
};

const LEVEL_CLASS: Record<ActivityLevel, string> = {
  error: "text-red-400",
  warn: "text-amber-300",
  info: "text-sky-300",
  success: "text-emerald-400",
};

type Filter = "all" | "problems" | "sent" | "info";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "problems", label: "Errors & warnings" },
  { id: "sent", label: "Sent" },
  { id: "info", label: "Info" },
];

/** 12-hour clock in the viewer's timezone, e.g. "Oct 15 6:33:35 PM". */
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

function matches(entry: ActivityEntry, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "problems") return entry.level === "error" || entry.level === "warn";
  if (filter === "sent") return entry.level === "success";
  return entry.level === "info";
}

/** Renders details as logfmt-style key=value pairs, one per line. */
function detailLines(details: Record<string, unknown>): string[] {
  return Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`);
}

function LogLine({ entry }: { entry: ActivityEntry }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const details = entry.details ?? {};
  const code = typeof details.code === "string" ? details.code : null;
  const lines = detailLines(details);
  const canRetry = Boolean(entry.conversation_id);
  const leadTag = typeof details.lead_username === "string" ? `@${details.lead_username}` : null;

  const retry = () => {
    if (!entry.conversation_id) return;
    start(async () => {
      const res = await runAiNowAction(entry.conversation_id as string);
      if (res.ok) {
        setResult({ ok: res.data?.status === "SENT" || res.data?.status === "SKIPPED", text: res.data?.message ?? "Retry finished." });
      } else {
        setResult({ ok: false, text: res.error });
      }
      router.refresh();
    });
  };

  return (
    <div className="border-b border-zinc-800/70 px-3 py-2 last:border-b-0 hover:bg-white/[0.02]">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-zinc-500">{formatLogTime(entry.created_at)}</span>
        <span className={`font-bold ${LEVEL_CLASS[entry.level]}`}>{LEVEL_LABEL[entry.level]}</span>
        <span className="text-zinc-500">[{entry.step}]</span>
        {code ? <span className="rounded bg-zinc-800 px-1.5 text-[11px] text-amber-200">{code}</span> : null}
        {leadTag ? <span className="text-violet-300">{leadTag}</span> : null}
        <span className="min-w-0 flex-1 break-words text-zinc-100">{entry.message}</span>
        <span className="flex items-center gap-2">
          {entry.conversation_id ? (
            <Link href={`/chats/${entry.conversation_id}`} className="text-[11px] text-sky-400 hover:underline">
              chat
            </Link>
          ) : null}
          {canRetry ? (
            <button
              type="button"
              onClick={retry}
              disabled={pending}
              className="rounded border border-zinc-600 px-1.5 py-0.5 text-[11px] text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              {pending ? "retrying…" : "retry"}
            </button>
          ) : null}
        </span>
      </div>

      {lines.length > 0 ? (
        <details className="mt-1 pl-[1.5rem] text-[11px] text-zinc-500">
          <summary className="cursor-pointer select-none hover:text-zinc-300">details ({lines.length})</summary>
          <pre className="mt-1 whitespace-pre-wrap break-all rounded bg-black/40 p-2 text-zinc-400">{lines.join("\n")}</pre>
        </details>
      ) : null}

      {result ? (
        <p role="status" className={`mt-1 pl-[1.5rem] text-[11px] ${result.ok ? "text-emerald-400" : "text-red-400"}`}>
          {result.ok ? "ok" : "failed"}: {result.text}
        </p>
      ) : null}
    </div>
  );
}

export function LogViewer({ entries }: { entries: ActivityEntry[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = useMemo(() => entries.filter((e) => matches(e, filter)), [entries, filter]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-2 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${filter === f.id ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"}`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto self-center text-xs text-zinc-500">{visible.length} of {entries.length} lines</span>
      </div>

      <div className="overflow-hidden rounded-2xl bg-zinc-950 font-mono text-[12px] leading-relaxed shadow-sm">
        {visible.length === 0 ? (
          <p className="p-4 text-zinc-500">No lines match this filter.</p>
        ) : (
          visible.map((e) => <LogLine key={e.id} entry={e} />)
        )}
      </div>
    </div>
  );
}
