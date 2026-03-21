import React from "react"
import { MantineProvider } from "@mantine/core"
import { extensionTheme } from "./theme.ts"
import { isUiTestEnv } from "./testEnv.ts"

export function ExtensionUiProvider({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider
      env={isUiTestEnv() ? "test" : "default"}
      theme={extensionTheme}
      defaultColorScheme="light">
      {children}
    </MantineProvider>
  )
}
