import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_ROOT = path.resolve(__dirname, "..");
const DIST_ROOT = path.resolve(FRONTEND_ROOT, "dist");
const INDEX_FILE = path.resolve(DIST_ROOT, "index.html");

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;

  const fileContent = fs.readFileSync(envPath, "utf8");
  fileContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const normalizedValue = rawValue.replace(/^['"]|['"]$/g, "");

    process.env[key] = normalizedValue;
  });
}

[
  path.resolve(FRONTEND_ROOT, ".env"),
  path.resolve(FRONTEND_ROOT, ".env.production"),
  path.resolve(FRONTEND_ROOT, ".env.production.local"),
].forEach(loadEnvFile);

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Falta la variable de entorno obligatoria: ${name}`);
  }
  return value;
}

function sendResponse(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

function getConfiguredApiUrl() {
  const rawValue = String(process.env.VITE_API_URL || "").trim();
  if (!rawValue) return null;

  try {
    return new URL(rawValue.replace(/\/+$/, ""));
  } catch {
    return null;
  }
}

function shouldProxyApiRequest(requestPathname) {
  return requestPathname === "/api" || requestPathname.startsWith("/api/");
}

function buildApiProxyTarget(requestUrl) {
  const apiBaseUrl = getConfiguredApiUrl();
  if (!apiBaseUrl) return null;

  const parsedRequestUrl = new URL(requestUrl || "/", "https://frontend.local");
  const pathWithoutApiPrefix = parsedRequestUrl.pathname.replace(/^\/api(?=\/|$)/i, "") || "/";

  try {
    return new URL(
      `.${pathWithoutApiPrefix}${parsedRequestUrl.search}`,
      `${apiBaseUrl.toString().replace(/\/+$/, "")}/`,
    );
  } catch {
    return null;
  }
}

function proxyApiRequest(req, res) {
  const targetUrl = buildApiProxyTarget(req.url || "/");
  if (!targetUrl) {
    return sendResponse(
      res,
      502,
      "No se pudo resolver el destino de API configurado para el proxy del frontend.",
      { "Content-Type": "text/plain; charset=utf-8" },
    );
  }

  const transport = targetUrl.protocol === "https:" ? https : http;
  const headers = { ...req.headers };
  headers.host = targetUrl.host;

  if (targetUrl.hostname.includes("ngrok-free")) {
    headers["ngrok-skip-browser-warning"] = "true";
  }

  const proxyRequest = transport.request(
    targetUrl,
    {
      method: req.method,
      headers,
    },
    (proxyResponse) => {
      res.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
      proxyResponse.pipe(res);
    },
  );

  proxyRequest.on("error", () => {
    if (!res.headersSent) {
      sendResponse(
        res,
        502,
        "No fue posible conectar con el backend configurado.",
        { "Content-Type": "text/plain; charset=utf-8" },
      );
    } else {
      res.end();
    }
  });

  req.pipe(proxyRequest);
}

function isPathInside(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);
  return relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function resolveAssetPath(requestUrl) {
  const requestPathname = decodeURIComponent(new URL(requestUrl, "https://frontend.local").pathname);
  const normalizedPath = requestPathname === "/" ? "/index.html" : requestPathname;
  const absolutePath = path.resolve(DIST_ROOT, `.${normalizedPath}`);

  if (absolutePath !== INDEX_FILE && !isPathInside(DIST_ROOT, absolutePath)) {
    return null;
  }

  return absolutePath;
}

function shouldUseSpaFallback(requestPathname) {
  return path.extname(requestPathname) === "";
}

function getMimeType(filePath) {
  return MIME_TYPES.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
}

function serveFile(res, filePath) {
  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    sendResponse(res, 500, "No fue posible servir el recurso solicitado.");
  });
  res.writeHead(200, {
    "Content-Type": getMimeType(filePath),
    "Cache-Control": filePath === INDEX_FILE ? "no-cache" : "public, max-age=31536000, immutable",
  });
  stream.pipe(res);
}

function assertStartupFiles(port, certPath, keyPath) {
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("FRONTEND_PORT debe ser un entero mayor a 0.");
  }

  if (!fs.existsSync(DIST_ROOT) || !fs.existsSync(INDEX_FILE)) {
    throw new Error("No existe frontend/dist/index.html. Ejecuta npm run build antes de iniciar el frontend.");
  }

  if (!fs.existsSync(certPath)) {
    throw new Error("No se encontro el certificado TLS configurado en TLS_CERT_PATH.");
  }

  if (!fs.existsSync(keyPath)) {
    throw new Error("No se encontro la llave privada configurada en TLS_KEY_PATH.");
  }
}

function buildHttpsOptions(certPath, keyPath) {
  return {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  };
}

function createRequestHandler() {
  return (req, res) => {
    const requestPathname = new URL(req.url || "/", "https://frontend.local").pathname;

    if (shouldProxyApiRequest(requestPathname)) {
      return proxyApiRequest(req, res);
    }

    const absolutePath = resolveAssetPath(req.url || "/");

    if (!absolutePath) {
      return sendResponse(res, 400, "Ruta invalida.");
    }

    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      return serveFile(res, absolutePath);
    }

    if (shouldUseSpaFallback(requestPathname)) {
      return serveFile(res, INDEX_FILE);
    }

    return sendResponse(res, 404, "Recurso no encontrado.");
  };
}

function startServer() {
  const port = Number(requireEnv("FRONTEND_PORT"));
  const certPath = path.resolve(requireEnv("TLS_CERT_PATH"));
  const keyPath = path.resolve(requireEnv("TLS_KEY_PATH"));

  assertStartupFiles(port, certPath, keyPath);

  const server = https.createServer(
    buildHttpsOptions(certPath, keyPath),
    createRequestHandler(),
  );

  server.listen(port, "0.0.0.0", () => {
    console.log(`Frontend HTTPS escuchando en 0.0.0.0:${port}`);
  });
}

startServer();
