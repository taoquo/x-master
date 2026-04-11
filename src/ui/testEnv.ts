export function isUiTestEnv() {
  return (
    typeof globalThis !== "undefined" &&
    Boolean((globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT)
  )
}
