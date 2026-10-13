"use client";

import { useState } from "react";
import { Zap, MessageSquare, Sparkles } from "lucide-react";

interface AiModeToggleProps {
  conversationId: string;
  isAiMode: boolean;
  onToggle: (newMode: boolean) => Promise<void>;
  disabled?: boolean;
}

export function AiModeToggle({
  conversationId,
  isAiMode,
  onToggle,
  disabled = false,
}: AiModeToggleProps) {
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      await onToggle(!isAiMode);
    } catch (error) {
      console.error("Failed to toggle AI mode:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
        isAiMode
          ? "bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
      }`}
      title={isAiMode ? "Switch to manual mode" : "Switch to AI mode"}
    >
      {isAiMode ? (
        <>
          <Sparkles size={16} />
          Auto Mode
        </>
      ) : (
        <>
          <MessageSquare size={16} />
          Manual Mode
        </>
      )}
    </button>
  );
}

type LeadType = "influencer" | "brand" | "reseller" | "agency" | "unknown";

interface LeadTypeBadgeProps {
  leadType: LeadType;
  confidence?: number;
}

export function LeadTypeBadge({ leadType, confidence }: LeadTypeBadgeProps) {
  const badgeConfig: Record<
    LeadType,
    { bg: string; text: string; icon: string; label: string }
  > = {
    influencer: {
      bg: "bg-blue-100",
      text: "text-blue-700",
      icon: "📸",
      label: "Influencer",
    },
    brand: {
      bg: "bg-purple-100",
      text: "text-purple-700",
      icon: "🏢",
      label: "Brand",
    },
    reseller: {
      bg: "bg-green-100",
      text: "text-green-700",
      icon: "🛒",
      label: "Reseller",
    },
    agency: {
      bg: "bg-amber-100",
      text: "text-amber-700",
      icon: "🤝",
      label: "Agency",
    },
    unknown: {
      bg: "bg-gray-100",
      text: "text-gray-700",
      icon: "❓",
      label: "Unknown",
    },
  };

  const config = badgeConfig[leadType];

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.text}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
      {confidence !== undefined && confidence > 0 && (
        <span className="text-xs opacity-75">
          ({Math.round(confidence * 100)}%)
        </span>
      )}
    </div>
  );
}

interface LeadTypeDetectorProps {
  conversationId: string;
  igUsername: string;
  currentLeadType?: LeadType;
  onDetect: (leadType: LeadType, bio: string, captions: string[]) => Promise<void>;
}

export function LeadTypeDetector({
  conversationId,
  igUsername,
  currentLeadType,
  onDetect,
}: LeadTypeDetectorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDetect = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/lead-type/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          igUsername,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to detect lead type");
      }

      const { leadType, bio, captions } = await response.json();
      await onDetect(leadType, bio, captions);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to detect lead type"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      {error && (
        <div className="text-xs text-red-600 p-2 bg-red-50 rounded">
          {error}
        </div>
      )}

      <button
        onClick={handleDetect}
        disabled={loading}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? (
          <>
            <span className="animate-spin">⏳</span>
            Detecting...
          </>
        ) : (
          <>
            <Sparkles size={16} />
            Detect Lead Type
          </>
        )}
      </button>

      {currentLeadType && (
        <div>
          <div className="text-xs text-gray-600 mb-1">Detected as:</div>
          <LeadTypeBadge leadType={currentLeadType} />
        </div>
      )}
    </div>
  );
}

/**
 * Component to display lead's bio and recent posts
 */
interface LeadProfileProps {
  bio: string;
  postCaptions: string[];
  username: string;
}

export function LeadProfile({ bio, postCaptions, username }: LeadProfileProps) {
  return (
    <div className="space-y-3 p-3 bg-gray-50 rounded border border-gray-200">
      <div>
        <div className="text-xs font-semibold text-gray-600 mb-1">
          {username}'s Bio
        </div>
        <p className="text-sm text-gray-700">{bio || "(No bio)"}</p>
      </div>

      {postCaptions.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-600 mb-2">
            Recent Posts ({postCaptions.length})
          </div>
          <div className="space-y-2">
            {postCaptions.map((caption, idx) => (
              <div
                key={idx}
                className="text-xs text-gray-600 p-2 bg-white rounded border border-gray-100"
              >
                {caption.substring(0, 100)}
                {caption.length > 100 ? "..." : ""}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
