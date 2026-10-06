import { SettingsForm } from "@/components/settings/settings-form";
import { PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { getRepository } from "@/lib/repo";
import { getInstagramService } from "@/lib/services/instagram";
import { getLlmStatus } from "@/lib/services/llm/resolve";
import type { PublicAppSettings } from "@/lib/types";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const raw = await getRepository().getAppSettings(user.id);

  // Strip the ciphertext before anything crosses the server/client boundary.
  const { groq_key_encrypted, ...rest } = raw;
  const settings: PublicAppSettings = { ...rest, groq_key_saved: Boolean(groq_key_encrypted) };

  const ig = await getInstagramService().getStatus();
  return (
    <div className="scroll-thin h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <PageHeader title="Settings" />
      <SettingsForm
        settings={settings}
        llm={getLlmStatus(raw)}
        instagram={ig}
        encryptionConfigured={Boolean(getEnv().APP_ENCRYPTION_KEY)}
        demo={user.demo}
      />
    </div>
  );
}
