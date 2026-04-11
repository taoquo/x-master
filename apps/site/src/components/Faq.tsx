import React from "react"
import { landingCopy } from "../content/landingCopy.ts"

export function Faq() {
  return (
    <section data-testid="faq-section" className="px-4 py-8 pb-14 sm:px-6 md:px-8 lg:px-10 lg:pb-20">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-8 max-w-[30rem]">
          <div className="text-[0.72rem] uppercase tracking-[0.2em] text-cyan-200">FAQ</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-slate-50 sm:text-4xl">
            Questions the page answers before the install click.
          </h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-4">
            {landingCopy.faq.map((item) => (
              <details
                key={item.question}
                className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                open
              >
                <summary className="cursor-pointer list-none text-lg font-medium tracking-[-0.03em] text-slate-50">
                  {item.question}
                </summary>
                <p className="mt-3 text-sm leading-7 text-slate-300">{item.answer}</p>
              </details>
            ))}
          </div>

          <div className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6">
            <div className="text-[0.72rem] uppercase tracking-[0.2em] text-slate-400">Why this page exists</div>
            <p className="mt-4 text-2xl font-medium leading-tight tracking-[-0.05em] text-slate-50">
              {landingCopy.footer}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
