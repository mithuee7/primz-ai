"use client";

import { useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface LeadDeletionModalProps {
  isOpen: boolean;
  leadName: string;
  conversationId: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function LeadDeletionModal({
  isOpen,
  leadName,
  conversationId,
  onConfirm,
  onClose,
}: LeadDeletionModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const isConfirmReady = confirmText.toLowerCase() === "delete";

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete lead");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle size={24} />
            <h2 className="text-lg font-bold">Delete Lead</h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 mb-6">
          <p className="text-gray-700">
            You're about to permanently delete <strong>{leadName}</strong> and all associated data.
          </p>

          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            <p className="font-semibold mb-2">This will delete:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>All messages in this conversation</li>
              <li>Conversation thread and memory</li>
              <li>Lead profile data</li>
              <li>AI response history</li>
            </ul>
            <p className="font-semibold mt-2">This action cannot be undone.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type <strong>"delete"</strong> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type 'delete' here..."
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isConfirmReady || loading}
            className={`flex-1 px-4 py-2 rounded font-medium inline-flex items-center justify-center gap-2 ${
              isConfirmReady
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            } disabled:opacity-50`}
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span>
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Delete Lead
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Delete button that opens the modal
 */
interface LeadDeleteButtonProps {
  leadName: string;
  conversationId: string;
  onDelete: () => Promise<void>;
}

export function LeadDeleteButton({
  leadName,
  conversationId,
  onDelete,
}: LeadDeleteButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 border border-red-200"
      >
        <Trash2 size={14} />
        Delete Lead
      </button>

      <LeadDeletionModal
        isOpen={isModalOpen}
        leadName={leadName}
        conversationId={conversationId}
        onConfirm={onDelete}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
