import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const checked = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
      continue;
    }
    if (extname(entry.name) === ".js" || extname(entry.name) === ".mjs") {
      await checkJavaScript(full);
    }
    if (extname(entry.name) === ".html") {
      await checkHtml(full);
    }
  }
}

async function checkJavaScript(file) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--check", file], { stdio: "inherit" });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${file} failed syntax check`)));
    child.on("error", reject);
  });
  checked.push(file);
}

async function checkHtml(file) {
  const html = await readFile(file, "utf8");
  if (!html.includes("<!DOCTYPE html>")) {
    throw new Error(`${file} is missing a doctype`);
  }
  checked.push(file);
}

await walk(root);
console.log(`Validated ${checked.length} frontend files.`);
