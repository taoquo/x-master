const manifest = {
  manifest_version: 3,
  name: "X Bookmark Manager",
  version: "0.0.1",
  permissions: ["cookies", "storage"],
  host_permissions: ["https://x.com/*"],
  icons: {
    16: "assets/icons/icon-16.png",
    32: "assets/icons/icon-32.png",
    48: "assets/icons/icon-48.png",
    128: "assets/icons/icon-128.png"
  },
  action: {
    default_title: "X Bookmark Manager",
    default_icon: {
      16: "assets/icons/icon-16.png",
      32: "assets/icons/icon-32.png",
      48: "assets/icons/icon-48.png"
    }
  }
}

export default manifest
