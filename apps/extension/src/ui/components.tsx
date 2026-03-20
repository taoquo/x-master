import React from "react"
import { AppShell, Badge, Button, Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core"
import type { OptionsSection } from "../options/lib/navigation.ts"
import { getStatusColor } from "./theme.ts"

export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <Stack gap={4}>
      <Title order={2}>{title}</Title>
      <Text c="dimmed">{description}</Text>
    </Stack>
  )
}

export function SurfaceCard({
  title,
  description,
  children
}: {
  title?: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card padding="lg">
      {title ? (
        <Stack gap={4} mb="md">
          <Title order={3}>{title}</Title>
          {description ? <Text c="dimmed">{description}</Text> : null}
        </Stack>
      ) : null}
      <Stack gap="sm">{children}</Stack>
    </Card>
  )
}

export function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card padding="lg">
      <Stack gap={6}>
        <Text size="sm" c="dimmed">
          {label}
        </Text>
        <Title order={2}>{value}</Title>
        <Text size="sm" c="dimmed">
          {hint}
        </Text>
      </Stack>
    </Card>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card
      padding="lg"
      style={{
        borderStyle: "dashed"
      }}>
      <Stack gap={6}>
        <Text fw={600}>{title}</Text>
        <Text c="dimmed">{description}</Text>
      </Stack>
    </Card>
  )
}

export function StatusBadge({ status }: { status?: string }) {
  return (
    <Badge
      variant="light"
      color={getStatusColor(status)}>
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

export function WorkspaceShell({ section, navItems, onSelectSection, children }: WorkspaceShellProps) {
  return (
    <AppShell
      padding="xl"
      navbar={{ width: 296, breakpoint: 0 }}
      styles={{
        main: {
          background: "linear-gradient(180deg, #f4f7fb 0%, #edf2f7 100%)"
        }
      }}>
      <AppShell.Navbar p="xl">
        <Stack gap="lg" h="100%">
          <Stack gap={6}>
            <Title order={3}>X Bookmark Manager</Title>
            <Text c="dimmed">A workspace shell for syncing, triaging, reviewing, and maintaining bookmark organization.</Text>
          </Stack>

          <nav>
            <Stack gap="xs">
              {navItems.map((item) => {
                const active = item.id === section
                return (
                  <Button
                    key={item.id}
                    type="button"
                    justify="flex-start"
                    variant={active ? "filled" : "subtle"}
                    color={active ? "dark" : "gray"}
                    onClick={() => onSelectSection(item.id)}>
                    {item.label}
                  </Button>
                )
              })}
            </Stack>
          </nav>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
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
      style={{ textAlign: "left" }}>
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
