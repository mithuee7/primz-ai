"use client";

import { useEffect, useRef, useState } from "react";
import { demoTurnAction, type DemoMessage } from "@/app/landing-actions";
import { typingDelayMs } from "@/lib/text/typing";

const LEAD_NAME = "Riya Sharma";
const MAX_MESSAGES = 15;

/** Fixed opening: we message first, then the lead replies. Both are shown by default. */
const OPENING: DemoMessage[] = [
  { from: "us", text: "Hey Riya! Saw you're running a lot of ads lately. How are you handling the DMs that come in?" },
  { from: "lead", text: "Hey, yeah. What's this about?" },
];

export function DemoChat() {
  const [messages, setMessages] = useState<DemoMessage[]>(OPENING);
  const [running, setRunning] = useState(false);
  const [booked, setBooked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState<"us" | "lead" | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => () => void (cancelled.current = true), []);

  const play = async () => {
    setRunning(true);
    setError(null);
    cancelled.current = false;
    let history = messages;
    while (!cancelled.current && history.length < MAX_MESSAGES && !booked) {
      const side = history[history.length - 1]!.from === "us" ? "lead" : "us";
      setTyping(side);
      const res = await demoTurnAction(history);
      if (!res.ok) {
        setTyping(null);
        setError(res.error);
        break;
      }
      // Show the typing indicator for as long as a person would take to type this reply.
      await new Promise((r) => setTimeout(r, typingDelayMs(res.text)));
      setTyping(null);
      history = [...history, { from: side, text: res.text }];
      setMessages(history);
      if (res.booked) {
        setBooked(true);
        break;
      }
      await new Promise((r) => setTimeout(r, 900));
    }
    setRunning(false);
  };

  const restart = () => {
    cancelled.current = true;
    setMessages(OPENING);
    setBooked(false);
    setError(null);
    setRunning(false);
  };

  const finished = booked || messages.length >= MAX_MESSAGES;

  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white shadow-[0_30px_80px_-30px_rgb(24_24_27/0.35)]">
      {/* Instagram-style header */}
      <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-3.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 text-sm font-bold text-white">
          {LEAD_NAME.split(" ").map((p) => p[0]).join("")}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-zinc-900">{LEAD_NAME}</p>
          <p className="truncate text-xs text-zinc-500">Active now</p>
        </div>
      </div>

      {/* Thread */}
      <div ref={scroller} className="h-[360px] space-y-2 overflow-y-auto bg-white px-4 py-5">
        {messages.map((m, i) => (
          <div key={i} className={`flex animate-fade-up ${m.from === "us" ? "justify-end" : "justify-start"}`}>
            <p
              className={`max-w-[78%] px-4 py-2.5 text-[15px] leading-snug ${
                m.from === "us"
                  ? "rounded-[22px] rounded-br-md bg-gradient-to-br from-blue-600 to-indigo-600 text-white"
                  : "rounded-[22px] rounded-bl-md bg-zinc-100 text-zinc-900"
              }`}
            >
              {m.text}
            </p>
          </div>
        ))}
        {typing ? (
          <div className={`flex ${typing === "us" ? "justify-end" : "justify-start"}`}>
            <div className="flex gap-1 rounded-full bg-zinc-100 px-4 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
            </div>
          </div>
        ) : null}
        {error ? <p className="pt-2 text-center text-xs text-red-600">{error}</p> : null}
      </div>

      {/* Input bar, decorative */}
      <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-4 py-3">
        <span />
        {finished ? (
          <button type="button" onClick={restart} className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.97]">
            Replay
          </button>
        ) : (
          <button type="button" onClick={play} disabled={running} className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.97] disabled:opacity-50">
            {running ? "Live…" : "Watch it reply"}
          </button>
        )}
      </div>
    </div>
  );
}
