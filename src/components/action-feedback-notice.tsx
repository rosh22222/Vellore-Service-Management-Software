"use client";

import { useEffect, useState } from "react";

type FeedbackDetail = { channel?: string; message?: string };

export function ActionFeedbackNotice({
  channel,
  duration = 3000,
}: {
  channel: string;
  duration?: number;
}) {
  const [message, setMessage] = useState("");

  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<FeedbackDetail>).detail;
      if (detail?.channel === channel && detail.message) setMessage(detail.message);
    };
    window.addEventListener("action-feedback", receive);
    return () => window.removeEventListener("action-feedback", receive);
  }, [channel]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), duration);
    return () => window.clearTimeout(timer);
  }, [duration, message]);

  if (!message) return null;

  return (
    <div
      role="status"
      className="mt-3 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm font-medium text-[#166534]"
    >
      {message}
    </div>
  );
}
