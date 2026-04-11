export function extractCsrfToken(cookieHeader: string) {
  const match = cookieHeader.match(/(?:^|;\s*)ct0=([^;]+)/)
  if (!match) {
    throw new Error("Missing ct0 cookie")
  }
  return match[1]
}

export async function getXCookieHeader() {
  if (typeof chrome === "undefined" || !chrome.cookies?.getAll) {
    throw new Error("Chrome cookies API unavailable")
  }

  const cookies = await chrome.cookies.getAll({ domain: "x.com" })
  if (!cookies.length) {
    throw new Error("No X cookies found")
  }

  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ")
}
