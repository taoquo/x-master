import React from "react"
import { landingCopy } from "../content/landingCopy.ts"

export function WorkflowStrip() {
  return (
    <section data-testid="workflow-section" className="px-4 py-8 sm:px-6 md:px-8 lg:px-10">
      <div className="mx-auto max-w-[1400px] rounded-[2rem] border border-white/8 bg-white/[0.03] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] md:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
          <div>
            <div className="text-[0.72rem] uppercase tracking-[0.2em] text-cyan-200">Workflow</div>
            <h2 className="mt-3 max-w-[12ch] text-3xl font-semibold tracking-[-0.06em] text-slate-50 sm:text-4xl">
              Install once. Keep the archive in motion.
            </h2>
            <p className="mt-4 max-w-[30rem] text-sm leading-7 text-slate-300">
              The page tells a clean sequence: install, pull from X, then let rules add structure without manual sorting.
            </p>
          </div>

          <div className="grid gap-4">
            {landingCopy.workflow.map((item) => (
              <article
                key={item.step}
                className="rounded-[1.5rem] border border-white/8 bg-slate-950/45 px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              >
                <div className="flex items-start gap-4">
                  <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/16 bg-cyan-300/10 font-mono text-sm text-cyan-100">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="text-xl font-medium tracking-[-0.04em] text-slate-50">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-300">{item.body}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
