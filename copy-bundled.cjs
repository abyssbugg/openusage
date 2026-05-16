const { cpSync, readdirSync, rmSync } = require("fs")
const { join } = require("path")

const root = __dirname
const exclude = new Set(["mock"])
const srcDir = join(root, "plugins")
const dstDir = join(root, "src-tauri", "resources", "bundled_plugins")

rmSync(dstDir, { recursive: true, force: true })

const plugins = readdirSync(srcDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !exclude.has(d.name))
  .map((d) => d.name)

for (const id of plugins) {
  const targetDir = join(dstDir, id)
  cpSync(join(srcDir, id), targetDir, { recursive: true })
  rmSync(join(targetDir, "plugin.test.js"), { force: true })
}

console.log(`Bundled ${plugins.length} plugins: ${plugins.join(", ")}`)
