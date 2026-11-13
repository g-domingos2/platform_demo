const express = require("express");
const compression = require("compression");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3100; // DEMO: porta própria (localStorage separado da plataforma)
const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "farms.json");
const APP_STATE_FILE = path.join(DATA_DIR, "app-state.json");
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");
const FRONTEND_DATA_DIR = path.join(FRONTEND_DIR, "data");
const FRONTEND_FARMS_FILE = path.join(FRONTEND_DATA_DIR, "farms.json");
const FRONTEND_APP_STATE_FILE = path.join(FRONTEND_DATA_DIR, "app-state.json");
const fsp = fs.promises;

const PIVOT_STATUS_CATALOG = Object.freeze([
  {
    code: "panel_off",
    label: "PAINEL DESLIGADO",
    color: "#f59e0b",
    strokeColor: "#d97706",
    textColor: "#ffffff",
    uiTone: "orange",
    sortOrder: 10,
  },
  {
    code: "preparing_restart",
    label: "PREPARANDO PARA RELIGAR",
    color: "#16a34a",
    strokeColor: "#15803d",
    textColor: "#ffffff",
    uiTone: "green",
    sortOrder: 20,
  },
  {
    code: "irrigating",
    label: "IRRIGANDO",
    color: "#2563eb",
    strokeColor: "#1d4ed8",
    textColor: "#ffffff",
    uiTone: "blue",
    sortOrder: 30,
  },
  {
    code: "problem",
    label: "ALGUM PROBLEMA",
    color: "#ef4444",
    strokeColor: "#dc2626",
    textColor: "#ffffff",
    uiTone: "red",
    sortOrder: 40,
  },
  {
    code: "dry_irrigation",
    label: "IRRIGANDO A SECO",
    color: "#92400e",
    strokeColor: "#78350f",
    textColor: "#ffffff",
    uiTone: "brown",
    sortOrder: 50,
  },
  {
    code: "fertigation",
    label: "FERTIRRIGAÇÃO",
    color: "#6366f1",
    strokeColor: "#4f46e5",
    textColor: "#ffffff",
    uiTone: "purple",
    sortOrder: 60,
  },
]);

async function pathExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch (_) {
    return false;
  }
}

async function ensureJsonMirror(primaryPath, mirrorPath, fallbackContent) {
  await Promise.all([
    fsp.mkdir(path.dirname(primaryPath), { recursive: true }),
    fsp.mkdir(path.dirname(mirrorPath), { recursive: true }),
  ]);

  const [primaryExists, mirrorExists] = await Promise.all([
    pathExists(primaryPath),
    pathExists(mirrorPath),
  ]);

  if (primaryExists && mirrorExists) return;

  if (primaryExists && !mirrorExists) {
    const raw = await fsp.readFile(primaryPath, "utf8");
    await fsp.writeFile(mirrorPath, raw, "utf8");
    return;
  }

  if (!primaryExists && mirrorExists) {
    const raw = await fsp.readFile(mirrorPath, "utf8");
    await fsp.writeFile(primaryPath, raw, "utf8");
    return;
  }

  await Promise.all([
    fsp.writeFile(primaryPath, fallbackContent, "utf8"),
    fsp.writeFile(mirrorPath, fallbackContent, "utf8"),
  ]);
}

async function mirrorJsonFile(sourcePath, targetPath) {
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  const raw = await fsp.readFile(sourcePath, "utf8");
  await fsp.writeFile(targetPath, raw, "utf8");
}

function getPivotStatusCatalog() {
  return PIVOT_STATUS_CATALOG.map((item) => ({ ...item }));
}

async function ensureDataFile() {
  await ensureJsonMirror(DATA_FILE, FRONTEND_FARMS_FILE, "[]\n");
}

function defaultAppState() {
  return {
    energia: {
      contratos: [],
      energia_mensal: [],
      feriados: [],
    },
    talhoesByFarm: {},
    pluviosByFarm: {},
    operacao: {
      activitiesByFarm: {},
      completionCounter: 0,
    },
  };
}

