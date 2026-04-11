export const landingCopy = {
  hero: {
    eyebrow: "Chrome extension for heavy X users",
    title: "Pull your X bookmarks into a searchable local workspace.",
    description:
      "Sync from X, keep your archive on-device, and turn new saves into tagged collections with rules instead of manual cleanup.",
    supporting: "Auto-tag new bookmarks with rules.",
    badges: ["Chrome extension", "Local-first bookmark workspace", "Open-source"]
  },
  trust: [
    "Sync from X",
    "Rules-based tagging",
    "Local-first archive",
    "Open-source codebase"
  ],
  features: [
    {
      title: "One pull, full workspace",
      body:
        "Move from scattered saves to a local inventory with sync status, saved counts, author context, and metadata in one view.",
      accent: "Sync from X"
    },
    {
      title: "Rules do the sorting",
      body:
        "Tag by author handles, keyword sets, media presence, and longform rules so new bookmarks land where they belong.",
      accent: "Rules-based tagging"
    },
    {
      title: "Built for triage, not hoarding",
      body:
        "Lists, tags, and workspace stats make it easier to review what matters instead of collecting links you never revisit.",
      accent: "Local-first bookmark workspace"
    },
    {
      title: "Open and inspectable",
      body:
        "Own the flow. The extension is open-source, the storage is local-first, and the install path can stay inside GitHub releases.",
      accent: "Open-source"
    }
  ],
  workflow: [
    {
      step: "01",
      title: "Install and connect",
      body: "Install the extension, open X, and trigger a sync run from the popup or workspace."
    },
    {
      step: "02",
      title: "Pull your archive",
      body: "New and existing bookmarks land in a local workspace with sync metrics and inventory counts."
    },
    {
      step: "03",
      title: "Let rules attach intent",
      body: "Auto-tag bookmarks by handle, topic, media, or longform conditions so the archive stays usable."
    }
  ],
  install: {
    title: "Install the extension, then let the archive organize itself.",
    description:
      "The first release keeps the install path simple: grab the latest build from GitHub Releases, inspect the source in GitHub, and keep the workflow local-first.",
    checklist: [
      "Chrome extension install path",
      "GitHub Releases as the primary CTA",
      "Open-source repository as the secondary CTA"
    ]
  },
  faq: [
    {
      question: "What does the landing page emphasize first?",
      answer:
        "The first message is sync. The page leads with pulling bookmarks from X into a local workspace, then introduces rules-based auto-tagging as the differentiator."
    },
    {
      question: "Does the product depend on a hosted backend?",
      answer:
        "The positioning is local-first. The page describes a workspace that lives on-device and highlights open-source transparency rather than hosted lock-in."
    },
    {
      question: "Why not lead with search?",
      answer:
        "Search matters, but the first release page is optimized for install conversion. Sync explains immediate value faster, and tagging explains why the product stays useful over time."
    }
  ],
  footer: "Built for people who save too much on X and still want to find the right thread later."
} as const
