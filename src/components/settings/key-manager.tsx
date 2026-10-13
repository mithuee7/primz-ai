"use client";

import { KeyRound, Plus, Trash2, Copy, Check } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/primitives";

interface KeyManagerProps {
  keyType: "groq" | "apify";
  currentKeys: string[];
  lastFour: string | null;
  keyCount: number;
  onSave: (keys: string) => Promise<{ ok: boolean; error?: string }>;
  onClear: () => Promise<{ ok: boolean; error?: string }>;
  label: string;
  description: string;
}

export function KeyManager({ keyType, currentKeys, lastFour, keyCount, onSave, onClear, label, description }: KeyManagerProps) {
  const [pending, start] = useTransition();
  const [keys, setKeys] = useState(currentKeys.join(","));
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSave = () => {
    start(async () => {
      const res = await onSave(keys);
      if (res.ok) {
        setKeys("");
        setMsg({ ok: true, text: "Key(s) saved successfully!" });
      } else {
        setMsg({ ok: false, text: res.error || "Failed to save" });
      }
    });
  };

  const handleClear = () => {
    if (confirm("Delete all saved keys? This cannot be undone.")) {
      start(async () => {
        const res = await onClear();
        setMsg(res.ok ? { ok: true, text: "Keys deleted" } : { ok: false, text: res.error || "Failed to delete" });
        if (res.ok) setKeys("");
      });
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(keys);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <h3 className="text-sm font-semibold text-zinc-900">{label}</h3>
      <p className="mt-1 text-xs text-zinc-600">{description}</p>

      {keyCount > 0 && (
        <div className="mt-2 inline-flex items-center gap-2 rounded bg-white px-2 py-1 text-xs text-zinc-600">
          <KeyRound className="h-3 w-3" />
          {keyCount} {keyCount === 1 ? "key" : "keys"} configured {lastFour && `(ends ${lastFour})`}
        </div>
      )}

      <div className="mt-3 space-y-2">
        <textarea
          value={keys}
          onChange={(e) => setKeys(e.target.value)}
          placeholder={`Paste ${keyType === "groq" ? "gsk_" : "apify_"}keys separated by commas`}
          className="w-full rounded border border-zinc-200 bg-white px-2 py-2 text-xs font-mono"
          rows={2}
        />

        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={pending || keys.trim().length < 20}
            onClick={handleSave}
            className="flex-1"
          >
            <KeyRound className="h-3 w-3" /> Save
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || !keys}
            onClick={copyToClipboard}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
          {keyCount > 0 && (
            <Button
              size="sm"
              variant="dangerOutline"
              disabled={pending}
              onClick={handleClear}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>

        {msg && (
          <p
            className={`text-xs ${
              msg.ok ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}
