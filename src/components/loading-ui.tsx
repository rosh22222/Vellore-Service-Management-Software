"use client";

import Image from "next/image";

type LoadingUiProps = {
  variant?: "page" | "panel";
  title?: string;
  subtitle?: string;
};

export function LoadingUi({
  variant = "page",
  title = "Loading",
  subtitle = "Preparing your Vellore Fitness workspace",
}: LoadingUiProps) {
  return (
    <section
      className={`grid w-full place-items-center overflow-hidden bg-white/75 backdrop-blur-[3px] ${
        variant === "page"
          ? "fixed inset-0 z-[100] min-h-screen"
          : "min-h-[calc(100vh-9rem)]"
      }`}
      role="status"
      aria-live="polite"
      aria-label="Loading, please wait"
    >
      <div className="flex flex-col items-center gap-5" aria-hidden="true">
        <div className="relative flex h-[164px] w-[164px] items-center justify-center">
          <div className="vfe-loader-glow absolute -inset-8 rounded-full bg-[radial-gradient(circle,rgba(239,68,68,0.11)_0%,rgba(15,23,42,0.04)_42%,transparent_70%)] blur-xl" />
          <div className="absolute inset-0 rounded-full border border-slate-300/80 bg-white/35 shadow-[0_20px_55px_rgba(15,23,42,0.12)]" />
          <div className="vfe-loader-orbit absolute inset-0 rounded-full border-[3px] border-transparent border-r-slate-700 border-t-red-500">
            <span className="absolute -top-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.75)]" />
          </div>
          <div className="vfe-loader-orbit-reverse absolute inset-[10px] rounded-full border-2 border-transparent border-b-slate-300 border-l-slate-600" />
          <div className="absolute inset-[25px] rounded-full border border-white bg-white shadow-[inset_0_0_24px_rgba(15,23,42,0.06),0_10px_30px_rgba(15,23,42,0.16)]" />
          <Image
            className="vfe-loader-logo relative z-[1] h-[76px] w-[76px] object-contain drop-shadow-[0_8px_14px_rgba(15,23,42,0.24)]"
            src="/logo-VFE.png"
            alt=""
            width={96}
            height={96}
            priority
            unoptimized
          />
        </div>
        <div className="vfe-loader-dots flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
        </div>
      </div>
      <span className="sr-only">
        {title}. {subtitle}
      </span>
    </section>
  );
}