function normalizeAppState(source) {
  const raw = source && typeof source === "object" ? source : {};
  const energia = raw.energia && typeof raw.energia === "object" ? raw.energia : {};
  const talhoesByFarm = raw.talhoesByFarm && typeof raw.talhoesByFarm === "object" && !Array.isArray(raw.talhoesByFarm)
    ? raw.talhoesByFarm
    : {};
  const pluviosByFarm = raw.pluviosByFarm && typeof raw.pluviosByFarm === "object" && !Array.isArray(raw.pluviosByFarm)
    ? raw.pluviosByFarm
    : {};
  const operacao = raw.operacao && typeof raw.operacao === "object" ? raw.operacao : {};
  const activitiesByFarm = operacao.activitiesByFarm && typeof operacao.activitiesByFarm === "object" && !Array.isArray(operacao.activitiesByFarm)
    ? operacao.activitiesByFarm
    : {};
  const normalizeMapOfLists = (value) => Object.fromEntries(
    Object.entries(value).map(([key, items]) => [String(key), Array.isArray(items) ? items : []])
  );
  const completionCounter = Number(operacao.completionCounter);

  return {
    energia: {
      contratos: Array.isArray(energia.contratos) ? energia.contratos : [],
      energia_mensal: Array.isArray(energia.energia_mensal) ? energia.energia_mensal : [],
      feriados: Array.isArray(energia.feriados) ? energia.feriados : [],
    },
    talhoesByFarm: normalizeMapOfLists(talhoesByFarm),
    pluviosByFarm: normalizeMapOfLists(pluviosByFarm),
    operacao: {
      activitiesByFarm: normalizeMapOfLists(activitiesByFarm),
      completionCounter: Number.isFinite(completionCounter) && completionCounter >= 0
        ? Math.floor(completionCounter)
        : 0,
    },
  };
}

async function ensureAppStateFile() {
  await ensureJsonMirror(
    APP_STATE_FILE,
    FRONTEND_APP_STATE_FILE,
    JSON.stringify(defaultAppState(), null, 2) + "\n"
  );
}

// Cache em mem\u00F3ria: os arquivos s\u00E3o garantidos (ensureDataFile/ensureAppStateFile)
// uma \u00FAnica vez na inicializa\u00E7\u00E3o, ent\u00E3o as rotas n\u00E3o precisam tocar o disco a
// cada request \u2014 s\u00F3 leem o cache e persistem em background nas escritas.
let farmsCache = null;
let appStateCache = null;

async function loadFarmsFromDisk() {
  const raw = await fsp.readFile(DATA_FILE, "utf8");
  const normalized = raw.replace(/^\uFEFF/, "");
  if (!normalized.trim()) return [];
  const data = JSON.parse(normalized);
  return Array.isArray(data) ? data : [];
}

async function readFarms() {
  if (farmsCache === null) farmsCache = await loadFarmsFromDisk();
  return farmsCache;
}

async function writeFarms(list) {
  await fsp.writeFile(DATA_FILE, JSON.stringify(list, null, 2) + "\n", "utf8");
  await mirrorJsonFile(DATA_FILE, FRONTEND_FARMS_FILE);
  farmsCache = list;
}

async function loadAppStateFromDisk() {
  const raw = await fsp.readFile(APP_STATE_FILE, "utf8");
  const normalized = raw.replace(/^\uFEFF/, "");
  if (!normalized.trim()) return defaultAppState();
  return normalizeAppState(JSON.parse(normalized));
}

async function readAppState() {
  if (appStateCache === null) appStateCache = await loadAppStateFromDisk();
  return appStateCache;
}

async function writeAppState(state) {
  const normalized = normalizeAppState(state);
  await fsp.writeFile(APP_STATE_FILE, JSON.stringify(normalized, null, 2) + "\n", "utf8");
  await mirrorJsonFile(APP_STATE_FILE, FRONTEND_APP_STATE_FILE);
  appStateCache = normalized;
}

app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  const allowedOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    "https://platform-design.netlify.app"
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Healthcheck (Uptime Bot)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get("/api/farms", async (req, res) => {
  try {
    const farms = await readFarms();
    res.setHeader("Cache-Control", "no-store");
    res.json({
      farms,
      catalogs: {
        pivotStatuses: getPivotStatusCatalog(),
      },
    });
  } catch (err) {
    console.error("Erro na rota /api/farms:", err);
    res.status(500).json({ error: "Falha ao ler farms.json" });
  }
});

app.get("/api/app-state", async (req, res) => {
  try {
    const appState = await readAppState();
    res.setHeader("Cache-Control", "no-store");
    res.json(appState);
  } catch (err) {
    console.error("Erro na rota /api/app-state:", err);
    res.status(500).json({ error: "Falha ao ler app-state.json" });
  }
});

