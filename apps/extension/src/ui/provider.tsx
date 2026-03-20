import React from "react"
import { MantineProvider } from "@mantine/core"
import { extensionTheme } from "./theme.ts"

export function ExtensionUiProvider({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider
      theme={extensionTheme}
      defaultColorScheme="light">
      {children}
    </MantineProvider>
  )
}
