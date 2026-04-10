import { spawn } from "node:child_process"
import { build, context } from "esbuild"
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const appDir = path.resolve(__dirname, "..")
const outDir = path.join(appDir, "build", "chrome-mv3")
const assetsDir = path.join(appDir, "assets")
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

  await cp(assetsDir, path.join(outDir, "assets"), { recursive: true })

  await writeFile(
    path.join(outDir, "manifest.json"),
    JSON.stringify(
      {
        manifest_version: 3,
        name,
        version,
        permissions: ["cookies", "storage"],
        host_permissions: ["https://x.com/*"],
        icons: {
          16: "assets/icons/icon-16.png",
          32: "assets/icons/icon-32.png",
          48: "assets/icons/icon-48.png",
          128: "assets/icons/icon-128.png"
        },
        action: {
          default_title: name,
          default_icon: {
            16: "assets/icons/icon-16.png",
            32: "assets/icons/icon-32.png",
            48: "assets/icons/icon-48.png"
          }
        },
        options_ui: {
          page: "options.html",
          open_in_tab: true
        },
        background: {
          service_worker: "background.js",
          type: "module"
        },
        content_scripts: [
          {
            matches: ["https://x.com/home", "https://x.com/i/bookmarks*"],
            js: ["content.js"],
            run_at: "document_idle"
          }
        ],
        web_accessible_resources: [
          {
            resources: ["assets/icons/*", "assets/branding/*"],
            matches: ["https://x.com/*"]
          }
        ]
      },
      null,
      2
    )
  )

  await writeFile(
    path.join(outDir, "options.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${name} Workspace</title>
    <link rel="stylesheet" href="./extension.css" />
  </head>
  <body>
    <div id="root"></div>
    <script src="./options.js"></script>
  </body>
</html>
`
  )

  await writeFile(
    path.join(outDir, "popup.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${name}</title>
    <link rel="stylesheet" href="./extension.css" />
  </head>
  <body>
    <div id="root"></div>
    <script src="./popup.js"></script>
  </body>
</html>
`
  )
}

function resolveTailwindBin() {
  return process.platform === "win32" ? "tailwindcss.cmd" : "tailwindcss"
}

function runTailwindBuild({ watch = false } = {}) {
  const args = [
    "-c",
    path.join(appDir, "tailwind.config.cjs"),
    "-i",
    path.join(appDir, "src", "styles", "extension.css"),
    "-o",
    path.join(outDir, "extension.css")
  ]

  if (watch) {
    args.push("--watch")
  } else {
    args.push("--minify")
  }

  return new Promise((resolve, reject) => {
    const child = spawn(resolveTailwindBin(), args, {
      cwd: appDir,
      stdio: watch ? "inherit" : ["ignore", "pipe", "pipe"]
    })

    if (watch) {
      child.on("error", reject)
      resolve(child)
      return
    }

    let stderr = ""

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })

    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) {
        resolve(child)
        return
      }

      reject(new Error(stderr || `Tailwind build failed with code ${code}`))
    })
  })
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

  const optionsPageOptions = createBuildOptions(
    path.join(appDir, "src", "options.tsx"),
    path.join(outDir, "options.js"),
    "iife"
  )
  const backgroundOptions = createBuildOptions(
    path.join(appDir, "src", "background.ts"),
    path.join(outDir, "background.js"),
    "esm"
  )
  const popupOptions = createBuildOptions(
    path.join(appDir, "src", "popup", "index.tsx"),
    path.join(outDir, "popup.js"),
    "iife"
  )
  const contentOptions = createBuildOptions(
    path.join(appDir, "src", "content", "index.ts"),
    path.join(outDir, "content.js"),
    "iife"
  )

  if (watchMode) {
    await runTailwindBuild({ watch: true })
    const contexts = await Promise.all([
      context(optionsPageOptions),
      context(backgroundOptions),
      context(popupOptions),
      context(contentOptions)
    ])
    await Promise.all(contexts.map((buildContext) => buildContext.watch()))
    await writeStaticFiles()
    console.log(`Watching extension sources and writing output to ${outDir}`)
    await new Promise(() => {})
    return
  }

  await Promise.all([build(optionsPageOptions), build(backgroundOptions), build(popupOptions), build(contentOptions), runTailwindBuild()])
  await writeStaticFiles()
  console.log(`Built extension to ${outDir}`)
}

await buildExtension()
