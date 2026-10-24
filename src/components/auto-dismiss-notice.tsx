"use client";

import { useEffect, useState, type ReactNode } from "react";

export function AutoDismissNotice({
  children,
  className = "",
  duration = 3000,
}: {
  children: ReactNode;
  className?: string;
  duration?: number;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), duration);
    return () => window.clearTimeout(timer);
  }, [duration]);

  if (!visible) return null;

  return (
    <div role="status" className={className}>
      {children}
    </div>
  );
}
