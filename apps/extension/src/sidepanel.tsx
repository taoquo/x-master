import React from "react"
import { createRoot } from "react-dom/client"
import { Workspace } from "./popup/Workspace.tsx"

const container = document.getElementById("root")

if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <Workspace width="100%" minHeight={720} />
    </React.StrictMode>
  )
}
