import { build, context } from "esbuild"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const appDir = path.resolve(__dirname, "..")
const outDir = path.join(appDir, "build", "chrome-mv3")
const watchMode = process.argv.includes("--watch")

async function readPackageMetadata() {
  const packageJson = JSON.parse(await readFile(path.join(appDir, "package.json"), "utf8"))

  return {
    name: packageJson.displayName ?? packageJson.name ?? "X Bookmark Manager",
    version: packageJson.version ?? "0.0.1"
  }
}

async function writeStaticFiles() {
  const { name, version } = await readPackageMetadata()

  await writeFile(
    path.join(outDir, "manifest.json"),
    JSON.stringify(
      {
        manifest_version: 3,
        name,
        version,
        permissions: ["cookies", "storage", "sidePanel"],
        host_permissions: ["https://x.com/*"],
        action: {
          default_title: name,
          default_popup: "popup.html"
        },
        side_panel: {
          default_path: "sidepanel.html"
        },
        background: {
          service_worker: "background.js",
          type: "module"
        }
      },
      null,
      2
    )
  )

  await writeFile(
    path.join(outDir, "popup.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script src="./popup.js"></script>
  </body>
</html>
`
  )

  await writeFile(
    path.join(outDir, "sidepanel.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${name} Workspace</title>
  </head>
  <body>
    <div id="root"></div>
    <script src="./sidepanel.js"></script>
  </body>
</html>
`
  )
}

function createBuildOptions(entryPoint, outfile, format) {
  return {
    entryPoints: [entryPoint],
    outfile,
    bundle: true,
    format,
    jsx: "automatic",
    platform: "browser",
    target: "chrome120",
    sourcemap: true,
    tsconfig: path.join(appDir, "tsconfig.json"),
    define: {
      "process.env.NODE_ENV": JSON.stringify(watchMode ? "development" : "production")
    }
  }
}

async function buildExtension() {
  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  const popupOptions = createBuildOptions(path.join(appDir, "src", "popup.tsx"), path.join(outDir, "popup.js"), "iife")
  const sidePanelOptions = createBuildOptions(
    path.join(appDir, "src", "sidepanel.tsx"),
    path.join(outDir, "sidepanel.js"),
    "iife"
  )
  const backgroundOptions = createBuildOptions(
    path.join(appDir, "src", "background.ts"),
    path.join(outDir, "background.js"),
    "esm"
  )

  if (watchMode) {
    const contexts = await Promise.all([context(popupOptions), context(sidePanelOptions), context(backgroundOptions)])
    await Promise.all(contexts.map((buildContext) => buildContext.watch()))
    await writeStaticFiles()
    console.log(`Watching extension sources and writing output to ${outDir}`)
    await new Promise(() => {})
    return
  }

  await Promise.all([build(popupOptions), build(sidePanelOptions), build(backgroundOptions)])
  await writeStaticFiles()
  console.log(`Built extension to ${outDir}`)
}

await buildExtension()
