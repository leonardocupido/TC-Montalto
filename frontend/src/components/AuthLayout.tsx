import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

const BG =
  "https://images.unsplash.com/photo-1751275061929-2f63fc96838c?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200";

export default function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${BG})` }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(11,17,24,0.80) 0%, rgba(11,17,24,0.97) 55%)" }}
      />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-14">
        <div className="flex items-center gap-2.5">
          <span className="animate-ball inline-block size-8 rounded-full bg-[#D9F99D] ring-2 ring-white/70" />
          <span className="font-heading text-sm font-bold uppercase tracking-[0.2em] text-slate-300">Tennis Club</span>
        </div>
        <h1 className="mt-10 font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-white">{title}</h1>
        <p className="mt-3 max-w-xs text-base text-slate-300">{subtitle}</p>
        <div className="mt-8 rounded-2xl border border-border bg-[#131C28]/90 p-5 backdrop-blur-md">{children}</div>
      </div>
      <Toaster richColors />
    </div>
  );
}
