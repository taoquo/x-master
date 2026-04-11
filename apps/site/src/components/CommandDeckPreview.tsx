import React from "react"

const syncStats = [
  { label: "Bookmarks pulled", value: "1,248" },
  { label: "Tagged by rules", value: "84%" }
]

const syncTimeline = [
  { label: "Inventory refreshed", value: "912 new saves" },
  { label: "Rule batch complete", value: "146 bookmarks filed" },
  { label: "Workspace index", value: "9 authors surfaced" }
]

const ruleMatches = [
  { rule: "@pmarchive + longform", tag: "Insight" },
  { rule: "agent + eval + benchmark", tag: "Research" },
  { rule: "launch thread + product", tag: "Watchlist" }
]

export function CommandDeckPreview() {
  return (
    <div className="command-shell float-card relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/80 p-3 shadow-[0_32px_80px_-28px_rgba(8,15,31,0.9),inset_0_1px_0_rgba(255,255,255,0.12)]">
      <div className="grid gap-3 rounded-[1.6rem] border border-white/6 bg-[linear-gradient(180deg,rgba(12,18,32,0.96),rgba(2,6,23,0.98))] p-4 md:p-5">
        <div className="flex items-center justify-between rounded-[1.2rem] border border-white/8 bg-white/[0.03] px-4 py-3">
          <div>
            <div className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-400">Latest sync run</div>
            <div className="mt-1 text-lg font-medium tracking-[-0.04em] text-slate-50">Pull from X into local inventory</div>
          </div>
          <div className="inline-flex items-center rounded-full border border-cyan-300/18 bg-cyan-300/12 px-3 py-1 text-[0.7rem] uppercase tracking-[0.16em] text-cyan-100">
            Running clean
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <div className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">Sync command deck</div>
              <div className="h-2 w-2 animate-[soft-pulse_2.8s_ease-in-out_infinite] rounded-full bg-cyan-300" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {syncStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-[1.1rem] border border-white/8 bg-slate-950/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                >
                  <div className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-500">{stat.label}</div>
                  <div className="mt-3 font-mono text-4xl tracking-[-0.08em] text-slate-50">{stat.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[1.1rem] border border-white/8 bg-slate-950/50 p-4">
              <div className="text-[0.68rem] uppercase tracking-[0.16em] text-slate-400">Recent batch</div>
              <div className="mt-4 grid gap-3">
                {syncTimeline.map((entry, index) => (
                  <div key={entry.label} className="grid gap-2">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-slate-300">{entry.label}</span>
                      <span className="text-slate-500">{entry.value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/6">
                      <div
                        className="shimmer-track h-full rounded-full bg-[linear-gradient(90deg,rgba(45,212,191,0.2),rgba(103,232,249,0.95),rgba(45,212,191,0.2))]"
                        style={{ width: `${72 + index * 8}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4">
              <div className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">Rule matches</div>
              <div className="mt-4 grid gap-3">
                {ruleMatches.map((item) => (
                  <div
                    key={item.rule}
                    className="rounded-[1.05rem] border border-white/8 bg-slate-950/55 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  >
                    <div className="text-sm font-medium text-slate-100">{item.rule}</div>
                    <div className="mt-2 inline-flex rounded-full border border-cyan-300/18 bg-cyan-300/10 px-2 py-1 text-[0.66rem] uppercase tracking-[0.16em] text-cyan-100">
                      {item.tag}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,74,110,0.12),rgba(8,15,31,0.72))] p-4">
              <div className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">What the page leads with</div>
              <div className="mt-3 text-2xl font-medium leading-tight tracking-[-0.06em] text-slate-50">
                Sync first.
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Show the install payoff immediately, then show why rules keep the archive useful.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
