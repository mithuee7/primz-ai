import { ServicesManager } from "@/components/services/services-manager";
import { PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { getRepository } from "@/lib/repo";

export const metadata = { title: "Services" };

export default async function ServicesPage() {
  const user = await requireUser();
  const services = await getRepository().listServices(user.id);
  return (
    <div className="scroll-thin h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Services"
        description="The only things the AI is allowed to pitch. Seeded from primz-ai.onrender.com, so review and edit them."
      />
      <ServicesManager services={services} />
    </div>
  );
}
