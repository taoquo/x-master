import "@mantine/core/styles.css"
import React from "react"
import { createRoot } from "react-dom/client"
import { OptionsApp } from "./options/OptionsApp.tsx"

const container = document.getElementById("root")

if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <OptionsApp />
    </React.StrictMode>
  )
}
