"use client";

import { KeyRound, Plus, Trash2 } from "lucide-react";
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
  const [keyInputs, setKeyInputs] = useState<string[]>([""]); // Start with one empty input
  const [messages, setMessages] = useState<Record<number, { ok: boolean; text: string } | null>>({});

  const handleSaveKey = (index: number) => {
    const key = keyInputs[index]?.trim();
    if (!key || key.length < 20) {
      setMessages({ ...messages, [index]: { ok: false, text: "Invalid key format" } });
      return;
    }

    start(async () => {
      const res = await onSave(key);
      if (res.ok) {
        setMessages({ ...messages, [index]: { ok: true, text: "✓ Saved" } });
        setTimeout(() => setMessages(m => ({ ...m, [index]: null })), 2500);

        // Add a new empty input after this one if there isn't one already
        const updated = [...keyInputs];
        if (index === keyInputs.length - 1) {
          setKeyInputs([...updated, ""]);
        }
      } else {
        setMessages({ ...messages, [index]: { ok: false, text: res.error || "Failed" } });
      }
    });
  };

  const handleDeleteKey = (index: number) => {
    if (confirm(`Delete this ${keyType.toUpperCase()} key?`)) {
      start(async () => {
        const res = await onClear();
        if (res.ok) {
          const updated = keyInputs.filter((_, i) => i !== index);
          setKeyInputs(updated.length === 0 ? [""] : updated);
          setMessages({});
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
        {keyCount > 0 && (
          <div className="inline-flex items-center gap-2 rounded bg-white px-2 py-1 text-xs text-zinc-600 ml-4">
            <KeyRound className="h-3 w-3" />
            {keyCount} {keyCount === 1 ? "key" : "keys"}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {keyInputs.map((key, idx) => (
          <div key={idx} className="space-y-1">
            {/* Show saved key as encrypted bullet */}
            {idx < keyCount && (
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 rounded border border-zinc-200 bg-white text-xs text-zinc-500 flex items-center gap-2">
                  <KeyRound className="h-3 w-3" />
                  •••••••••••••••••••••
                </div>
                <Button
                  size="sm"
                  variant="dangerOutline"
                  disabled={pending}
                  onClick={() => handleDeleteKey(idx)}
                  className="whitespace-nowrap"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </Button>
              </div>
            )}

            {/* Input for new or unsaved key */}
            {idx >= keyCount && (
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Key {idx + 1}
                </label>
                <div className="flex gap-2 items-end">
                  <input
                    type="password"
                    value={key}
                    onChange={(e) => {
                      const updated = [...keyInputs];
                      updated[idx] = e.target.value;
                      setKeyInputs(updated);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && key.length >= 20) handleSaveKey(idx);
                    }}
                    placeholder={`Paste your ${keyType === "groq" ? "Groq" : "Apify"} API key`}
                    className="flex-1 rounded border border-zinc-200 bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button
                    size="sm"
                    disabled={pending || !key || key.length < 20}
                    onClick={() => handleSaveKey(idx)}
                    className="whitespace-nowrap"
                  >
                    <KeyRound className="h-3 w-3" /> Save
                  </Button>
                  <Button
                    size="sm"
                    variant="dangerOutline"
                    disabled={pending}
                    onClick={() => handleDeleteKey(idx)}
                    className="whitespace-nowrap"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                {messages[idx] && (
                  <p className={`mt-1 text-xs ${messages[idx]?.ok ? "text-emerald-600" : "text-red-600"}`}>
                    {messages[idx]?.text}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
