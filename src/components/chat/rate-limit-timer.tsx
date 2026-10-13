"use client";

import { useEffect, useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";

interface RateLimitTimerProps {
  resetAt: string | null;
  keyName?: string;
}

export function RateLimitTimer({ resetAt, keyName = "API" }: RateLimitTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!resetAt) {
      setIsExpired(true);
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const reset = new Date(resetAt).getTime();
      const diff = Math.max(0, reset - now);

      if (diff === 0) {
        setIsExpired(true);
        setSecondsLeft(0);
      } else {
        setIsExpired(false);
        setSecondsLeft(Math.ceil(diff / 1000));
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [resetAt]);

  if (isExpired) {
    return null;
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  const formatTime = () => {
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded text-orange-700 text-sm">
      <Clock size={18} className="flex-shrink-0" />
      <div>
        <div className="font-semibold">Rate Limited</div>
        <div className="text-xs">
          {keyName} - Retry in {formatTime()}
        </div>
      </div>
    </div>
  );
}

/**
 * Alternative compact version for inline use
 */
export function RateLimitTimerCompact({ resetAt }: { resetAt: string | null }) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!resetAt) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const reset = new Date(resetAt).getTime();
      const diff = Math.max(0, reset - now);
      setSecondsLeft(Math.ceil(diff / 1000));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [resetAt]);

  if (!resetAt || secondsLeft === 0) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
      <AlertTriangle size={12} />
      Retry in {secondsLeft}s
    </span>
  );
}
