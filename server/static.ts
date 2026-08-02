import express, { type Express } from "express";
import fs from "fs";
import path from "path";

// pkg (https://github.com/yao-pkg/pkg) sets this global when running inside
// a packaged executable; not part of Node's own types.
declare global {
  namespace NodeJS {
    interface Process {
      pkg?: unknown;
    }
  }
}

export function serveStatic(app: Express) {
  // When packaged with pkg into a standalone .exe, static assets are shipped
  // as real files next to the executable rather than embedded in pkg's
  // snapshot filesystem -- express.static()'s directory listing/sendFile
  // calls don't reliably work against that virtual fs (confirmed while
  // packaging Land-Transfer-Visualizer: existsSync on a snapshot-embedded
  // directory returns false even though the files are there). Resolving
  // relative to process.execPath's directory instead of __dirname sidesteps
  // that entirely; normal (non-pkg) execution is unaffected since
  // process.pkg is only set inside a packaged binary.
  const distPath = process.pkg
    ? path.resolve(path.dirname(process.execPath), "public")
    : path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
