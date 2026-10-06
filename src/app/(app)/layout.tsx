import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { getRepository } from "@/lib/repo";
import { getInstagramService } from "@/lib/services/instagram";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [conversations, instagram] = await Promise.all([
    getRepository().listConversations(user.id),
    getInstagramService().getStatus(),
  ]);
  const reviewCount = conversations.filter((c) => c.state.needs_review).length;

  return (
    <AppShell
      user={{ name: user.name, email: user.email, demo: user.demo }}
      instagram={{ connected: instagram.connected, label: instagram.label, detail: instagram.detail }}
      reviewCount={reviewCount}
    >
      {children}
    </AppShell>
  );
}
