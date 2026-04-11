import React from "react"
import { FolderOpen, FunnelSimple, Lightning, LockKey } from "@phosphor-icons/react"
import { landingCopy } from "../content/landingCopy.ts"

const icons = [Lightning, FunnelSimple, FolderOpen, LockKey]

export function FeatureRail() {
  return (
    <section data-testid="features-section" className="px-4 py-8 sm:px-6 md:px-8 lg:px-10">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-8 max-w-[34rem]">
          <div className="text-[0.72rem] uppercase tracking-[0.2em] text-cyan-200">Core features</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-slate-50 sm:text-4xl">
            Built like a control surface, not a generic bookmarks page.
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-[1fr_1fr]">
            {landingCopy.features.slice(0, 2).map((feature, index) => {
              const Icon = icons[index]
              return (
                <article
                  key={feature.title}
                  className="rounded-[1.8rem] border border-white/8 bg-white/[0.035] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                >
                  <div className="inline-flex rounded-2xl border border-cyan-300/16 bg-cyan-300/10 p-3 text-cyan-100">
                    <Icon size={22} weight="duotone" />
                  </div>
                  <div className="mt-6 text-[0.68rem] uppercase tracking-[0.18em] text-slate-400">{feature.accent}</div>
                  <h3 className="mt-3 text-2xl font-medium tracking-[-0.05em] text-slate-50">{feature.title}</h3>
                  <p className="mt-4 max-w-[28rem] text-sm leading-7 text-slate-300">{feature.body}</p>
                </article>
              )
            })}
          </div>

          <div className="grid gap-4">
            {landingCopy.features.slice(2).map((feature, index) => {
              const Icon = icons[index + 2]
              return (
                <article
                  key={feature.title}
                  className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6"
                >
                  <div className="inline-flex rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-slate-100">
                    <Icon size={22} weight="duotone" />
                  </div>
                  <div className="mt-5 text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">{feature.accent}</div>
                  <h3 className="mt-2 text-xl font-medium tracking-[-0.04em] text-slate-50">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{feature.body}</p>
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
