"use client";

import { Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/primitives";

interface DeleteLeadButtonProps {
  conversationId: string;
  leadName: string;
  onDelete: (conversationId: string) => Promise<{ ok: boolean; error?: string }>;
}

export function DeleteLeadButton({ conversationId, leadName, onDelete }: DeleteLeadButtonProps) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const handleDelete = () => {
    if (!confirm(`Delete ${leadName} and all messages? This cannot be undone.`)) {
      return;
    }

    start(async () => {
      const res = await onDelete(conversationId);
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        alert(res.error || "Failed to delete");
      }
    });
  };

  return (
    <Button
      variant="dangerOutline"
      size="sm"
      disabled={pending}
      onClick={handleDelete}
      title="Delete this lead and all their messages"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
      Delete lead
    </Button>
  );
}
