"use client";

import { CheckCircle2, KeyRound, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  clearGroqKeyAction,
  clearApifyKeyAction,
  checkApifyBalanceAction,
  connectInstagramAction,
  disconnectInstagramAction,
  refreshInstagramTokenAction,
  saveGroqKeyAction,
  saveApifyKeyAction,
  saveSettingsAction,
  deleteLeadAction,
} from "@/app/actions";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { CONTACT_EMAIL, SETUP_PRICE_INR } from "@/lib/contact";
import { saveAiProviderAction } from "@/app/actions";
import { TONES, TONE_LABELS, type PublicAppSettings, type Tone } from "@/lib/types";
import { KeyManager } from "./key-manager";

export interface SettingsViewProps {
  settings: PublicAppSettings;
  llm: { provider: string; source: string; keyCount?: number };
  apify: { keyCount?: number };
  instagram: { kind: "mock" | "meta"; connected: boolean; label: string; detail: string };
  callbackUrl: string;
  daysLeft: number | null;
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

const PROVIDER_CHOICES: { id: "groq" | "openai" | "anthropic" | "gemini"; label: string; defaultModel: string; hint: string }[] = [
  { id: "groq", label: "Groq", defaultModel: "qwen/qwen3-32b", hint: "Uses your Groq keys above." },
  { id: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini", hint: "Needs an OpenAI API key with billing enabled." },
  { id: "anthropic", label: "Anthropic (Claude)", defaultModel: "claude-3-5-haiku-latest", hint: "Needs an Anthropic API key." },
  { id: "gemini", label: "Google Gemini", defaultModel: "gemini-2.0-flash", hint: "Needs a Gemini API key from Google AI Studio." },
];

function AiProviderSection({ current }: { current: PublicAppSettings }) {
  const router = useRouter();
  const [provider, setProvider] = useState<"groq" | "openai" | "anthropic" | "gemini">(current.ai_provider);
  const choice = PROVIDER_CHOICES.find((c) => c.id === provider)!;
  const [model, setModel] = useState(current.ai_model ?? choice.defaultModel);
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const pick = (id: "groq" | "openai" | "anthropic" | "gemini") => {
    setProvider(id);
    setModel(PROVIDER_CHOICES.find((c) => c.id === id)!.defaultModel);
    setMsg(null);
  };

  return (
    <Section title="AI provider" description="Groq is the default. You can also use your own OpenAI, Claude or Gemini key. Your key is stored encrypted and never shown again.">
      <div className="flex flex-wrap gap-1.5">
        {PROVIDER_CHOICES.map((c) => (
          <button key={c.id} type="button" aria-pressed={provider === c.id} onClick={() => pick(c.id)} className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${provider === c.id ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 hover:bg-zinc-50"}`}>
            {c.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-500">{choice.hint}</p>
      {provider !== "groq" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ai-key" className="label">{choice.label} API key</label>
            <input id="ai-key" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={current.ai_key_saved && current.ai_provider === provider ? `Saved (ends ${current.ai_key_last4 ?? "····"}). Paste to replace` : "Paste your key"} className="field" />
          </div>
          <div>
            <label htmlFor="ai-model" className="label">Model</label>
            <input id="ai-model" value={model} onChange={(e) => setModel(e.target.value)} className="field" />
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={pending || (provider !== "groq" && (key.trim().length < 10 || model.trim().length < 2))}
          onClick={() =>
            start(async () => {
              const res = await saveAiProviderAction({ provider, key, model });
              setMsg(res.ok ? { ok: true, text: provider === "groq" ? "Using Groq." : `Saved. Replies now use ${choice.label}.` } : { ok: false, text: res.error });
              if (res.ok) {
                setKey("");
                router.refresh();
              }
            })
          }
        >
          {provider === "groq" ? "Use Groq" : `Save ${choice.label}`}
        </Button>
        {msg ? <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span> : null}
      </div>
    </Section>
  );
}

function SetupOffer({ what }: { what: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-4">
      <p className="text-sm text-zinc-600">
        Don&apos;t want to set up {what} yourself? We&apos;ll generate and connect it for you for <span className="font-semibold text-zinc-900">₹{SETUP_PRICE_INR}</span>.
      </p>
      <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Setup: " + what)}`} className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.97]">
        Request setup
      </a>
    </div>
  );
}

export function SettingsForm({ settings, llm, apify, instagram, callbackUrl, daysLeft, demo }: SettingsViewProps) {
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
  const [igToken, setIgToken] = useState("");
  const [igSecret, setIgSecret] = useState("");

  const report = (res: { ok: boolean; error?: string }, okText: string) => {
    setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error ?? "Failed" });
    if (res.ok) router.refresh();
  };

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <Section title="Groq" description="Used for both the conversation AI and the output checker. Supports multiple API keys to distribute load and avoid rate limits.">
        <KeyManager
          keyType="groq"
          currentKeys={[]}
          lastFour={settings.groq_key_last4}
          keyCount={llm.keyCount || 0}
          onSave={saveGroqKeyAction}
          onClear={clearGroqKeyAction}
          label="Groq API Keys"
          description="Supports multiple keys - each one you add will rotate to avoid rate limits. Stored encrypted, never shown again."
        />
        <div className="grid gap-4 sm:grid-cols-2 mt-4">
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
        <SetupOffer what="your Groq key" />
      </Section>

      <AiProviderSection current={settings} />

      <Section title="Apify" description="Used for auto-detecting lead type from Instagram bio and recent posts.">
        <KeyManager
          keyType="apify"
          currentKeys={[]}
          lastFour={settings.apify_key_last4}
          keyCount={apify.keyCount || 0}
          onSave={saveApifyKeyAction}
          onClear={clearApifyKeyAction}
          onCheckBalance={checkApifyBalanceAction}
          label="Apify API Keys"
          description="Fetch Instagram profile info (bio, posts) for automatic lead type detection. Supports multiple keys."
        />
        <SetupOffer what="your Apify key" />
      </Section>

      <Section title="Instagram connection" description="Paste your Instagram access token and app secret. They are stored encrypted and never shown again.">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={instagram.connected ? "green" : "amber"}>{instagram.label}</Badge>
          <span className="text-sm text-zinc-500">{instagram.detail}</span>
        </div>
        {instagram.kind === "mock" ? (
          <p className="text-sm text-zinc-500">Demo mode uses a simulated Instagram. Nothing is sent to real accounts.</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ig-token" className="label">Access token</label>
                <input id="ig-token" type="password" autoComplete="off" value={igToken} onChange={(e) => setIgToken(e.target.value)} placeholder={settings.meta_token_saved ? "Saved. Paste a new one to replace it" : "IG…"} className="field" />
              </div>
              <div>
                <label htmlFor="ig-secret" className="label">Instagram app secret</label>
                <input id="ig-secret" type="password" autoComplete="off" value={igSecret} onChange={(e) => setIgSecret(e.target.value)} placeholder={settings.meta_app_secret_saved ? "Saved. Paste a new one to replace it" : "App secret"} className="field" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={pending || igToken.trim().length < 20 || igSecret.trim().length < 16} onClick={() => start(async () => {
                const r = await connectInstagramAction({ access_token: igToken, app_secret: igSecret });
                if (r.ok) { setIgToken(""); setIgSecret(""); }
                report(r.ok ? { ok: true } : r, r.ok ? `Connected${r.data?.username ? ` as @${r.data.username}` : ""}.${r.data?.warnings.length ? " " + r.data.warnings.join(" ") : ""}` : "");
              })}>
                <KeyRound className="h-4 w-4" /> Connect &amp; verify
              </Button>
              {settings.meta_token_saved ? (
                <>
                  <Button variant="secondary" disabled={pending} onClick={() => start(async () => report(await refreshInstagramTokenAction(), "Token refreshed. It is valid for another ~60 days."))}>
                    <RefreshCw className="h-4 w-4" /> Refresh token now
                  </Button>
                  <Button variant="dangerOutline" disabled={pending} onClick={() => { if (window.confirm("Disconnect Instagram? Auto replies will stop.")) start(async () => report(await disconnectInstagramAction(), "Disconnected.")); }}>
                    Disconnect
                  </Button>
                </>
              ) : null}
            </div>
            {settings.meta_token_saved && daysLeft !== null ? (
              <p className="text-xs text-zinc-500">
                Token expires in {Math.max(daysLeft, 0)} days{settings.meta_ig_username ? ` (@${settings.meta_ig_username})` : ""}. It is refreshed automatically when it gets close, as long as the app is being used.
              </p>
            ) : null}
            <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600">
              <p className="font-medium text-zinc-800">Webhook settings to paste into Meta (Instagram → Webhooks)</p>
              <p className="mt-2">Callback URL</p>
              <code className="block break-all rounded bg-white px-2 py-1">{callbackUrl}</code>
              <p className="mt-2">Verify token</p>
              <code className="block break-all rounded bg-white px-2 py-1">{settings.meta_verify_token ?? "Appears after you connect"}</code>
              <p className="mt-2">Subscribe to the <b>messages</b> field.</p>
            </div>
          </>
        )}
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

      <div className="sticky bottom-0 bg-white border-t border-zinc-200 p-4 -mx-4 flex items-center gap-3">
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
          className="flex-1"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save settings
        </Button>
        {demo ? <span className="text-xs text-zinc-500">Demo mode: settings reset on restart</span> : null}
      </div>
    </div>
  );
}
