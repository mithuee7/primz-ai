"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminLoginAction } from "./actions";

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#fafafa] px-6">
      <form
        className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-8 shadow-[0_30px_80px_-30px_rgb(24_24_27/0.25)]"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await adminLoginAction(password);
            if (res.ok) router.refresh();
            else setError(res.error ?? "Failed");
          });
        }}
      >
        <p className="text-xl font-bold tracking-tight">Admin</p>
        <p className="mt-1 text-sm text-zinc-500">Sign in to confirm plans.</p>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="field mt-6"
        />
        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
        <button type="submit" disabled={pending || !password} className="mt-5 w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-zinc-800 disabled:opacity-40">
          {pending ? "Checking…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
