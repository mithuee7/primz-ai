"use client";

import { CheckCircle2, KeyRound, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clearGroqKeyAction, saveGroqKeyAction, saveSettingsAction } from "@/app/actions";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { TONES, TONE_LABELS, type PublicAppSettings, type Tone } from "@/lib/types";

export interface SettingsViewProps {
  settings: PublicAppSettings;
  llm: { provider: "groq" | "demo" | "none"; source: "settings" | "env" | "none" };
  instagram: { kind: "mock" | "meta"; connected: boolean; label: string; detail: string };
  encryptionConfigured: boolean;
  demo: boolean;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {description ? <p className="mt-0.5 text-sm text-zinc-500">{description}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </Card>
  );
}

export function SettingsForm({ settings, llm, instagram, encryptionConfigured, demo }: SettingsViewProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [tone, setTone] = useState<Tone>(settings.default_tone);
  const [customTone, setCustomTone] = useState(settings.default_custom_tone ?? "");
  const [behavior, setBehavior] = useState(settings.default_ai_behavior);
  const [global, setGlobal] = useState(settings.global_instructions);
  const [model, setModel] = useState(settings.groq_model);
  const [checkerModel, setCheckerModel] = useState(settings.checker_model);
  const [minConf, setMinConf] = useState(settings.checker_min_confidence);
  const [key, setKey] = useState("");

  const report = (res: { ok: boolean; error?: string }, okText: string) => {
    setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error ?? "Failed" });
    if (res.ok) router.refresh();
  };

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <Section title="Groq" description="Used for both the conversation AI and the output checker.">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-500">Status:</span>
          {llm.provider === "groq" ? (
            <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Key set ({llm.source === "settings" ? `saved in app${settings.groq_key_last4 ? `, ends ${settings.groq_key_last4}` : ""}` : "server env"})</Badge>
          ) : llm.provider === "demo" ? (
            <Badge tone="amber">No key. Using the scripted demo AI (not a real model)</Badge>
          ) : (
            <Badge tone="red">Not configured. Auto replies will be held for review</Badge>
          )}
        </div>
        <div>
          <label htmlFor="groq-key" className="label">API key</label>
          <div className="flex gap-2">
            <input id="groq-key" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={settings.groq_key_saved ? "Saved. Paste a new key to replace it" : "gsk_…"} className="field" />
            <Button disabled={pending || key.trim().length < 20 || !encryptionConfigured} onClick={() => start(async () => { const r = await saveGroqKeyAction(key); if (r.ok) setKey(""); report(r, "Key saved (encrypted). It is never shown again."); })}>
              <KeyRound className="h-4 w-4" /> Save
            </Button>
            {settings.groq_key_saved ? (
              <Button variant="dangerOutline" size="icon" aria-label="Remove saved key" disabled={pending} onClick={() => start(async () => report(await clearGroqKeyAction(), "Saved key removed."))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">
            {encryptionConfigured
              ? "Stored encrypted (AES-256-GCM) on the server. Never sent back to the browser."
              : "Set APP_ENCRYPTION_KEY on the server to save a key here, or set GROQ_API_KEY as an environment variable."}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="model" className="label">Conversation model</label>
            <input id="model" value={model} onChange={(e) => setModel(e.target.value)} className="field" />
          </div>
          <div>
            <label htmlFor="cmodel" className="label">Checker model</label>
            <input id="cmodel" value={checkerModel} onChange={(e) => setCheckerModel(e.target.value)} className="field" />
          </div>
        </div>
        <div>
          <label htmlFor="conf" className="label">Checker minimum confidence: {minConf.toFixed(2)}</label>
          <input id="conf" type="range" min={0.5} max={1} step={0.01} value={minConf} onChange={(e) => setMinConf(Number(e.target.value))} className="w-full accent-zinc-900" />
          <p className="mt-1 text-xs text-zinc-500">Approvals below this confidence are treated as rejections. Higher is safer.</p>
        </div>
      </Section>

      <Section title="Instagram connection">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={instagram.connected ? "green" : "amber"}>{instagram.label}</Badge>
          <span className="text-sm text-zinc-500">{instagram.detail}</span>
        </div>
        {instagram.kind === "mock" ? (
          <p className="text-sm text-zinc-500">Demo mode uses a simulated Instagram. Real connection steps are in the README under “Connecting Instagram”.</p>
        ) : null}
      </Section>

      <Section title="Defaults for new conversations">
        <div>
          <p className="label">Default tone</p>
          <div className="flex flex-wrap gap-1.5">
            {TONES.map((t) => (
              <button key={t} type="button" aria-pressed={tone === t} onClick={() => setTone(t)} className={`rounded-full border px-3 py-1.5 text-sm ${tone === t ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 hover:bg-zinc-50"}`}>
                {TONE_LABELS[t]}
              </button>
            ))}
          </div>
          {tone === "custom" ? <textarea value={customTone} onChange={(e) => setCustomTone(e.target.value)} rows={2} maxLength={500} aria-label="Custom tone" className="field mt-2 resize-none" /> : null}
        </div>
        <div>
          <label htmlFor="behavior" className="label">Default AI behavior</label>
          <textarea id="behavior" value={behavior} onChange={(e) => setBehavior(e.target.value)} rows={4} maxLength={3000} className="field resize-none" />
        </div>
        <div>
          <label htmlFor="global" className="label">Global business instructions</label>
          <textarea id="global" value={global} onChange={(e) => setGlobal(e.target.value)} rows={4} maxLength={4000} className="field resize-none" />
          <p className="mt-1 text-xs text-zinc-500">Applied to every conversation. Per-lead instructions are added on top.</p>
        </div>
      </Section>

      {msg ? <p role="status" className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p> : null}
      <div>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () =>
              report(
                await saveSettingsAction({
                  default_tone: tone,
                  default_custom_tone: tone === "custom" ? customTone.trim() || null : null,
                  default_ai_behavior: behavior,
                  global_instructions: global,
                  groq_model: model,
                  checker_model: checkerModel,
                  checker_min_confidence: minConf,
                }),
                "Settings saved.",
              ),
            )
          }
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save settings
        </Button>
        {demo ? <span className="ml-3 text-xs text-zinc-500">Demo mode: settings reset when the server restarts.</span> : null}
      </div>
    </div>
  );
}
