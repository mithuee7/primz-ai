import { LogViewer } from "@/components/logs/log-row";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { listActivity } from "@/lib/services/activity-log";
import { ScrollText } from "lucide-react";

export const metadata = { title: "Logs" };

export default async function LogsPage() {
  const user = await requireUser();
  const entries = await listActivity(user.id, 200);

  return (
    <div className="scroll-thin h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <AutoRefresh intervalMs={10000} />
      <PageHeader title="Logs" description="Every step the AI takes for each lead, with the error code when something fails. Newest first." />
      {entries.length === 0 ? (
        <EmptyState icon={<ScrollText className="h-5 w-5" />} title="No activity yet" description="Inbound messages, drafts, checks, sends and errors show up here as they happen." />
      ) : (
        <LogViewer entries={entries} />
      )}
    </div>
  );
}
