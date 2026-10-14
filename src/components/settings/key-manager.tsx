"use client";

import { Trash2 } from "lucide-react";
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
    <div className="space-y-3">
      {keyInputs.map((key, idx) => (
        <div key={idx} className="space-y-1.5">
          {/* Show saved key as encrypted bullet */}
          {idx < keyCount && (
            <div className="flex gap-2 items-center">
              <code className="flex-1 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600 font-mono">
                •••••••••••••••••••••
              </code>
              <Button
                size="sm"
                variant="dangerOutline"
                disabled={pending}
                onClick={() => handleDeleteKey(idx)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Input for new or unsaved key */}
          {idx >= keyCount && (
            <div>
              <div className="flex gap-2 items-center">
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
                  className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button
                  size="sm"
                  disabled={pending || !key || key.length < 20}
                  onClick={() => handleSaveKey(idx)}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="dangerOutline"
                  disabled={pending}
                  onClick={() => handleDeleteKey(idx)}
                >
                  <Trash2 className="h-4 w-4" />
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
  );
}
