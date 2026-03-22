import React, { useMemo, useState } from "react"
import { ActionIcon, Badge, Card, Group, SimpleGrid, Stack, Text, Title, UnstyledButton } from "@mantine/core"
import { useMediaQuery } from "@mantine/hooks"
import type { OptionsSection } from "../options/lib/navigation.ts"
import { getStatusColor } from "./theme.ts"
import { isUiTestEnv } from "./testEnv.ts"
import { AppIcon } from "./icons.tsx"

export function SectionHeader({
  title,
  description,
  actions
}: {
  title: string
  description: string
  actions?: React.ReactNode
}) {
  return (
    <Group justify="space-between" align="center" wrap="wrap">
      <Stack gap={6} style={{ flex: 1, minWidth: 260 }}>
        <Text fw={750} size="1.95rem" c="#18181b" style={{ lineHeight: 1.05 }}>
          {title}
        </Text>
        <Text size="md" c="#64748b" style={{ maxWidth: 760, lineHeight: 1.55 }}>
          {description}
        </Text>
      </Stack>
      {actions ? <Group gap="sm">{actions}</Group> : null}
    </Group>
  )
}

export function SurfaceCard({
  title,
  description,
  children,
  style,
  bodyStyle
}: {
  title?: string
  description?: string
  children: React.ReactNode
  style?: React.CSSProperties
  bodyStyle?: React.CSSProperties
}) {
  return (
    <Card
      padding="xl"
      style={{
        background: "linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%)",
        borderColor: "#e2e8f0",
        boxShadow: "0 14px 36px rgba(15, 23, 42, 0.05)",
        ...style
      }}>
      {title ? (
        <Stack gap={6} mb="lg">
          <Title order={3}>{title}</Title>
          {description ? <Text c="#64748b" style={{ lineHeight: 1.6 }}>{description}</Text> : null}
        </Stack>
      ) : null}
      <Stack
        gap="sm"
        style={bodyStyle}>
        {children}
      </Stack>
    </Card>
  )
}

export function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card padding="lg" style={{ background: "#ffffff" }}>
      <Stack gap={8}>
        <Text size="xs" tt="uppercase" fw={700} c="#71717a">
          {label}
        </Text>
        <Title order={2}>{value}</Title>
        <Text size="sm" c="#64748b" style={{ lineHeight: 1.55 }}>
          {hint}
        </Text>
      </Stack>
    </Card>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card
      padding="xl"
      style={{
        borderStyle: "dashed",
        borderColor: "#cbd5e1",
        background: "linear-gradient(180deg, #fbfcfe 0%, #f6f8fb 100%)"
      }}>
      <Stack gap={8}>
        <Text fw={700} size="lg" c="#18181b">
          {title}
        </Text>
        <Text c="#64748b" style={{ maxWidth: 760, lineHeight: 1.65 }}>
          {description}
        </Text>
      </Stack>
    </Card>
  )
}

export function StatusBadge({ status }: { status?: string }) {
  return (
    <Badge variant="light" color={getStatusColor(status)}>
      {status ?? "idle"}
    </Badge>
  )
}

interface WorkspaceShellProps {
  section: OptionsSection
  navItems: Array<{ id: OptionsSection; label: string }>
  onSelectSection: (section: OptionsSection) => void
  children: React.ReactNode
}

function getNavIcon(section: OptionsSection) {
  switch (section) {
    case "dashboard":
      return "dashboard"
    case "inbox":
      return "inbox"
    case "library":
      return "library"
    case "settings":
      return "settings"
    default:
      return "dashboard"
  }
}

export function WorkspaceShell({ section, navItems, onSelectSection, children }: WorkspaceShellProps) {
  const testEnv = isUiTestEnv()
  const autoCollapsed = useMediaQuery("(max-width: 1180px)", false, { getInitialValueInEffect: false }) ?? false
  const [manualCollapsed, setManualCollapsed] = useState<boolean | null>(null)
  const collapsed = testEnv ? false : manualCollapsed ?? autoCollapsed
  const railWidth = collapsed ? 80 : 296

  const navButtons = useMemo(
    () =>
      navItems.map((item) => {
        const active = item.id === section

        return (
          <UnstyledButton
            key={item.id}
            type="button"
            onClick={() => onSelectSection(item.id)}
            aria-label={item.label}
            title={collapsed ? item.label : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "space-between",
              gap: 16,
              minHeight: 48,
              width: "100%",
              padding: collapsed ? "12px 0" : "12px 14px",
              borderRadius: 12,
              background: active ? "#18181b" : "#f8fafc",
              color: active ? "#ffffff" : "#18181b",
              border: active ? "1px solid #18181b" : "1px solid #e4e4e7",
              boxShadow: active ? "0 10px 28px rgba(24, 24, 27, 0.12)" : undefined,
              transition: "background 120ms ease, color 120ms ease, border-color 120ms ease, box-shadow 120ms ease"
            }}>
            <Group gap={collapsed ? 0 : 16} wrap="nowrap" justify={collapsed ? "center" : "flex-start"}>
              <AppIcon name={getNavIcon(item.id)} size={20} />
              {!collapsed ? (
                <Text size="sm" fw={500} c="inherit">
                  {item.label}
                </Text>
              ) : null}
            </Group>
          </UnstyledButton>
        )
      }),
    [collapsed, navItems, onSelectSection, section]
  )

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `${railWidth}px minmax(0, 1fr)`,
        minHeight: "100vh",
        background: "#fafafa"
      }}>
      <aside
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          padding: 8,
          borderRight: "1px solid #e4e4e7",
          background: "#ffffff"
        }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            gap: 12,
            minHeight: 48,
            padding: collapsed ? 0 : "0 4px"
          }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "space-between",
              gap: 12,
              flex: 1,
              minWidth: 0,
              padding: collapsed ? "0" : "0 8px"
            }}>
            <div
              style={{
                display: "grid",
                placeItems: "center",
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "#18181b",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 700,
                flexShrink: 0
              }}>
              X
            </div>
            {!collapsed ? (
              <div style={{ minWidth: 0 }}>
                <Text fw={600} size="sm" c="#18181b">
                  X Knowledge Cards
                </Text>
                <Text size="xs" c="#71717a">
                  Source {"->"} Card {"->"} Vault
                </Text>
              </div>
            ) : null}
          </div>

          {!testEnv ? (
            <ActionIcon
              type="button"
              variant="subtle"
              color="gray"
              size={40}
              radius="md"
              onClick={() => setManualCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}>
              <AppIcon name={collapsed ? "chevron-right" : "chevron-left"} size={16} />
            </ActionIcon>
          ) : null}
        </div>

        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4
          }}>
          {navButtons}
        </nav>
      </aside>

      <main
        style={{
          minWidth: 0,
          padding: 16,
          background: "#fafafa"
        }}>
        {children}
      </main>
    </div>
  )
}

export function ActionGrid({ children }: { children: React.ReactNode }) {
  return (
    <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} spacing="lg">
      {children}
    </SimpleGrid>
  )
}

export function ActionCard({
  title,
  body,
  actionLabel,
  onClick
}: {
  title: string
  body: string
  actionLabel: string
  onClick: () => void
}) {
  return (
    <Card
      component="button"
      type="button"
      onClick={onClick}
      padding="lg"
      style={{ textAlign: "left", background: "#ffffff" }}>
      <Stack gap="xs">
        <Title order={3}>{title}</Title>
        <Text c="dimmed">{body}</Text>
        <Group justify="space-between">
          <Text fw={600} size="sm">
            {actionLabel}
          </Text>
        </Group>
      </Stack>
    </Card>
  )
}
