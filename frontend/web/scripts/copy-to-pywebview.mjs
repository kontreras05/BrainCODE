import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, "..", "dist-single", "index.html");
const dest = resolve(__dirname, "..", "..", "index.html");

await mkdir(dirname(dest), { recursive: true });
await copyFile(src, dest);
console.log(`Copied ${src} -> ${dest}`);
