import { createTheme } from "@mantine/core"

export const extensionTheme = createTheme({
  primaryColor: "blue",
  fontFamily: '"Inter", "IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif',
  headings: {
    fontFamily: '"Inter", "IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif',
    sizes: {
      h1: { fontSize: "2rem", lineHeight: "1.1", fontWeight: "700" },
      h2: { fontSize: "1.45rem", lineHeight: "1.15", fontWeight: "700" },
      h3: { fontSize: "1.05rem", lineHeight: "1.2", fontWeight: "600" }
    }
  },
  defaultRadius: "md",
  colors: {
    ocean: ["#eef8ff", "#d8eefe", "#b7dffd", "#8cccf9", "#63b8f4", "#46a9f0", "#2e9fe9", "#1989d0", "#1178ba", "#046495"],
    sand: ["#fbfaf7", "#f4f0e6", "#e6dcc8", "#d7c6a6", "#cab07e", "#c09f64", "#bb9655", "#a58044", "#936f39", "#7f5e2f"],
    slate: ["#f5f7fa", "#e9edf2", "#d6dde5", "#b9c4d1", "#98a7b7", "#8192a4", "#74879b", "#64778a", "#56697b", "#495a69"]
  },
  components: {
    Button: {
      defaultProps: {
        radius: "md"
      }
    },
    Card: {
      defaultProps: {
        radius: "md",
        shadow: "xs",
        withBorder: true
      }
    },
    Paper: {
      defaultProps: {
        radius: "md",
        withBorder: true
      }
    },
    TextInput: {
      defaultProps: {
        radius: "md"
      }
    },
    NativeSelect: {
      defaultProps: {
        radius: "md"
      }
    }
  }
})

export function getStatusColor(status?: string) {
  switch (status) {
    case "success":
      return "teal"
    case "running":
      return "ocean"
    case "partial_success":
      return "yellow"
    case "error":
      return "red"
    case "idle":
    default:
      return "gray"
  }
}
