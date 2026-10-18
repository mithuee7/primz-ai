"use client";

import { useState, useTransition } from "react";
import { demoReplyAction, type DemoTurn } from "@/app/landing-actions";

/** Lead messages are fixed. Our replies are written live by the AI each time. */
const LEAD_LINES = [
  "hey, saw your post. how does this DM thing work?",
  "we get a lot of messages from reels and nobody answers fast. is that what this fixes?",
  "ok sounds interesting. how much does it cost?",
];

export function DemoChat() {
  const [turns, setTurns] = useState<DemoTurn[]>([]);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const next = () => {
    if (step >= LEAD_LINES.length) return;
    const withLead: DemoTurn[] = [...turns, { role: "lead", text: LEAD_LINES[step]! }];
    setTurns(withLead);
    setError(null);
    start(async () => {
      const res = await demoReplyAction(withLead);
      if (res.ok) {
        setTurns([...withLead, { role: "ai", text: res.reply }]);
        setStep(step + 1);
      } else {
        setError(res.error);
      }
    });
  };

  const reset = () => {
    setTurns([]);
    setStep(0);
    setError(null);
  };

  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-zinc-200">
      <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-amber-400" />
        <div>
          <p className="text-sm font-semibold text-zinc-900">your_business</p>
          <p className="text-[11px] text-zinc-500">Live demo</p>
        </div>
      </div>
      <div className="min-h-[260px] space-y-2 bg-zinc-50 p-4">
        {turns.length === 0 ? <p className="pt-10 text-center text-sm text-zinc-500">Press play to watch a lead message come in and the AI reply.</p> : null}
        {turns.map((t, i) => (
          <div key={i} className={`flex ${t.role === "ai" ? "justify-end" : "justify-start"}`}>
            <p className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${t.role === "ai" ? "bg-blue-600 text-white" : "bg-white text-zinc-900 ring-1 ring-zinc-200"}`}>{t.text}</p>
          </div>
        ))}
        {pending ? <p className="text-xs text-zinc-500">AI is writing a reply…</p> : null}
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-zinc-100 px-4 py-3">
        <button type="button" onClick={reset} className="text-xs text-zinc-500 hover:underline">Restart</button>
        <button
          type="button"
          onClick={next}
          disabled={pending || step >= LEAD_LINES.length}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {step >= LEAD_LINES.length ? "Demo finished" : turns.length === 0 ? "Play demo" : "Next lead message"}
        </button>
      </div>
    </div>
  );
}
