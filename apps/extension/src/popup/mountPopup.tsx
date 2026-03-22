import React from "react"
import { createRoot } from "react-dom/client"
import App from "./App.tsx"

export function Popup() {
  return <App />
}

export function mountPopup(container: Element | null) {
  if (!container) {
    return null
  }

  const root = createRoot(container)
  root.render(
    <React.StrictMode>
      <Popup />
    </React.StrictMode>
  )
  return root
}
