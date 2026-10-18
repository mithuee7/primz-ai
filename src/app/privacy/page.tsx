import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/contact";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-white">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">← Back to Primz AI</Link>
        <h1 className="mt-6 text-4xl font-semibold tracking-[-0.02em] text-zinc-900">Privacy policy</h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated 18 October 2026</p>
        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-zinc-700">
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">What we collect</h2>
            <p className="mt-2">Your email address when you sign in, your Instagram account details and access token, the messages exchanged with your leads through your connected account, and the settings, services and API keys you add. API keys and tokens are stored encrypted.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">How we use it</h2>
            <p className="mt-2">To read incoming Instagram messages, generate and send replies on your behalf, show you the logs and conversations, and run the plan you chose. We do not sell your data or your leads&apos; data.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">AI providers</h2>
            <p className="mt-2">Message text is sent to the AI provider you connect (for example Groq, OpenAI, Anthropic or Google) so it can write a reply. That provider handles the data under its own terms. Choose a provider whose terms you are comfortable with.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">Keeping and deleting data</h2>
            <p className="mt-2">You can delete any lead and its messages from the app. To delete your account and all of your data, email us and we will remove it.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">Your choices</h2>
            <p className="mt-2">You can disconnect Instagram, remove your API keys, or turn off auto-replies at any time from Settings.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">Contact</h2>
            <p className="mt-2">Questions about this policy: <a className="font-medium text-zinc-900 underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
