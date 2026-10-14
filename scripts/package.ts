import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Depuis build/scripts/package.js, préparer une extension autonome sans les outils de développement.
const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const output = join(root, "dist");
const files = new Set<string>();
const contents = new Map<string, Buffer>();

function sourcePath(local: string): string {
  // Les ressources statiques ont une seule source, conservée dans dist.
  const staticResource = local === "manifest.json" || local.startsWith(`assets${sep}`) ||
    [".html", ".css"].includes(extname(local));
  return join(staticResource ? output : root, local);
}

function localFile(file: string): string {
  const absolute = resolve(root, file);
  const local = relative(root, absolute);
  if (!local || local === ".." || local.startsWith(`..${sep}`) || isAbsolute(local) ||
      local.split(sep).some(part => ["node_modules", ".git", "dist", "tests"].includes(part))) {
    throw new Error(`Ressource hors de l’extension : ${file}`);
  }
  if (!statSync(sourcePath(local)).isFile()) throw new Error(`Fichier introuvable : ${file}`);
  return local;
}

function collect(file: string) {
  const local = localFile(file);
  if (files.has(local)) return;
  files.add(local);
  const absolute = join(root, local);
  const content = readFileSync(sourcePath(local));
  contents.set(local, content);
  const extension = extname(local);
  if (![".js", ".html", ".css"].includes(extension)) return;
  const source = content.toString("utf8");
  const references = extension === ".js"
    ? [...source.matchAll(/\b(?:from\s*|import\s*)["'](\.[^"']+)["']/g)].map(match => match[1])
    : extension === ".html"
      ? [...source.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)].map(match => match[1])
      : [...source.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)].map(match => match[1]);
  for (const reference of references) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) continue;
    collect(relative(root, resolve(dirname(absolute), reference)));
  }
}

const manifestPath = join(output, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as chrome.runtime.ManifestV3;
collect("manifest.json");
if (manifest.background?.service_worker) collect(manifest.background.service_worker);
if (manifest.action?.default_popup) collect(manifest.action.default_popup);
for (const icon of Object.values(manifest.icons ?? {})) collect(icon);
const actionIcons = manifest.action?.default_icon;
for (const icon of typeof actionIcons === "string" ? [actionIcons] : Object.values(actionIcons ?? {})) collect(icon);
for (const script of manifest.content_scripts ?? []) {
  for (const file of [...(script.js ?? []), ...(script.css ?? [])]) collect(file);
}

// Recréer uniquement le JavaScript généré ; conserver les ressources statiques.
if (relative(root, output) !== "dist" || !output.startsWith(root + sep)) throw new Error("Destination invalide.");
if (lstatSync(output).isSymbolicLink()) throw new Error("Le dossier dist ne doit pas être un lien.");
const compiledOutput = join(output, "build");
if (relative(output, compiledOutput) !== "build" || !compiledOutput.startsWith(output + sep)) throw new Error("Destination de compilation invalide.");
if (existsSync(compiledOutput)) {
  if (lstatSync(compiledOutput).isSymbolicLink()) throw new Error("Le dossier compilé ne doit pas être un lien.");
  rmSync(compiledOutput, { recursive: true });
}
let bytes = 0;
for (const file of [...files].sort()) {
  const target = join(output, file);
  mkdirSync(dirname(target), { recursive: true });
  if (target !== sourcePath(file)) writeFileSync(target, contents.get(file)!);
  bytes += statSync(target).size;
}
// Les fichiers compilés sont désormais dans dist ; retirer les copies temporaires.
const temporaryBuild = join(root, "build");
if (relative(root, temporaryBuild) !== "build" || !temporaryBuild.startsWith(root + sep) ||
    lstatSync(temporaryBuild).isSymbolicLink()) throw new Error("Dossier de compilation invalide.");
rmSync(temporaryBuild, { recursive: true });
console.log(`Extension prête dans dist : ${files.size} fichiers, ${(bytes / 1024).toFixed(1)} Ko. Version ${manifest.version}.`);
