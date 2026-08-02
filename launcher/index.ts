/**
 * MapScheduler launcher.
 *
 * This is the stable, rarely-changed .exe the user actually double-clicks.
 * Its only job: check GitHub Releases for a newer app version, download +
 * install it if there is one, then hand off to the actual app executable
 * (which serves the web UI and opens the browser). The app itself lives in
 * a separate ./app/ subfolder specifically so this launcher can freely
 * replace those files -- an exe can't overwrite itself while running on
 * Windows, but it CAN overwrite a *different* file sitting next to it.
 *
 * Folder layout next to this launcher:
 *   MapScheduler.exe        (this file)
 *   app/
 *     MapSchedulerApp.exe   (the actual server, gets replaced on update)
 *     public/               (static assets, gets replaced on update)
 *     version.txt           (currently-installed app version)
 *
 * Update source: GitHub Releases (public repo, no auth needed). Each
 * release's asset is a zip built by .github/workflows/release.yml
 * containing MapSchedulerApp.exe + public/.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, createWriteStream } from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { execFileSync, spawn } from "child_process";
import path from "path";

const REPO = "chenweihanfool/Map-Scheduler";
const APP_DIR = path.join(path.dirname(process.execPath), "app");
const APP_EXE = path.join(APP_DIR, "MapSchedulerApp.exe");
const VERSION_FILE = path.join(APP_DIR, "version.txt");
const ZIP_ASSET_NAME = "MapSchedulerApp.zip";

function log(msg: string) {
  console.log(`[launcher] ${msg}`);
}

function getLocalVersion(): string {
  if (!existsSync(VERSION_FILE)) return "0.0.0";
  return readFileSync(VERSION_FILE, "utf-8").trim();
}

// Simple numeric semver compare -- avoids pulling in a semver dependency
// just for "is a > b". Returns true if `remote` is newer than `local`.
function isNewer(remote: string, local: string): boolean {
  const r = remote.replace(/^v/, "").split(".").map(Number);
  const l = local.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rv = r[i] ?? 0;
    const lv = l[i] ?? 0;
    if (rv !== lv) return rv > lv;
  }
  return false;
}

async function fetchLatestRelease(): Promise<{ version: string; zipUrl: string } | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { "User-Agent": "MapScheduler-Launcher" },
    });
    if (!res.ok) {
      log(`GitHub API returned ${res.status}, skipping update check`);
      return null;
    }
    const data = (await res.json()) as {
      tag_name: string;
      assets: { name: string; browser_download_url: string }[];
    };
    const asset = data.assets.find((a) => a.name === ZIP_ASSET_NAME);
    if (!asset) {
      log(`Release ${data.tag_name} has no ${ZIP_ASSET_NAME} asset, skipping update`);
      return null;
    }
    return { version: data.tag_name.replace(/^v/, ""), zipUrl: asset.browser_download_url };
  } catch (err) {
    log(`Could not reach GitHub (${(err as Error).message}), skipping update check`);
    return null;
  }
}

async function downloadAndInstall(zipUrl: string, version: string) {
  log(`Downloading v${version}...`);
  const res = await fetch(zipUrl, { headers: { "User-Agent": "MapScheduler-Launcher" } });
  if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status}`);

  const tmpZip = path.join(path.dirname(process.execPath), `_update_${version}.zip`);
  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(tmpZip));

  log("Installing...");
  const extractDir = path.join(path.dirname(process.execPath), `_update_${version}`);
  rmSync(extractDir, { recursive: true, force: true });
  execFileSync(
    "powershell",
    ["-NoProfile", "-Command", `Expand-Archive -Path "${tmpZip}" -DestinationPath "${extractDir}" -Force`],
    { stdio: "inherit" },
  );

  rmSync(APP_DIR, { recursive: true, force: true });
  execFileSync("powershell", ["-NoProfile", "-Command", `Move-Item -Path "${extractDir}" -Destination "${APP_DIR}" -Force`], {
    stdio: "inherit",
  });

  writeFileSync(VERSION_FILE, version);
  rmSync(tmpZip, { force: true });
  rmSync(extractDir, { recursive: true, force: true });
  log(`Updated to v${version}`);
}

async function main() {
  log("MapScheduler starting...");
  mkdirSync(APP_DIR, { recursive: true });

  const localVersion = getLocalVersion();
  const latest = await fetchLatestRelease();

  if (latest && isNewer(latest.version, localVersion)) {
    try {
      await downloadAndInstall(latest.zipUrl, latest.version);
    } catch (err) {
      log(`Update failed (${(err as Error).message}), continuing with current version if available`);
    }
  } else if (latest) {
    log(`Already up to date (v${localVersion})`);
  }

  if (!existsSync(APP_EXE)) {
    log("No app installed and update unavailable -- need an internet connection for first-time setup.");
    log("Press any key to exit...");
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    await new Promise((resolve) => process.stdin.once("data", resolve));
    process.exit(1);
  }

  log("Starting MapScheduler...");
  const child = spawn(APP_EXE, [], { cwd: APP_DIR, stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error("[launcher] Fatal error:", err);
  process.exit(1);
});
