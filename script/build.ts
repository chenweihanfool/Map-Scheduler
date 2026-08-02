import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = ["date-fns", "drizzle-orm", "drizzle-zod", "express", "pg", "zod"];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  // Every distributed copy of the packaged .exe connects to the same shared
  // Azure Postgres instance (multiple users, one database, per the 2026-08
  // migration off Replit) -- there's no per-user config step for a
  // non-technical team to get through, so DATABASE_URL is baked into the
  // bundle at build time instead of being read from the runtime
  // environment. Only happens when DATABASE_URL is actually set in the
  // environment running this build script (true for CI, which sources it
  // from a repo secret -- see .github/workflows/release.yml); an ordinary
  // local `npm run build` without that env var leaves the normal runtime
  // `process.env.DATABASE_URL` lookup in place, unchanged.
  const define: Record<string, string> = {
    "process.env.NODE_ENV": '"production"',
  };
  if (process.env.DATABASE_URL) {
    define["process.env.DATABASE_URL"] = JSON.stringify(process.env.DATABASE_URL);
  }

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define,
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
