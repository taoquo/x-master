export function getStatusClasses(status?: string) {
  switch (status) {
    case "success":
      return "status-success"
    case "running":
      return "status-running"
    case "partial_success":
      return "status-partial"
    case "error":
      return "status-error"
    case "idle":
    default:
      return "status-idle"
  }
}
