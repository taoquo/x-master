export function getStatusClasses(status?: string) {
  switch (status) {
    case "success":
      return "border-emerald-200/80 bg-emerald-100/80 text-emerald-800"
    case "running":
      return "border-sky-200/80 bg-sky-100/80 text-sky-800"
    case "partial_success":
      return "border-amber-200/80 bg-amber-100/80 text-amber-800"
    case "error":
      return "border-red-200/80 bg-red-100/80 text-red-800"
    case "idle":
    default:
      return "border-slate-200/80 bg-white/60 text-slate-700"
  }
}
