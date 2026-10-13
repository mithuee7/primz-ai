"use client";

import { KeyRound, Trash2 } from "lucide-react";
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
  const [keyInput, setKeyInput] = useState("");
  const [savedCount, setSavedCount] = useState(keyCount);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSaveKey = () => {
    const key = keyInput.trim();
    if (!key || key.length < 20) {
      setMessage({ ok: false, text: "Invalid key format" });
      return;
    }

    start(async () => {
      const res = await onSave(key);
      if (res.ok) {
        setKeyInput("");
        setSavedCount(savedCount + 1);
        setMessage({ ok: true, text: `✓ Key ${savedCount + 1} saved!` });
        setTimeout(() => setMessage(null), 2500);
      } else {
        setMessage({ ok: false, text: res.error || "Failed to save" });
      }
    });
  };

  const handleDeleteAllKeys = () => {
    if (confirm(`Delete all ${savedCount} ${keyType.toUpperCase()} keys? This cannot be undone.`)) {
      start(async () => {
        const res = await onClear();
        if (res.ok) {
          setKeyInput("");
          setSavedCount(0);
          setMessage({ ok: true, text: "All keys deleted" });
          setTimeout(() => setMessage(null), 2500);
        }
      });
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">{label}</h3>
          <p className="mt-1 text-xs text-zinc-600">{description}</p>
        </div>
        {savedCount > 0 && (
          <div className="inline-flex items-center gap-2 rounded bg-white px-2 py-1 text-xs text-zinc-600 ml-4">
            <KeyRound className="h-3 w-3" />
            {savedCount} {savedCount === 1 ? "key" : "keys"} saved
          </div>
        )}
      </div>

      <div className="mt-4">
        <label className="block text-xs font-medium text-zinc-700 mb-1">
          Key {savedCount + 1}
        </label>
        <div className="flex gap-2">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && keyInput.length >= 20) handleSaveKey();
            }}
            placeholder={`Paste your ${keyType === "groq" ? "Groq" : "Apify"} API key`}
            className="flex-1 rounded border border-zinc-200 bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button
            size="sm"
            disabled={pending || !keyInput || keyInput.length < 20}
            onClick={handleSaveKey}
            className="whitespace-nowrap"
          >
            <KeyRound className="h-3 w-3" /> Save
          </Button>
          {savedCount > 0 && (
            <Button
              size="sm"
              variant="dangerOutline"
              disabled={pending}
              onClick={handleDeleteAllKeys}
              title="Delete all saved keys"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
        {message && (
          <p className={`mt-2 text-xs ${message.ok ? "text-emerald-600" : "text-red-600"}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
