"use client";

import { Clock, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface RetryTimerProps {
  retryAt: string | null;
  status: string;
}

export function RetryTimer({ retryAt, status }: RetryTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "RATE_LIMITED" || !retryAt) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const retry = new Date(retryAt);
      const diff = retry.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [retryAt, status]);

  if (!timeLeft || status !== "RATE_LIMITED") {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
      <Clock className="h-3 w-3 animate-spin" />
      Retrying in {timeLeft}
    </div>
  );
}
