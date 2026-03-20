import React from "react"
import { Group, Stack, Text } from "@mantine/core"
import type { DashboardHeatmapWeek } from "../lib/dashboard.ts"

const WEEKDAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""]
const HEATMAP_LEVEL_COLORS = ["#edf2f7", "#d6e9f7", "#9bc6eb", "#4f96d0", "#046495"]

function formatMonth(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    timeZone: "UTC"
  }).format(new Date(`${date}T00:00:00.000Z`))
}

function formatDay(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${date}T00:00:00.000Z`))
}

function getMonthLabels(weeks: DashboardHeatmapWeek[]) {
  let previousMonth = ""

  return weeks.map((week) => {
    const month = formatMonth(week.days[0]?.date ?? week.key)
    const label = month === previousMonth ? "" : month
    previousMonth = month
    return label
  })
}

export function DashboardHeatmap({
  weeks,
  totalPublishedInWindow,
  busiestDayCount,
  busiestDayDate,
  onSelectDate
}: {
  weeks: DashboardHeatmapWeek[]
  totalPublishedInWindow: number
  busiestDayCount: number
  busiestDayDate?: string
  onSelectDate?: (date: string) => void
}) {
  const monthLabels = getMonthLabels(weeks)

  return (
    <Stack gap="md">
      <Group justify="space-between" align="start">
        <Stack gap={2}>
          <Text fw={600}>{totalPublishedInWindow} bookmarks published in the last 12 weeks</Text>
          <Text c="dimmed" size="sm">
            {busiestDayCount && busiestDayDate ? `Peak publish day: ${formatDay(busiestDayDate)} with ${busiestDayCount} published` : "No publish activity in this window yet."}
          </Text>
        </Stack>

        <Group gap={6}>
          <Text size="xs" c="dimmed">
            Less
          </Text>
          {HEATMAP_LEVEL_COLORS.map((color) => (
            <div
              key={color}
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: color
              }}
            />
          ))}
          <Text size="xs" c="dimmed">
            More
          </Text>
        </Group>
      </Group>

      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `36px repeat(${weeks.length}, 14px)`,
            gap: 6,
            alignItems: "center",
            minWidth: 36 + weeks.length * 20
          }}>
          <div />
          {monthLabels.map((label, index) => (
            <Text key={`${weeks[index]?.key}-month`} size="xs" c="dimmed">
              {label}
            </Text>
          ))}

          {WEEKDAY_LABELS.map((label, dayIndex) => (
            <React.Fragment key={dayIndex}>
              <Text size="xs" c="dimmed">
                {label}
              </Text>
              {weeks.map((week) => {
                const cell = week.days[dayIndex]
                const labelText = cell.isFuture ? `${formatDay(cell.date)}: future day` : `${formatDay(cell.date)}: ${cell.count} bookmark${cell.count === 1 ? "" : "s"} published`
                const canSelect = Boolean(onSelectDate) && !cell.isFuture && cell.count > 0

                return (
                  <button
                    key={`${week.key}-${cell.date}`}
                    aria-label={labelText}
                    title={labelText}
                    type="button"
                    data-date={cell.date}
                    data-count={cell.count}
                    onClick={canSelect ? () => onSelectDate?.(cell.date) : undefined}
                    disabled={!canSelect}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      background: cell.isFuture ? "#f8fafc" : HEATMAP_LEVEL_COLORS[cell.level],
                      border: cell.isFuture ? "1px dashed #d6dde5" : "1px solid rgba(4, 100, 149, 0.08)",
                      cursor: canSelect ? "pointer" : "default",
                      padding: 0,
                      appearance: "none",
                      opacity: canSelect || cell.isFuture ? 1 : 0.7
                    }}
                  />
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </Stack>
  )
}
