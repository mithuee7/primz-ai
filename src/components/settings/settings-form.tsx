"use client";

import { KeyRound, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  clearGroqKeyAction,
  clearApifyKeyAction,
  checkApifyBalanceAction,
  connectInstagramAction,
  disconnectInstagramAction,
  listModelsAction,
  refreshInstagramTokenAction,
  saveGroqKeyAction,
  saveApifyKeyAction,
  saveSettingsAction,
  saveAiProviderAction,
} from "@/app/actions";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { CONTACT_EMAIL, SETUP_PRICE_INR } from "@/lib/contact";
import type { AiProvider } from "@/lib/services/llm/provider-types";
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

/** Suggested model per provider. Mirrors PROVIDER_DEFAULT_MODEL on the server. */
const DEFAULT_MODEL: Record<AiProvider, string> = {
  groq: "qwen/qwen3-32b",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  gemini: "gemini-2.0-flash",
};

/** Model marked "(recommended)" in the dropdown, per provider. */
const RECOMMENDED_MODEL: Partial<Record<AiProvider, string>> = {
  groq: "qwen/qwen3.8-27b",
};

const PROVIDER_CHOICES: { id: AiProvider; label: string; hint: string }[] = [
  { id: "groq", label: "Groq", hint: "Fast and affordable. Add your Groq keys below, then pick a model." },
  { id: "openai", label: "OpenAI", hint: "Needs an OpenAI API key with billing enabled." },
  { id: "anthropic", label: "Anthropic (Claude)", hint: "Needs an Anthropic API key." },
  { id: "gemini", label: "Google Gemini", hint: "Needs a Gemini API key from Google AI Studio." },
];

function AiProviderSection({ current, groqKeyCount, groqLastFour }: { current: PublicAppSettings; groqKeyCount: number; groqLastFour: string | null }) {
  const router = useRouter();
  const [provider, setProvider] = useState<AiProvider>(current.ai_provider as AiProvider);
  const choice = PROVIDER_CHOICES.find((c) => c.id === provider)!;
  const initialModel = provider === "groq" ? current.groq_model : current.ai_model ?? DEFAULT_MODEL[provider];
  const [model, setModel] = useState(initialModel);
  const [key, setKey] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const savedForThis = provider === "groq" ? groqKeyCount > 0 : current.ai_key_saved && current.ai_provider === provider;

  const loadModels = (typedKey?: string) => {
    setLoadingModels(true);
    setModelsError(null);
    listModelsAction({ provider, key: typedKey ?? "" }).then((res) => {
      setLoadingModels(false);
      if (res.ok) {
        setModels(res.data ?? []);
        if (res.data?.length && !res.data.includes(model)) setModel(res.data[0]!);
      } else {
        setModels([]);
        setModelsError(res.error);
      }
    });
  };

  // Load the dropdown when the provider is chosen, or when a saved key changes.
  useEffect(() => {
    if (savedForThis) loadModels();
    else setModels([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, savedForThis, groqKeyCount]);

  const pick = (id: AiProvider) => {
    setProvider(id);
    setModel(id === "groq" ? current.groq_model : current.ai_model ?? DEFAULT_MODEL[id]);
    setKey("");
    setModels([]);
    setMsg(null);
  };

  const modelOptions = models.includes(model) || !model ? models : [model, ...models];

  return (
    <Section title="AI provider" description="Groq is the default. You can also use your own OpenAI, Claude or Gemini key. Keys are stored encrypted and never shown again.">
      <div className="flex flex-wrap gap-1.5">
        {PROVIDER_CHOICES.map((c) => (
          <button key={c.id} type="button" aria-pressed={provider === c.id} onClick={() => pick(c.id)} className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${provider === c.id ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 hover:bg-zinc-50"}`}>
            {c.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-500">{choice.hint}</p>

      {provider === "groq" ? (
        <KeyManager
          keyType="groq"
          currentKeys={[]}
          lastFour={groqLastFour}
          keyCount={groqKeyCount}
          onSave={saveGroqKeyAction}
          onClear={clearGroqKeyAction}
          label="Groq API Keys"
          description="Supports multiple keys. Each one you add rotates to avoid rate limits. Stored encrypted, never shown again."
        />
      ) : (
        <div>
          <label htmlFor="ai-key" className="label">{choice.label} API key</label>
          <input
            id="ai-key"
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onBlur={() => { if (key.trim().length >= 10) loadModels(key.trim()); }}
            placeholder={current.ai_key_saved && current.ai_provider === provider ? `Saved (ends ${current.ai_key_last4 ?? "····"}). Paste to replace` : "Paste your key"}
            className="field"
          />
        </div>
      )}

      <div>
        <label htmlFor="ai-model" className="label">Model</label>
        <select
          id="ai-model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={loadingModels || modelOptions.length === 0}
          className="field"
        >
          {modelOptions.length === 0 ? <option value={model}>{model || "—"}</option> : null}
          {modelOptions.map((m) => (
            <option key={m} value={m}>{m}{m === RECOMMENDED_MODEL[provider] ? " (recommended)" : ""}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-500">
          {loadingModels ? (
            <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading the models your key can use…</span>
          ) : modelsError ? (
            <span className="text-red-700">{modelsError}</span>
          ) : models.length === 0 ? (
            provider === "groq" ? "Add a Groq key to load the models." : "Paste your key to load the models it can use."
          ) : (
            <button type="button" onClick={() => loadModels()} className="inline-flex items-center gap-1 text-zinc-600 underline-offset-2 hover:underline">
              <RefreshCw className="h-3 w-3" /> Refresh list ({models.length} models)
            </button>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={pending || !model || (provider !== "groq" && key.trim().length < 10)}
          onClick={() =>
            start(async () => {
              const res = await saveAiProviderAction({ provider, key, model });
              setMsg(res.ok ? { ok: true, text: provider === "groq" ? "Saved. Replies use Groq with this model." : `Saved. Replies now use ${choice.label}.` } : { ok: false, text: res.error });
              if (res.ok) {
                setKey("");
                router.refresh();
              }
            })
          }
        >
          {provider === "groq" ? "Use Groq" : `Save ${choice.label}`}
        </Button>
        {msg ? <span role="status" className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span> : null}
      </div>
    </Section>
  );
}

/** The done-for-you offer. The price is shown only after the person asks for it. */
function SetupOffer({ what }: { what: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-4">
      {open ? (
        <>
          <p className="text-sm text-zinc-600">
            We&apos;ll generate and connect {what} for you for <span className="font-semibold text-zinc-900">₹{SETUP_PRICE_INR}</span>.
          </p>
          <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Setup: " + what)}`} className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.97]">
            Request setup
          </a>
        </>
      ) : (
        <>
          <p className="text-sm text-zinc-600">Don&apos;t want to set up {what} yourself?</p>
          <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-900 transition-all hover:bg-zinc-50 active:scale-[0.97]">
            Get it done for you
          </button>
        </>
      )}
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
  const [igToken, setIgToken] = useState("");
  const [igSecret, setIgSecret] = useState("");

  const report = (res: { ok: boolean; error?: string }, okText: string) => {
    setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error ?? "Failed" });
    if (res.ok) router.refresh();
  };

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <AiProviderSection
        current={settings}
        groqKeyCount={llm.keyCount || 0}
        groqLastFour={settings.groq_key_last4}
      />

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
            <SetupOffer what="your Instagram API connection" />
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
                  groq_model: settings.groq_model,
                  checker_model: settings.checker_model,
                  checker_min_confidence: settings.checker_min_confidence,
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
