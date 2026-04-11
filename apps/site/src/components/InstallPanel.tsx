import React from "react"
import { ArrowUpRight, CheckCircle, GithubLogo } from "@phosphor-icons/react"
import { siteConfig } from "../config/site.ts"
import { landingCopy } from "../content/landingCopy.ts"

export function InstallPanel() {
  return (
    <section data-testid="install-section" className="px-4 py-8 sm:px-6 md:px-8 lg:px-10">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(8,15,31,0.95),rgba(5,14,26,0.98))] p-6 shadow-[0_24px_60px_-28px_rgba(6,12,23,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] md:p-8">
            <div className="text-[0.72rem] uppercase tracking-[0.2em] text-cyan-200">Install</div>
            <h2 className="mt-3 max-w-[14ch] text-3xl font-semibold tracking-[-0.06em] text-slate-50 sm:text-4xl">
              {landingCopy.install.title}
            </h2>
            <p className="mt-5 max-w-[34rem] text-sm leading-7 text-slate-300">{landingCopy.install.description}</p>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={siteConfig.releaseUrl}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/14 px-5 text-sm font-medium text-cyan-50 transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:bg-cyan-300/18 active:translate-y-px active:scale-[0.985]"
              >
                <span>{siteConfig.primaryCtaLabel}</span>
                <ArrowUpRight size={16} />
              </a>
              <a
                href={siteConfig.repoUrl}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/4 px-5 text-sm font-medium text-slate-100 transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:bg-white/8 active:translate-y-px active:scale-[0.985]"
              >
                <span>{siteConfig.secondaryCtaLabel}</span>
                <GithubLogo size={16} weight="fill" />
              </a>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/8 bg-white/[0.03] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] md:p-8">
            <div className="text-[0.72rem] uppercase tracking-[0.2em] text-slate-400">Release path</div>
            <div className="mt-5 grid gap-4">
              {landingCopy.install.checklist.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-[1.2rem] border border-white/8 bg-slate-950/50 px-4 py-4"
                >
                  <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-cyan-300" />
                  <span className="text-sm leading-7 text-slate-200">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
