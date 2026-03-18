const manifest = {
  manifest_version: 3,
  name: "X Bookmark Manager",
  version: "0.0.1",
  permissions: ["cookies", "storage"],
  host_permissions: ["https://x.com/*"],
  action: {
    default_title: "X Bookmark Manager"
  }
}

export default manifest
