import { cp, mkdir, readdir, readFile, rm } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(root, "public");
const checked = [];
const staticRootFiles = [
  "aircraft-bg.jpg",
  "dashboard.html",
  "efb-callback.html",
  "flight-status.html",
  "index.html",
  "intellectual-property.html",
  "live-flight-map.html",
  "logo.png",
  "ofp.html",
  "performance.html",
  "privacy-policy.html"
];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "public" || entry.name.startsWith(".")) continue;
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

async function writeStaticOutput() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await cp(join(root, "assets"), join(outputDir, "assets"), { recursive: true });
  for (const file of staticRootFiles) {
    await cp(join(root, file), join(outputDir, file));
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
await writeStaticOutput();
console.log("Wrote Vercel static output to public/.");
