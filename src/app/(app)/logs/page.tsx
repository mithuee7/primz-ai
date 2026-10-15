import { ScrollText } from "lucide-react";
import { LogRow } from "@/components/logs/log-row";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { listActivity } from "@/lib/services/activity-log";

export const metadata = { title: "Logs" };

export default async function LogsPage() {
  const user = await requireUser();
  const entries = await listActivity(user.id, 200);

  return (
    <div className="scroll-thin h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <AutoRefresh intervalMs={10000} />
      <PageHeader title="Logs" description="What the AI did for each lead, and why something failed or was held back. Newest first." />
      {entries.length === 0 ? (
        <EmptyState icon={<ScrollText className="h-5 w-5" />} title="No activity yet" description="Replies, skips, checker decisions and errors show up here as they happen." />
      ) : (
        <Card className="mx-auto max-w-4xl divide-y divide-zinc-100 overflow-hidden">
          {entries.map((e) => (
            <LogRow key={e.id} entry={e} />
          ))}
        </Card>
      )}
    </div>
  );
}