app.get("/api/pivot-statuses", (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({
    pivotStatuses: getPivotStatusCatalog(),
  });
});

app.put("/api/farms", async (req, res) => {
  try {
    const payload = req.body;
    const farms = Array.isArray(payload) ? payload : payload?.farms;
    if (!Array.isArray(farms)) {
      return res.status(400).json({ error: "Payload deve ser um array de fazendas." });
    }
    await writeFarms(farms);
    res.json({
      ok: true,
      farms,
      catalogs: {
        pivotStatuses: getPivotStatusCatalog(),
      },
    });
  } catch (err) {
    console.error("Erro na rota PUT /api/farms:", err);
    res.status(500).json({ error: "Falha ao salvar farms.json" });
  }
});

app.put("/api/app-state", async (req, res) => {
  try {
    const payload = normalizeAppState(req.body);
    await writeAppState(payload);
    res.json({
      ok: true,
      appState: payload,
    });
  } catch (err) {
    console.error("Erro na rota PUT /api/app-state:", err);
    res.status(500).json({ error: "Falha ao salvar app-state.json" });
  }
});

app.delete("/api/farms/:id", async (req, res) => {
  try {
    const farmId = String(req.params.id || "").trim();
    if (!farmId) {
      return res.status(400).json({ error: "ID da fazenda é obrigatório." });
    }
    const farms = await readFarms();
    const nextFarms = farms.filter((f) => String(f?.id || "").trim() !== farmId);
    if (nextFarms.length === farms.length) {
      return res.status(404).json({ error: "Fazenda não encontrada." });
    }
    await writeFarms(nextFarms);
    res.json({ ok: true, farms: nextFarms });
  } catch (err) {
    console.error("Erro na rota DELETE /api/farms/:id:", err);
    res.status(500).json({ error: "Falha ao deletar fazenda." });
  }
});

const STATIC_MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

const staticFileCache = new Map(); // filePath -> { mtimeMs, buffer, mime }

async function serveCachedStatic(req, res, next) {
  if (req.method !== "GET" && req.method !== "HEAD") return next();

  const urlPath = decodeURIComponent(req.path.split("?")[0]);
  const relativePath = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const filePath = path.join(FRONTEND_DIR, relativePath);

  if (!filePath.startsWith(FRONTEND_DIR)) return next();

  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) return next();

    let entry = staticFileCache.get(filePath);
    if (!entry || entry.mtimeMs !== stat.mtimeMs) {
      const buffer = await fsp.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      entry = { mtimeMs: stat.mtimeMs, buffer, mime: STATIC_MIME_TYPES[ext] || "application/octet-stream" };
      staticFileCache.set(filePath, entry);
    }

    res.setHeader("Content-Type", entry.mime);
    // no-cache (não "no-store"): o navegador ainda guarda o arquivo, mas é
    // obrigado a revalidar com o servidor (If-Modified-Since/ETag) antes de
    // usá-lo — request condicional rápida (304 se não mudou), mas garante
    // que um F5 normal sempre pega a versão nova assim que ela é salva no
    // disco, sem precisar de hard refresh.
    res.setHeader("Cache-Control", "no-cache");
    if (req.method === "HEAD") return res.end();
    res.send(entry.buffer);
  } catch (err) {
    if (err?.code === "ENOENT") return next();
    console.error("Erro ao servir arquivo estático:", filePath, err);
    next();
  }
}

app.use(serveCachedStatic);
app.use(express.static(FRONTEND_DIR));

app.get("*", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

// Inicialização com tratamento de erro
async function start() {
  try {
    console.log("--- Iniciando Serviço ---");
    console.log(`Porta: ${PORT}`);
    console.log(`Diretório Raiz: ${ROOT_DIR}`);
    console.log(`Diretório Frontend: ${FRONTEND_DIR}`);

    await Promise.all([ensureDataFile(), ensureAppStateFile()]);
    farmsCache = await loadFarmsFromDisk();
    appStateCache = await loadAppStateFromDisk();

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Servidor pronto e escutando em 0.0.0.0:${PORT}`);
    });

    server.on("error", (err) => {
      if (err?.code === "EADDRINUSE") {
        console.error(`Nao foi possivel iniciar: a porta ${PORT} ja esta em uso.`);
      } else {
        console.error("FALHA AO INICIAR SERVIDOR:", err);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error("FALHA AO INICIAR SERVIDOR:", err);
    process.exit(1);
  }
}

start();
