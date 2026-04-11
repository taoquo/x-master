import React from "react"
import { ArrowUpRight, GithubLogo, RocketLaunch } from "@phosphor-icons/react"
import { siteConfig } from "../config/site.ts"
import { landingCopy } from "../content/landingCopy.ts"
import { CommandDeckPreview } from "./CommandDeckPreview.tsx"

function HeroBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-slate-300">
      {label}
    </span>
  )
}

function CtaLink({
  href,
  children,
  variant = "primary"
}: {
  href: string
  children: React.ReactNode
  variant?: "primary" | "secondary"
}) {
  const className =
    variant === "primary"
      ? "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/14 px-5 text-sm font-medium text-cyan-50 transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:bg-cyan-300/18 active:translate-y-px active:scale-[0.985]"
      : "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/4 px-5 text-sm font-medium text-slate-100 transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:bg-white/8 active:translate-y-px active:scale-[0.985]"

  return (
    <a href={href} className={className}>
      {children}
    </a>
  )
}

export function Hero() {
  return (
    <section
      data-testid="hero-section"
      className="relative overflow-hidden px-4 pb-14 pt-5 sm:px-6 md:px-8 md:pb-20 lg:px-10"
    >
      <div className="mx-auto max-w-[1400px]">
        <header className="flex items-center justify-between gap-4 rounded-full border border-white/8 bg-white/[0.03] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/16 bg-cyan-300/12 text-sm font-semibold tracking-[-0.04em] text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
              XM
            </div>
            <div>
              <div className="text-sm font-medium tracking-[-0.03em] text-slate-100">X Bookmark Manager</div>
              <div className="text-xs text-slate-400">Command deck for your X archive</div>
            </div>
          </div>
          <a
            href={siteConfig.repoUrl}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-200 transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:bg-white/[0.06]"
          >
            <GithubLogo size={15} weight="fill" />
            <span>Open-source</span>
          </a>
        </header>

        <div className="grid min-h-[calc(100dvh-7rem)] items-center gap-10 py-10 md:grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:gap-12 lg:py-16">
          <div className="reveal-up max-w-[42rem]">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/14 bg-cyan-300/10 px-4 py-2 text-[0.72rem] font-medium uppercase tracking-[0.2em] text-cyan-100">
              <RocketLaunch size={14} weight="fill" />
              <span>{landingCopy.hero.eyebrow}</span>
            </div>

            <h1 className="max-w-[12ch] text-5xl font-semibold leading-[0.9] tracking-[-0.08em] text-slate-50 sm:text-6xl lg:text-[5.35rem]">
              {landingCopy.hero.title}
            </h1>

            <p className="mt-6 max-w-[34rem] text-base leading-8 text-slate-300 sm:text-lg">
              {landingCopy.hero.description}
            </p>
            <p className="mt-4 text-sm font-medium uppercase tracking-[0.18em] text-cyan-200">
              {landingCopy.hero.supporting}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {landingCopy.hero.badges.map((badge) => (
                <HeroBadge key={badge} label={badge} />
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <CtaLink href={siteConfig.releaseUrl}>
                <span>{siteConfig.primaryCtaLabel}</span>
                <ArrowUpRight size={16} />
              </CtaLink>
              <CtaLink href={siteConfig.repoUrl} variant="secondary">
                <span>{siteConfig.secondaryCtaLabel}</span>
                <GithubLogo size={16} weight="fill" />
              </CtaLink>
            </div>
          </div>

          <div className="reveal-up lg:justify-self-end">
            <CommandDeckPreview />
          </div>
        </div>
      </div>
    </section>
  )
}
