import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { recognizeScore } from "./recognition.mjs";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const isDevelopment = process.argv.includes("--dev");
const port = Number(process.env.PORT || 4173);
const maxRequestBytes = 52 * 1024 * 1024;

function loadLocalEnv() {
  const envPath = join(projectRoot, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

loadLocalEnv();

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxRequestBytes) throw new Error("上传内容超过 52 MB 限制。");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function serveStatic(request, response) {
  const distRoot = join(projectRoot, "dist");
  const requestPath = new URL(request.url, "http://localhost").pathname;
  const relativePath = requestPath === "/" ? "index.html" : requestPath.slice(1);
  let filePath = resolve(distRoot, relativePath);
  if (!filePath.startsWith(distRoot) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(distRoot, "index.html");
  }
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  response.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
}

let vite;
if (isDevelopment) {
  const { createServer: createViteServer } = await import("vite");
  vite = await createViteServer({
    root: projectRoot,
    server: { middlewareMode: true },
    appType: "spa",
  });
}

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (request.method === "GET" && pathname === "/api/health") {
      sendJson(response, 200, {
        ok: true,
        configured: Boolean(process.env.OPENAI_API_KEY && process.env.GEMINI_API_KEY),
      });
      return;
    }
    if (request.method === "POST" && pathname === "/api/recognize") {
      const body = await readJson(request);
      const result = await recognizeScore(body.pages);
      sendJson(response, 200, result);
      return;
    }
    if (pathname.startsWith("/api/")) {
      sendJson(response, 404, { error: "API 路径不存在。" });
      return;
    }
    if (vite) {
      vite.middlewares(request, response, (error) => {
        if (error) sendJson(response, 500, { error: "开发服务器响应失败。" });
      });
      return;
    }
    serveStatic(request, response);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "识别服务失败。";
    sendJson(response, 400, { error: message });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`ScoreToKeys server: http://127.0.0.1:${port}`);
});
