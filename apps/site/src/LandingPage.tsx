import React from "react"
import { Faq } from "./components/Faq.tsx"
import { FeatureRail } from "./components/FeatureRail.tsx"
import { Hero } from "./components/Hero.tsx"
import { InstallPanel } from "./components/InstallPanel.tsx"
import { WorkflowStrip } from "./components/WorkflowStrip.tsx"
import { landingCopy } from "./content/landingCopy.ts"

const motionStyles = `
  @keyframes float-card {
    0%, 100% { transform: translate3d(0, 0, 0); }
    50% { transform: translate3d(0, -6px, 0); }
  }

  @keyframes soft-pulse {
    0%, 100% { transform: scale(0.92); opacity: 0.45; }
    50% { transform: scale(1); opacity: 1; }
  }

  @keyframes shimmer-track {
    0% { background-position: 0% 50%; }
    100% { background-position: 200% 50%; }
  }

  .reveal-up {
    animation: reveal-up 720ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes reveal-up {
    0% { opacity: 0; transform: translate3d(0, 18px, 0); }
    100% { opacity: 1; transform: translate3d(0, 0, 0); }
  }

  .float-card {
    animation: float-card 7s ease-in-out infinite;
  }

  .shimmer-track {
    background-size: 200% 100%;
    animation: shimmer-track 7s linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation: none !important;
      transition: none !important;
      scroll-behavior: auto !important;
    }
  }
`

function TrustStrip() {
  return (
    <section data-testid="trust-strip" className="px-4 py-4 sm:px-6 md:px-8 lg:px-10">
      <div className="mx-auto max-w-[1400px] rounded-[1.6rem] border border-white/8 bg-white/[0.025] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="flex flex-wrap items-center gap-3 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-slate-400">
          {landingCopy.trust.map((item) => (
            <span key={item} className="inline-flex items-center gap-3">
              <span>{item}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/70" />
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

export function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-[#020617] text-slate-100">
      <style>{motionStyles}</style>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-[-8rem] h-[22rem] w-[22rem] rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="absolute bottom-[-10rem] right-[-8rem] h-[24rem] w-[24rem] rounded-full bg-sky-400/10 blur-3xl" />
      </div>
      <div className="relative">
        <Hero />
        <TrustStrip />
        <FeatureRail />
        <WorkflowStrip />
        <InstallPanel />
        <Faq />
      </div>
    </div>
  )
}
