#!/usr/bin/env node
// Pulls the components from the live registry at ui.twelfth.ai into this
// repository. The registry serves every file's source, so the public repo
// mirrors exactly what is deployed, with no access to Twelfth's private code.
import { execFileSync } from "node:child_process"
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
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

// --commit (CI): record the changes as one commit made by GitHub's API, which
// signs it, rather than an unsigned `git commit` from the runner.
if (process.argv.includes("--commit")) {
  const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: ROOT, encoding: "utf8" })
  const changes = status.split("\n").filter(Boolean).map((line) => ({ code: line.slice(0, 2), path: line.slice(3) }))
  if (changes.length === 0) {
    console.log("Already in step with ui.twelfth.ai.")
  } else {
    const additions = []
    const deletions = []
    for (const { code, path } of changes) {
      if (code.includes("D")) deletions.push({ path })
      else additions.push({ path, contents: (await readFile(join(ROOT, path))).toString("base64") })
    }
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim()
    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim()
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { authorization: `bearer ${process.env.GITHUB_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({
        query: "mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid url } } }",
        variables: { input: {
          branch: { repositoryNameWithOwner: process.env.GITHUB_REPOSITORY, branchName: branch },
          expectedHeadOid: head,
          message: { headline: "Sync from ui.twelfth.ai" },
          fileChanges: { additions, deletions },
        } },
      }),
    })
    const result = await response.json()
    if (result.errors) throw new Error(JSON.stringify(result.errors))
    console.log(`committed ${changes.length} change(s): ${result.data.createCommitOnBranch.commit.url}`)
  }
}
