"use client";

import type { ReactNode } from "react";

/** Smooth-scrolls to an in-page section without changing the URL (no "#" in the address bar). */
export function ScrollLink({ target, className, children }: { target: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={`#${target}`}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
    >
      {children}
    </a>
  );
}
