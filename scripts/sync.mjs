#!/usr/bin/env node
// Pulls the components from the live registry at ui.twelfth.ai into this
// repository. The registry serves every file's source, so the public repo
// mirrors exactly what is deployed, with no access to Twelfth's private code.
import { mkdir, readdir, rm, writeFile } from "node:fs/promises"
import { dirname, join, relative } from "node:path"

const ORIGIN = "https://ui.twelfth.ai/r"
const ROOT = new URL("..", import.meta.url).pathname
const SOURCE_DIR = join(ROOT, "src/registry/catman")

async function json(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } })
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response.json()
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const files = await Promise.all(entries.map((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)])))
  return files.flat()
}

const index = await json(`${ORIGIN}/registry.json`)
const written = new Set()
for (const { name } of index.items) {
  const item = await json(`${ORIGIN}/${name}.json`)
  for (const file of item.files ?? []) {
    if (!file.content || !file.path.startsWith("src/registry/catman/")) continue
    const target = join(ROOT, file.path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, file.content.endsWith("\n") ? file.content : `${file.content}\n`)
    written.add(target)
  }
}
// Drop files the registry no longer serves.
for (const file of await walk(SOURCE_DIR)) {
  if (!written.has(file)) await rm(file)
}
await writeFile(join(ROOT, "registry.json"), `${JSON.stringify(index, null, 2)}\n`)
console.log(`synced ${index.items.length} items, ${written.size} files → ${relative(ROOT, SOURCE_DIR)}`)
