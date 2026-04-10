import React from "react"

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}

function getAssetUrl(path: string) {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path)
  }

  return `./${path}`
}

export function BrandLogo({
  size = 40,
  className,
  testId
}: {
  size?: number
  className?: string
  testId?: string
}) {
  return (
    <img
      src={getAssetUrl("assets/branding/logo-128.png")}
      alt="X Bookmark Manager"
      width={size}
      height={size}
      data-testid={testId}
      className={cn("block shrink-0 object-contain", className)}
    />
  )
}
