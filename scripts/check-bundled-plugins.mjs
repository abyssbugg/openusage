import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const root = join(process.cwd(), "src-tauri", "resources", "bundled_plugins")

function collectTestArtifacts(dir, out = []) {
  const entries = readdirSync(dir)
  for (const name of entries) {
    const fullPath = join(dir, name)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      collectTestArtifacts(fullPath, out)
      continue
    }
    if (name.endsWith(".test.js")) {
      out.push(fullPath)
    }
  }
  return out
}

let offenders = []
try {
  offenders = collectTestArtifacts(root)
} catch (error) {
  console.error(`Bundled plugins directory missing or unreadable: ${root}`)
  console.error(String(error))
  process.exit(1)
}

if (offenders.length > 0) {
  console.error("Found forbidden test artifacts in bundled plugins:")
  for (const path of offenders) {
    console.error(`- ${path}`)
  }
  process.exit(1)
}

console.log("Bundled plugins check passed: no .test.js artifacts found.")
