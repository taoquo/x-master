import type { KnowledgeCardQualityIssue, KnowledgeCardQualityIssueCode, KnowledgeCardProvenanceRecord } from "../types.ts"

export function createQualityIssue({
  code,
  message,
  field
}: {
  code: KnowledgeCardQualityIssueCode
  message: string
  field?: KnowledgeCardProvenanceRecord["field"]
}): KnowledgeCardQualityIssue {
  return {
    code,
    message,
    field
  }
}

export function dedupeQualityIssues(issues: KnowledgeCardQualityIssue[]) {
  const seen = new Set<string>()
  const deduped: KnowledgeCardQualityIssue[] = []

  for (const issue of issues) {
    const key = `${issue.code}:${issue.field ?? ""}:${issue.message}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    deduped.push(issue)
  }

  return deduped
}

export function issuesToWarnings(issues: KnowledgeCardQualityIssue[], warnings: string[] = []) {
  return [...new Set([...warnings, ...issues.map((issue) => issue.message).filter(Boolean)])]
}

export function getQualityIssueLabel(code: KnowledgeCardQualityIssueCode) {
  switch (code) {
    case "short_source":
      return "Short source"
    case "missing_author_metadata":
      return "Missing author metadata"
    case "theme_evidence_missing":
      return "Theme evidence missing"
    case "summary_evidence_missing":
      return "Summary evidence missing"
    case "applicability_evidence_missing":
      return "Applicability evidence missing"
    case "key_excerpt_not_verbatim":
      return "Excerpt not verbatim"
    case "key_excerpt_evidence_missing":
      return "Excerpt evidence missing"
    case "key_excerpt_not_code_focused":
      return "Code excerpt mismatch"
    case "ai_generation_disabled":
      return "AI disabled"
    case "ai_generation_failed":
      return "AI failed"
    case "model_warning":
      return "Model warning"
    default:
      return code
  }
}
