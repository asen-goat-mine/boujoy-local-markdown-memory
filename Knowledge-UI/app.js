"use strict";

const CONFIG = {
  pollInterval: 2500,
  cardPageSize: 24,
  ignoredDirectories: new Set([
    ".cache", ".codebuddy", ".codex", ".git", ".agents", ".mypy_cache", ".nox",
    ".openai", ".pytest_cache", ".ruff_cache", ".tox", ".venv", ".workbuddy",
    "__pypackages__", "node_modules", "site-packages", "venv", "__pycache__", "99-Logs", "_dist",
  ]),
};

const CATEGORY_MAP = [
  { prefix: "Knowledge-UI/", nav: "system", type: "系统", color: "gray", symbol: "UI" },
  { prefix: "02-Projects/", nav: "projects", type: "项目", color: "blue", symbol: "P" },
  { prefix: "03-Knowledge/", nav: "knowledge", type: "知识", color: "teal", symbol: "K" },
  { prefix: "04-Content/", nav: "content", type: "内容", color: "amber", symbol: "C" },
  { prefix: "05-Prompts/", nav: "prompts", type: "提示词", color: "violet", symbol: "Pr" },
  { prefix: "06-Business/", nav: "business", type: "商业", color: "rose", symbol: "B" },
  { prefix: "90-Archive/", nav: "archive", type: "归档", color: "gray", symbol: "A" },
];

const state = {
  rootHandle: null,
  fallbackFiles: [],
  files: [],
  rawFileCount: 0,
  fingerprint: "",
  serverMode: false,
  serverEtag: "",
  syncing: false,
  watcher: null,
  lastSync: null,
  view: "overview",
  scope: "library",
  search: "",
  visibleCardCount: CONFIG.cardPageSize,
  selectedPath: null,
  currentReaderPath: null,
  atlasFrame: null,
  atlasNodes: [],
  atlasEdges: [],
  atlasPointer: { x: -9999, y: -9999 },
  reduceMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
};

const $ = (selector) => document.querySelector(selector);
const elements = {
  navList: $("#navList"),
  mainEyebrow: $("#mainEyebrow"),
  mainTitle: $("#mainTitle"),
  mainSubtitle: $("#mainSubtitle"),
  syncChip: $("#syncChip"),
  syncLabel: $("#syncLabel"),
  statusDot: $("#statusDot"),
  statusMeter: $("#statusMeter"),
  fileCount: $("#fileCount"),
  vaultPath: $("#vaultPath"),
  connectVault: $("#connectVault"),
  folderFallback: $("#folderFallback"),
  manualRefresh: $("#manualRefresh"),
  healthRefresh: $("#healthRefresh"),
  searchSection: $("#searchSection"),
  searchInput: $("#searchInput"),
  searchShortcut: $("#searchShortcut"),
  filterRow: $("#filterRow"),
  activeQuery: $("#activeQuery"),
  activeQueryText: $("#activeQueryText"),
  clearFilters: $("#clearFilters"),
  overviewView: $("#overviewView"),
  libraryView: $("#libraryView"),
  pipelineView: $("#pipelineView"),
  atlasView: $("#atlasView"),
  healthView: $("#healthView"),
  focusCard: $("#focusCard"),
  pipelinePreview: $("#pipelinePreview"),
  pipelineBoard: $("#pipelineBoard"),
  pipelineSummary: $("#pipelineSummary"),
  overviewCardGrid: $("#overviewCardGrid"),
  overviewResultCount: $("#overviewResultCount"),
  cardsTitle: $("#cardsTitle"),
  resultCount: $("#resultCount"),
  cardGrid: $("#cardGrid"),
  loadMoreRow: $("#loadMoreRow"),
  loadMore: $("#loadMore"),
  emptyState: $("#emptyState"),
  atlasStage: $("#atlasStage"),
  knowledgeGraph: $("#knowledgeGraph"),
  atlasStats: $("#atlasStats"),
  atlasLegend: $("#atlasLegend"),
  atlasTooltip: $("#atlasTooltip"),
  atlasEmpty: $("#atlasEmpty"),
  atlasNodeList: $("#atlasNodeList"),
  healthScore: $("#healthScore"),
  healthGrid: $("#healthGrid"),
  healthActions: $("#healthActions"),
  contextPanel: $("#contextPanel"),
  contextTitle: $("#contextTitle"),
  closeSelection: $("#closeSelection"),
  actionList: $("#actionList"),
  timeline: $("#timeline"),
  tagCloud: $("#tagCloud"),
  lastSync: $("#lastSync"),
  toast: $("#toast"),
  readerDialog: $("#readerDialog"),
  readerType: $("#readerType"),
  readerTitle: $("#readerTitle"),
  readerPath: $("#readerPath"),
  markdownReader: $("#markdownReader"),
  closeReader: $("#closeReader"),
  copyCodex: $("#copyCodex"),
  copyPath: $("#copyPath"),
  revealFile: $("#revealFile"),
};

function normalizePath(path = "") {
  return String(path).replaceAll("\\", "/").replace(/^\/+/, "");
}

function resolveVaultPath(basePath, target) {
  let clean = String(target || "").trim().replace(/^<|>$/gu, "").split("#")[0].split("?")[0];
  try { clean = decodeURIComponent(clean); } catch { /* keep encoded input */ }
  if (!clean) return normalizePath(basePath);
  const stack = clean.startsWith("/") ? [] : normalizePath(basePath).split("/").slice(0, -1);
  for (const part of clean.replace(/^\/+/, "").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return normalizePath(stack.join("/"));
}

function isIgnoredPath(path) {
  const parts = normalizePath(path).split("/");
  return parts.slice(0, -1).some((part) => CONFIG.ignoredDirectories.has(part));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stripMarkdown(text = "") {
  return String(text)
    .replace(/^---[\s\S]*?---\s*/u, "")
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
    .replace(/<[^>]+>/gu, " ")
    .replace(/[#>*_`~|]/gu, " ")
    .replace(/^\s*(?:[-+] |\d+[.)、]\s+)/gmu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function readFrontmatter(text) {
  const match = String(text).match(/^---\s*\n([\s\S]*?)\n---/u);
  if (!match) return {};
  return match[1].split(/\r?\n/u).reduce((result, line) => {
    const separator = line.indexOf(":");
    if (separator < 1 || /^\s/u.test(line)) return result;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value.slice(1, -1).split(",").map((item) => item.trim().replace(/^["']|["']$/gu, "")).filter(Boolean);
    } else {
      value = value.replace(/^["']|["']$/gu, "");
    }
    result[key] = value;
    return result;
  }, {});
}

function termList(raw) {
  if (Array.isArray(raw)) return raw.flatMap((item) => termList(item));
  if (typeof raw !== "string") return [];
  return raw.split(/[,，、;；\n]+/u).map((item) => item.replace(/^\s*[-*+]\s*/u, "").replace(/^#/u, "").trim()).filter(Boolean);
}

function sectionLines(text, titles) {
  const titleSet = new Set(titles.map((title) => title.toLocaleLowerCase("zh-CN")));
  const lines = String(text).split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const heading = lines[index].match(/^#{1,3}\s*(.+?)\s*$/u);
    if (!heading || !titleSet.has(heading[1].toLocaleLowerCase("zh-CN"))) continue;
    const collected = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (/^#{1,3}\s+/u.test(lines[cursor])) break;
      collected.push(lines[cursor]);
    }
    return collected;
  }
  return [];
}

function sectionText(text, titles) {
  return stripMarkdown(sectionLines(text, titles).join("\n"));
}

function sectionList(text, titles) {
  const output = [];
  sectionLines(text, titles).forEach((line) => {
    const match = line.match(/^\s*[-*+]\s+(?:\[[ xX]\]\s*)?(.+?)\s*$/u);
    if (match) output.push(...termList(match[1]));
  });
  return output;
}

function extractTitle(text, path, frontmatter) {
  if (frontmatter.title) return String(frontmatter.title);
  const heading = String(text).match(/^#\s+(.+)$/mu);
  if (heading) return stripMarkdown(heading[1]);
  return normalizePath(path).split("/").at(-1).replace(/\.md$/iu, "").replaceAll("-", " ");
}

function getCategory(path) {
  const normalized = normalizePath(path);
  return CATEGORY_MAP.find((category) => normalized.startsWith(category.prefix)) || {
    nav: "system", type: "系统", color: "gray", symbol: "M",
  };
}

function inferVisibility(path, frontmatter, category) {
  const explicit = String(frontmatter.visibility || "").toLocaleLowerCase("en-US");
  if (["library", "technical", "archive"].includes(explicit)) return explicit;
  const normalized = normalizePath(path);
  const name = normalized.split("/").at(-1).toLocaleLowerCase("en-US");
  if (category.nav === "archive" || normalized.startsWith("90-Archive/")) return "archive";
  if (normalized === "Knowledge-UI/README.md") return "technical";
  const technicalName = /(?:^readme|report|qa|brief|template|storyboard|alignment|changelog|checklist|preflight|audit|manual)/iu.test(name);
  const technicalPath = /\/(?:work|input|qa|reports?|docs?|references?|scripts?|assets?|templates?|tests?)\//iu.test(`/${normalized}`);
  if (technicalName || technicalPath) return "technical";
  return "library";
}

function extractTags(text, frontmatter, category) {
  const tags = new Set();
  termList(frontmatter.tags).forEach((tag) => tags.add(tag));
  sectionList(text, ["相关标签", "标签", "Tags"]).forEach((tag) => tags.add(tag));
  for (const match of String(text).matchAll(/(?:^|\s)#([\p{L}\p{N}_-]{2,28})/gu)) {
    tags.add(match[1]);
    if (tags.size >= 8) break;
  }
  tags.add(category.type);
  return [...tags].slice(0, 8);
}

function extractAliases(text, frontmatter) {
  const aliases = new Set();
  [frontmatter.aliases, frontmatter.alias, frontmatter.keywords].forEach((raw) => termList(raw).forEach((term) => aliases.add(term)));
  sectionList(text, ["别名", "关键词", "触发词", "相关词", "Aliases"]).forEach((term) => aliases.add(term));
  return [...aliases].slice(0, 32);
}

function localDateFromTimestamp(timestamp) {
  const date = new Date(timestamp);
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function extractUpdated(text, frontmatter, file) {
  const declared = frontmatter.updated || frontmatter.date || frontmatter.modified;
  const declaredMatch = String(declared || "").match(/\d{4}-\d{2}-\d{2}/u);
  if (declaredMatch) return declaredMatch[0];
  const inline = String(text).match(/更新时间[：:]\s*(?:\*\*)?(\d{4}-\d{2}-\d{2})/u);
  if (inline) return inline[1];
  return localDateFromTimestamp(file.lastModified);
}

function extractActionItems(text) {
  const actionTitles = ["后续行动", "下一步", "Next", "Next action", "Next actions"];
  const lines = sectionLines(text, actionTitles);
  const items = [];
  lines.forEach((line) => {
    const task = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/u);
    const bullet = line.match(/^\s*(?:[-*+]|\d+[.)、])\s+(.+)$/u);
    if (task) items.push({ text: stripMarkdown(task[2]), done: /x/iu.test(task[1]) });
    else if (bullet) items.push({ text: stripMarkdown(bullet[1]), done: false });
  });
  if (!items.length) {
    sectionText(text, actionTitles).split(/[。；;\n]+/u).map((line) => line.trim()).filter((line) => line.length > 2).forEach((line) => items.push({ text: line, done: false }));
  }
  return items.slice(0, 8);
}

function createRecord(path, text, file) {
  const normalizedPath = normalizePath(path);
  const frontmatter = readFrontmatter(text);
  const category = getCategory(normalizedPath);
  const title = extractTitle(text, normalizedPath, frontmatter);
  const body = stripMarkdown(text);
  const conclusion = sectionText(text, ["一句话结论", "结论", "摘要", "One-sentence conclusion", "Summary"]);
  return {
    path: normalizedPath,
    text,
    frontmatter,
    title,
    excerpt: (conclusion || body.replace(title, "").trim() || "Markdown 文件").slice(0, 180),
    category,
    role: String(frontmatter.role || category.nav),
    status: String(frontmatter.status || ""),
    visibility: inferVisibility(normalizedPath, frontmatter, category),
    tags: extractTags(text, frontmatter, category),
    aliases: extractAliases(text, frontmatter),
    updated: extractUpdated(text, frontmatter, file),
    lastModified: file.lastModified,
    size: file.size,
    contentHash: String(file.contentHash || ""),
    actions: extractActionItems(text),
  };
}

function contentFingerprint(record) {
  const normalized = record.text.replace(/^---[\s\S]*?---\s*/u, "").replace(/\r\n?/gu, "\n").replace(/[ \t]+/gu, " ").replace(/\n{3,}/gu, "\n\n").trim().toLocaleLowerCase("zh-CN");
  return `${record.title.trim().toLocaleLowerCase("zh-CN")}\u241f${normalized}`;
}

function dedupeRecords(records) {
  const unique = new Map();
  const ordered = [...records].sort((a, b) => b.lastModified - a.lastModified || a.path.length - b.path.length);
  for (const record of ordered) {
    const key = contentFingerprint(record);
    const existing = unique.get(key);
    if (existing) {
      existing.duplicateCount += 1;
      existing.duplicatePaths.push(record.path);
    } else {
      unique.set(key, { ...record, duplicateCount: 1, duplicatePaths: [record.path] });
    }
  }
  return [...unique.values()].sort((a, b) => b.lastModified - a.lastModified);
}

async function walkDirectory(handle, prefix = "", output = []) {
  const entries = [];
  for await (const entry of handle.values()) entries.push(entry);
  entries.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === "directory") {
      if (!CONFIG.ignoredDirectories.has(entry.name)) await walkDirectory(entry, path, output);
      continue;
    }
    if (!entry.name.toLocaleLowerCase("en-US").endsWith(".md")) continue;
    const file = await entry.getFile();
    output.push(createRecord(path, await file.text(), file));
  }
  return output;
}

function recordsFromFallback(fileList) {
  return Promise.all([...fileList]
    .filter((file) => file.name.toLocaleLowerCase("en-US").endsWith(".md") && !isIgnoredPath(file.webkitRelativePath || file.name))
    .map(async (file) => {
      const relative = normalizePath(file.webkitRelativePath || file.name);
      const parts = relative.split("/");
      return createRecord(parts.length > 1 ? parts.slice(1).join("/") : relative, await file.text(), file);
    }));
}

function makeFingerprint(records) {
  return records.map((record) => `${record.path}:${record.lastModified}:${record.size}:${record.contentHash}`).sort().join("|");
}

async function readServerVault({ force = false, announce = false } = {}) {
  const response = await fetch(`/api/vault?t=${Date.now()}`, {
    cache: "no-store",
    headers: !force && state.serverEtag ? { "If-None-Match": state.serverEtag } : {},
  });
  if (response.status === 304) {
    state.serverMode = true;
    state.lastSync = new Date();
    elements.lastSync.textContent = formatTime(state.lastSync);
    setSyncState("live", "本地同步中");
    return;
  }
  if (!response.ok) throw new Error(`Vault server returned ${response.status}`);
  const payload = await response.json();
  state.serverEtag = response.headers.get("ETag") || "";
  const records = payload.files.map((file) => createRecord(file.path, file.text, file));
  const fingerprint = makeFingerprint(records);
  if (!force && fingerprint === state.fingerprint) return;
  state.serverMode = true;
  state.rawFileCount = records.length;
  state.files = dedupeRecords(records);
  state.fingerprint = fingerprint;
  state.lastSync = new Date();
  elements.vaultPath.dataset.serverName = payload.root || "Local Markdown Memory";
  renderAll();
  setSyncState("live", "本地同步中");
  if (announce) announceRead();
}

function announceRead() {
  const folded = Math.max(0, state.rawFileCount - state.files.length);
  showToast(folded ? `已读取 ${state.rawFileCount} 个文件，折叠 ${folded} 个重复副本。` : `已读取 ${state.rawFileCount} 个 Markdown 文件。`);
}

async function bootstrapLocalServer() {
  if (!/^https?:$/u.test(window.location.protocol)) return false;
  try {
    await readServerVault({ force: true, announce: true });
    startWatcher();
    return true;
  } catch { return false; }
}

async function connectVault() {
  if (state.serverMode) return readServerVault({ force: true, announce: true });
  if (!("showDirectoryPicker" in window)) {
    elements.folderFallback.click();
    showToast("兼容模式需要重新选择文件夹才能刷新。");
    return;
  }
  try {
    state.rootHandle = await window.showDirectoryPicker({ mode: "read" });
    state.fallbackFiles = [];
    await refreshVault({ force: true, announce: true });
    startWatcher();
  } catch (error) {
    if (error.name !== "AbortError") showToast("无法读取文件夹，请检查浏览器权限。");
  }
}

async function refreshVault({ force = false, announce = false } = {}) {
  if (state.syncing) return;
  if (!state.rootHandle && !state.fallbackFiles.length) return showToast("请先选择知识库文件夹。");
  state.syncing = true;
  setSyncState("syncing", "正在检查更新");
  try {
    const records = state.rootHandle ? await walkDirectory(state.rootHandle) : await recordsFromFallback(state.fallbackFiles);
    const fingerprint = makeFingerprint(records);
    if (force || fingerprint !== state.fingerprint) {
      state.rawFileCount = records.length;
      state.files = dedupeRecords(records);
      state.fingerprint = fingerprint;
      state.lastSync = new Date();
      if (state.selectedPath && !state.files.some((record) => record.path === state.selectedPath)) state.selectedPath = null;
      renderAll();
      if (announce) announceRead();
      else if (!force) showToast("检测到文件变化，界面已更新。");
    }
    setSyncState("live", state.rootHandle ? "自动同步中" : "手动刷新");
  } catch (error) {
    console.error(error);
    setSyncState("error", "读取失败");
    showToast("读取知识库失败，请重新选择文件夹。");
  } finally { state.syncing = false; }
}

function startWatcher() {
  if (state.watcher) window.clearInterval(state.watcher);
  if (state.serverMode) state.watcher = window.setInterval(() => readServerVault().catch(() => setSyncState("error", "同步暂停")), CONFIG.pollInterval);
  else if (state.rootHandle) state.watcher = window.setInterval(() => refreshVault(), CONFIG.pollInterval);
}

function setSyncState(mode, label) {
  elements.syncChip.dataset.state = mode;
  elements.syncChip.classList.toggle("is-live", mode === "live");
  elements.syncChip.classList.toggle("is-syncing", mode === "syncing");
  elements.syncLabel.textContent = label;
}

function scopeAllows(record, scope = state.scope) {
  if (scope === "all") return true;
  if (scope === "library") return record.visibility === "library" && record.category.nav !== "system";
  if (scope === "projects") return record.category.nav === "projects" && record.visibility !== "archive";
  return record.category.nav === scope && record.visibility === "library";
}

function searchMatch(record, tokens, fullQuery) {
  if (!tokens.length) return { score: 0, reason: "" };
  const fields = [
    ["标题", record.title, 100], ["别名", record.aliases.join(" "), 70], ["标签", record.tags.join(" "), 45],
    ["路径", record.path, 25], ["摘要", record.excerpt, 15], ["正文", record.text, 5],
  ].map(([label, value, weight]) => [label, String(value).toLocaleLowerCase("zh-CN"), weight]);
  if (!tokens.every((token) => fields.some(([, value]) => value.includes(token)))) return null;
  let score = 0;
  let reason = "正文";
  let strongest = -1;
  fields.forEach(([label, value, weight]) => {
    const hits = tokens.filter((token) => value.includes(token)).length;
    if (hits) score += hits * weight;
    if (hits && weight > strongest) { strongest = weight; reason = label; }
    if (fullQuery && value.includes(fullQuery)) score += Math.round(weight * 0.8);
  });
  return { score, reason };
}

function filteredRecords(scope = state.scope) {
  const query = state.search.trim().toLocaleLowerCase("zh-CN");
  const tokens = query.replace(/[^\p{L}\p{N}_+.#-]+/gu, " ").split(/\s+/u).filter(Boolean);
  return state.files.map((record) => {
    if (!scopeAllows(record, scope)) return null;
    const match = searchMatch(record, tokens, query);
    return match ? { record, ...match } : null;
  }).filter(Boolean).sort((a, b) => b.score - a.score || b.record.lastModified - a.record.lastModified);
}

function updateScopeControls() {
  elements.filterRow.querySelectorAll("[data-scope]").forEach((button) => {
    const active = button.dataset.scope === state.scope;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const labels = { library: "精选", projects: "项目", knowledge: "知识", content: "内容", prompts: "提示词", business: "商业", all: "全部文件" };
  const conditions = [];
  if (state.scope !== "library") conditions.push(`范围：${labels[state.scope] || state.scope}`);
  if (state.search.trim()) conditions.push(`搜索：${state.search.trim()}`);
  elements.activeQuery.hidden = conditions.length === 0;
  elements.activeQueryText.textContent = conditions.join(" · ");
}

function renderAll() {
  renderStatus();
  renderFocus();
  renderPipeline();
  renderCards();
  renderGlobalContext();
  renderHealth();
  renderView();
}

function renderStatus() {
  const raw = state.rawFileCount || state.files.length;
  const folded = Math.max(0, raw - state.files.length);
  elements.fileCount.textContent = folded ? `${state.files.length} 条内容 · ${folded} 份已折叠` : `${raw} 个 Markdown 文件`;
  elements.vaultPath.textContent = state.serverMode ? (elements.vaultPath.dataset.serverName || "Local Markdown Memory") : (state.rootHandle?.name || "已通过兼容模式读取");
  elements.statusDot.classList.toggle("is-live", Boolean(state.files.length));
  if (elements.statusMeter) elements.statusMeter.style.width = state.files.length ? "100%" : "12%";
  elements.connectVault.textContent = "重新选择文件夹";
  elements.lastSync.textContent = formatTime(state.lastSync);
}

function currentProjectRecord() {
  const active = state.files.find((record) => record.path === "00-System/Active-Context.md");
  const dashboard = state.files.find((record) => record.path === "DASHBOARD.md");
  const explicitPath = String(active?.frontmatter?.project_path || "").trim();
  if (explicitPath) {
    const exact = state.files.find((record) => record.path === normalizePath(explicitPath));
    if (exact) return exact;
  }
  const projects = state.files.filter((record) => record.category.nav === "projects" && record.visibility === "library").sort((a, b) => b.lastModified - a.lastModified);
  const explicitName = (active?.text || dashboard?.text || "").match(/\*\*项目\*\*[：:]\s*([^\n]+)/u)?.[1]?.replace(/[。.\s]+$/u, "");
  if (explicitName && !/暂无/u.test(explicitName)) {
    const named = projects.find((record) => record.title.includes(explicitName));
    if (named) return named;
  }
  return projects[0] || active || dashboard || state.files[0];
}

function renderFocus() {
  const record = currentProjectRecord();
  if (!record) return;
  const active = state.files.find((item) => item.path === "00-System/Active-Context.md");
  const actions = active?.actions?.slice(0, 2) || [];
  elements.focusCard.innerHTML = `
    <div class="focus-project">
      <span class="project-symbol">${escapeHtml(record.category.symbol)}</span>
      <div><span class="focus-status">${escapeHtml(record.status || "进行中")}</span><h3>${escapeHtml(record.title)}</h3><p>${escapeHtml(record.excerpt)}</p>
        ${actions.length ? `<div class="focus-next"><strong>下一步</strong>${actions.map((item) => `<span>${item.done ? "已完成" : "待处理"} · ${escapeHtml(item.text)}</span>`).join("")}</div>` : ""}
      </div>
    </div>
    <button class="primary-button" data-open="${escapeHtml(record.path)}">打开项目上下文</button>`;
  elements.focusCard.querySelector("[data-open]")?.addEventListener("click", () => selectRecord(record.path, true));
}

function parseTableRows(lines) {
  const tableStart = lines.findIndex((line, index) => line.includes("|") && /^\s*\|?\s*:?-{3,}/u.test(lines[index + 1] || ""));
  if (tableStart < 0) return [];
  const split = (line) => line.trim().replace(/^\||\|$/gu, "").split("|").map((cell) => cell.trim());
  const headers = split(lines[tableStart]);
  const rows = [];
  for (let index = tableStart + 2; index < lines.length && lines[index].includes("|"); index += 1) {
    const cells = split(lines[index]);
    if (cells.some(Boolean)) rows.push(Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] || ""])));
  }
  return rows;
}

function cellLink(cell) {
  const match = String(cell).match(/\[([^\]]+)\]\(([^)]+)\)/u);
  return match ? { label: stripMarkdown(match[1]), path: normalizePath(match[2].split("#")[0]) } : null;
}

function stageState(cell, linked) {
  const plain = stripMarkdown(cell);
  if (/待补|暂无|待开始|尚未|未创建|以官方资料核验|not created|not started|missing|none|todo/iu.test(plain)) return "missing";
  if (/完整链路|完成|终版|发布|已有|complete|completed|done|delivered|published/iu.test(plain) || linked) return "done";
  return plain ? "progress" : "missing";
}

function pipelineStatusComplete(status) {
  return /完整链路|已贯通|完成|终版|发布|complete|completed|done|delivered|published/iu.test(String(status || ""));
}

function pipelineData() {
  const dashboard = state.files.find((record) => record.path === "DASHBOARD.md");
  if (!dashboard) return [];
  return parseTableRows(sectionLines(dashboard.text, ["Delivery pipeline", "交付管线", "内容生产链"])).map((row) => {
    const knowledgeCell = row["Knowledge / source"] || row["资料 / 知识"] || row["技术知识"] || "";
    const copyCell = row["Draft"] || row["草稿"] || "";
    const deliverableCell = row["Deliverable"] || row["交付物"] || "";
    const knowledgeLink = cellLink(knowledgeCell);
    const copyLink = cellLink(copyCell);
    const deliverableLink = cellLink(deliverableCell);
    return {
      topic: stripMarkdown(row["Topic"] || row["主题"] || "未命名主题"),
      status: stripMarkdown(row["Status"] || row["当前状态"] || ""),
      stages: [
        { label: "资料 / 知识", text: stripMarkdown(knowledgeCell), link: knowledgeLink, state: stageState(knowledgeCell, knowledgeLink) },
        { label: "草稿", text: stripMarkdown(copyCell), link: copyLink, state: stageState(copyCell, copyLink) },
        { label: "交付物", text: stripMarkdown(deliverableCell), link: deliverableLink, state: stageState(deliverableCell, deliverableLink) },
      ],
    };
  });
}

function renderPipeline() {
  const items = pipelineData();
  const completed = items.filter((item) => pipelineStatusComplete(item.status)).length;
  elements.pipelineSummary.textContent = `${completed} 条完整链路 · ${items.length} 个主题`;
  elements.pipelinePreview.innerHTML = items.slice(0, 4).map((item) => {
    const done = item.stages.filter((stage) => stage.state === "done").length;
    return `<button class="pipeline-mini" data-topic="${escapeHtml(item.topic)}"><strong>${escapeHtml(item.topic)}</strong><span>${done}/3 阶段具备</span><i><b style="width:${Math.round(done / 3 * 100)}%"></b></i></button>`;
  }).join("") || `<p class="muted">Dashboard 暂无生产链数据。</p>`;
  elements.pipelineBoard.innerHTML = items.map((item) => `
    <article class="pipeline-row">
      <header><div><h3>${escapeHtml(item.topic)}</h3><p>${escapeHtml(item.status)}</p></div><span class="pipeline-state ${pipelineStatusComplete(item.status) ? "is-complete" : ""}">${pipelineStatusComplete(item.status) ? "已贯通" : "推进中"}</span></header>
      <div class="pipeline-stages">${item.stages.map((stage) => {
        const content = `<span class="stage-dot"></span><div><strong>${escapeHtml(stage.label)}</strong><small>${escapeHtml(stage.text || "尚未登记")}</small></div>`;
        return stage.link ? `<button class="pipeline-stage is-${stage.state}" data-open="${escapeHtml(stage.link.path)}">${content}</button>` : `<div class="pipeline-stage is-${stage.state}">${content}</div>`;
      }).join("")}</div>
    </article>`).join("");
  elements.pipelineBoard.querySelectorAll("[data-open]").forEach((button) => button.addEventListener("click", () => selectRecord(button.dataset.open, true)));
  elements.pipelinePreview.querySelectorAll("[data-topic]").forEach((button) => button.addEventListener("click", () => setView("pipeline")));
}

function cardMarkup(item, index = 0) {
  const { record, reason } = item;
  const visibility = record.visibility === "technical" ? "技术文件" : record.visibility === "archive" ? "归档" : "";
  return `<article class="knowledge-card${record.path === state.selectedPath ? " is-selected" : ""}" data-path="${escapeHtml(record.path)}" tabindex="0" role="button" aria-label="打开 ${escapeHtml(record.title)}" style="--delay:${Math.min(index * 28, 220)}ms">
    <div class="card-top"><span class="card-icon ${record.category.color}">${escapeHtml(record.category.symbol)}</span><span class="card-type">${escapeHtml(record.frontmatter.type || record.category.type)}</span>${visibility ? `<span class="visibility-chip">${visibility}</span>` : ""}</div>
    <h3>${escapeHtml(record.title)}</h3><p>${escapeHtml(record.excerpt)}</p>
    ${reason ? `<span class="match-reason">命中：${escapeHtml(reason)}</span>` : ""}
    <footer><div class="tag-row">${record.tags.slice(0, 2).map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("")}</div><time datetime="${escapeHtml(record.updated)}"><span>更新</span>${escapeHtml(record.updated)}</time></footer>
  </article>`;
}

function bindCards(container) {
  container.querySelectorAll("[data-path]").forEach((card) => {
    const open = () => selectRecord(card.dataset.path, true);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
    });
  });
}

function renderCards() {
  updateScopeControls();
  const all = filteredRecords();
  const visible = all.slice(0, state.visibleCardCount);
  const remaining = Math.max(0, all.length - visible.length);
  const scopeLabels = { library: "精选内容", projects: "项目", knowledge: "知识库", content: "内容", prompts: "提示词", business: "商业", all: "全部文件" };
  elements.cardsTitle.textContent = scopeLabels[state.scope] || "内容";
  elements.resultCount.textContent = `${all.length} 条结果 · 已展示 ${visible.length}`;
  elements.cardGrid.innerHTML = visible.map(cardMarkup).join("");
  elements.cardGrid.hidden = !all.length;
  elements.emptyState.hidden = Boolean(all.length);
  elements.loadMoreRow.hidden = remaining === 0;
  elements.loadMore.textContent = `再加载 ${Math.min(CONFIG.cardPageSize, remaining)} 条`;
  bindCards(elements.cardGrid);

  const overviewItems = filteredRecords("library").slice(0, 6);
  elements.overviewResultCount.textContent = `${overviewItems.length} 条`;
  elements.overviewCardGrid.innerHTML = overviewItems.map(cardMarkup).join("");
  bindCards(elements.overviewCardGrid);
}

const VIEW_COPY = {
  overview: ["LOCAL-FIRST KNOWLEDGE", "你的第二大脑", "项目、知识与方法，在一个本地空间持续生长。"],
  library: ["知识检索", "找到可以复用的内容", "一套范围筛选，不让分类条件互相打架。"],
  pipeline: ["交付管线", "从资料走到交付", "看见每个主题所处阶段和缺失环节。"],
  atlas: ["关系探索", "知识全景", "用真实引用连接分散的 Markdown。"],
  health: ["只读诊断", "健康中心", "快速确认索引、规则和待整理事项。"],
};

function setView(view, scope) {
  state.view = view;
  if (scope) state.scope = scope;
  state.visibleCardCount = CONFIG.cardPageSize;
  state.selectedPath = null;
  renderView();
  if (view === "library" || view === "overview") renderCards();
  if (view === "atlas") renderAtlas();
  renderGlobalContext();
}

function renderView() {
  ["overview", "library", "pipeline", "atlas", "health"].forEach((view) => {
    elements[`${view}View`].hidden = state.view !== view;
  });
  const copy = VIEW_COPY[state.view] || VIEW_COPY.overview;
  [elements.mainEyebrow.textContent, elements.mainTitle.textContent, elements.mainSubtitle.textContent] = copy;
  const special = ["pipeline", "atlas", "health"].includes(state.view);
  elements.searchSection.hidden = special;
  document.body.classList.toggle("context-hidden", special);
  elements.navList.querySelectorAll(".nav-item").forEach((button) => {
    const active = button.dataset.view === state.view && (state.view !== "library" || button.dataset.scope === state.scope);
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
  });
  updateScopeControls();
  if (state.view !== "atlas" && state.atlasFrame) {
    cancelAnimationFrame(state.atlasFrame);
    state.atlasFrame = null;
  }
}

function healthMetrics() {
  const index = state.files.find((record) => record.path === "00-System/Index-Health.md");
  const cleanup = state.files.find((record) => record.path === "00-System/Cleanup-Candidates.md");
  const queue = state.files.find((record) => record.path === "00-System/Memory-Queue.md");
  const active = state.files.find((record) => record.path === "00-System/Active-Context.md");
  const numberAfter = (text, label) => Number(String(text || "").match(new RegExp(`(?:${label})\\s*\\|\\s*(\\d+)`, "iu"))?.[1] || 0);
  const missing = numberAfter(index?.text, "Missing index paths|失效索引路径");
  const paths = numberAfter(index?.text, "Checked index paths|已检查索引路径");
  const topics = numberAfter(index?.text, "Memory-Index topics|全局索引主题");
  const cleanupRows = parseTableRows(sectionLines(cleanup?.text || "", ["摘要", "Summary"]));
  const cleanupItems = cleanupRows.map((row) => ({ label: stripMarkdown(row["类别"] || row["Category"] || "待整理"), count: Number(stripMarkdown(row["数量"] || row["Count"] || "0")) || 0 }));
  const cleanupTotal = cleanupItems.reduce((sum, item) => sum + item.count, 0);
  const queueText = queue?.text || "";
  const queueEmpty = /当前(?:队列)?[^\n]*(?:暂无|无候选)|no candidates|queue is empty/iu.test(queueText);
  const queueCount = queueEmpty ? 0 : sectionLines(queueText, ["当前队列", "Current queue", "Candidates"]).filter((line) => /^\s*[-*+]\s+/u.test(line)).length;
  const rulesReady = ["AGENTS.md", "00-System/Boot.md", "00-System/Hot-Index.md", "00-System/Memory-Index.md"].every((path) => state.files.some((record) => record.path === path));
  const previewReady = state.files.some((record) => record.path === "Knowledge-UI/README.md");
  return { index, cleanup, queue, active, missing, paths, topics, cleanupItems, cleanupTotal, queueCount, rulesReady, previewReady };
}

function renderHealth() {
  const data = healthMetrics();
  const checks = [data.missing === 0, data.queueCount === 0, data.rulesReady, data.previewReady];
  const passed = checks.filter(Boolean).length;
  elements.healthScore.innerHTML = `<div class="score-ring" style="--score:${passed / checks.length * 100}"><strong>${passed}/${checks.length}</strong></div><div><span class="health-label">${passed === checks.length ? "核心系统可用" : "有项目需要确认"}</span><h3>${data.missing === 0 ? "索引完整，工作流已就绪" : `${data.missing} 条索引路径失效`}</h3><p>健康中心只汇总现有报告，不执行清理或写回。</p></div>`;
  const cards = [
    { title: "索引完整性", value: data.missing === 0 ? "正常" : `${data.missing} 条失效`, detail: `${data.topics} 个主题 · ${data.paths} 条路径`, state: data.missing === 0 ? "good" : "warn", path: data.index?.path },
    { title: "记忆候选", value: `${data.queueCount} 条`, detail: data.queueCount ? "等待价值判断" : "当前队列为空", state: data.queueCount ? "warn" : "good", path: data.queue?.path },
    { title: "核心规则", value: data.rulesReady ? "已加载" : "缺失", detail: "AGENTS · Boot · Hot Index · Memory Index", state: data.rulesReady ? "good" : "warn", path: data.active?.path },
    { title: "预览入口", value: data.previewReady ? "可用" : "缺失", detail: "macOS · Windows · Linux · 浏览器兼容模式", state: data.previewReady ? "good" : "warn", path: data.active?.path },
    { title: "清理候选", value: `${data.cleanupTotal} 项`, detail: data.cleanupItems.slice(0, 3).map((item) => `${item.label} ${item.count}`).join(" · "), state: data.cleanupTotal ? "neutral" : "good", path: data.cleanup?.path },
  ];
  elements.healthGrid.innerHTML = cards.map((card) => `<button class="health-card is-${card.state}" ${card.path ? `data-open="${escapeHtml(card.path)}"` : "disabled"}><span class="health-dot"></span><div><span>${escapeHtml(card.title)}</span><strong>${escapeHtml(card.value)}</strong><p>${escapeHtml(card.detail)}</p></div><span class="health-arrow">→</span></button>`).join("");
  const activeActions = (data.active?.actions || []).slice(0, 4);
  const cleanupAction = data.cleanupTotal ? { text: `查看 ${data.cleanupTotal} 项清理候选，确认后再处理`, done: false, path: data.cleanup?.path } : null;
  const actions = [...activeActions, ...(cleanupAction ? [cleanupAction] : [])];
  elements.healthActions.innerHTML = actions.map((item) => `<button class="health-action" ${item.path ? `data-open="${escapeHtml(item.path)}"` : ""}><span class="task-box ${item.done ? "is-done" : ""}">${item.done ? "✓" : ""}</span><strong>${escapeHtml(item.text)}</strong><span>→</span></button>`).join("") || `<p class="muted">目前没有需要处理的系统事项。</p>`;
  [...elements.healthGrid.querySelectorAll("[data-open]"), ...elements.healthActions.querySelectorAll("[data-open]")].forEach((button) => button.addEventListener("click", () => selectRecord(button.dataset.open, true)));
}

function selectRecord(path, openReader = true) {
  const normalized = normalizePath(path);
  const record = state.files.find((item) => item.path === normalized);
  if (!record) { showToast(`未找到知识库文件：${normalized}`); return; }
  state.selectedPath = record.path;
  renderSelectedContext(record);
  elements.contextPanel.classList.add("has-selection");
  if (state.view === "library" || state.view === "overview") renderCards();
  if (openReader) showReader(record);
}

function renderSelectedContext(record) {
  elements.contextTitle.textContent = record.title;
  elements.closeSelection.hidden = false;
  const actions = record.actions.length ? record.actions.slice(0, 4) : [{ text: record.excerpt, done: false }];
  elements.actionList.innerHTML = actions.map((item) => `<button class="action-item" data-reader="${escapeHtml(record.path)}"><span class="task-box ${item.done ? "is-done" : ""}">${item.done ? "✓" : ""}</span><div><strong>${escapeHtml(item.text)}</strong><small>${item.done ? "已完成" : "待处理"}</small></div></button>`).join("");
  elements.actionList.querySelectorAll("[data-reader]").forEach((button) => button.addEventListener("click", () => showReader(record)));
  elements.timeline.innerHTML = `<div class="timeline-item"><span class="timeline-dot is-accent"></span><div><strong>最后更新</strong><small>${escapeHtml(record.updated)}</small></div></div><div class="timeline-item"><span class="timeline-dot"></span><div><strong>${escapeHtml(record.frontmatter.type || record.category.type)}</strong><small>${escapeHtml(record.path)}</small></div></div>`;
  renderTagCloud(record.tags);
}

function renderGlobalContext() {
  if (state.selectedPath) {
    const selected = state.files.find((record) => record.path === state.selectedPath);
    if (selected) { renderSelectedContext(selected); return; }
    state.selectedPath = null;
  }
  elements.contextPanel.classList.remove("has-selection");
  elements.contextTitle.textContent = "当前工作";
  elements.closeSelection.hidden = true;
  const active = state.files.find((record) => record.path === "00-System/Active-Context.md");
  const actions = (active?.actions || []).slice(0, 4);
  elements.actionList.innerHTML = actions.map((item) => `<div class="action-item"><span class="task-box ${item.done ? "is-done" : ""}">${item.done ? "✓" : ""}</span><div><strong>${escapeHtml(item.text)}</strong><small>${item.done ? "已完成" : "来自当前上下文"}</small></div></div>`).join("") || `<p class="muted">连接知识库后显示下一步。</p>`;
  const recent = filteredRecords("library").slice(0, 5).map((item) => item.record);
  elements.timeline.innerHTML = recent.map((record, index) => `<button class="timeline-item" data-path="${escapeHtml(record.path)}"><span class="timeline-dot${index === 0 ? " is-accent" : ""}"></span><div><strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(record.updated)} · ${escapeHtml(record.category.type)}</small></div></button>`).join("");
  elements.timeline.querySelectorAll("[data-path]").forEach((button) => button.addEventListener("click", () => selectRecord(button.dataset.path, true)));
  renderTagCloud(collectTopTags(filteredRecords("library").map((item) => item.record), 10));
}

function renderTagCloud(tags) {
  elements.tagCloud.innerHTML = tags.map((tag) => `<button data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`).join("");
  elements.tagCloud.querySelectorAll("[data-tag]").forEach((button) => button.addEventListener("click", () => {
    state.search = button.dataset.tag;
    state.scope = "library";
    elements.searchInput.value = state.search;
    setView("library", "library");
  }));
}

function collectTopTags(records, limit) {
  const counts = new Map();
  records.forEach((record) => record.tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([tag]) => tag);
}

function renderInline(raw, recordPath) {
  const tokens = [];
  const hold = (html) => { const token = `%%TOKEN_${tokens.length}%%`; tokens.push(html); return token; };
  let prepared = String(raw).replace(/`([^`\n]+)`/gu, (_, code) => hold(`<code>${escapeHtml(code)}</code>`));
  prepared = prepared.replace(/!\[([^\]]*)\]\(([^)\n]+)\)/gu, (_, alt, destination) => hold(renderMedia(alt, destination, recordPath)));
  prepared = prepared.replace(/\[([^\]]+)\]\(([^)\n]+)\)/gu, (_, label, destination) => hold(renderLink(label, destination, recordPath)));
  let html = escapeHtml(prepared)
    .replace(/\*\*([^*\n]+)\*\*/gu, "<strong>$1</strong>")
    .replace(/~~([^~\n]+)~~/gu, "<del>$1</del>")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/gu, "<em>$1</em>");
  tokens.forEach((token, index) => { html = html.replace(`%%TOKEN_${index}%%`, token); });
  return html;
}

function destinationOnly(destination) {
  const trimmed = String(destination).trim();
  if (trimmed.startsWith("<")) return trimmed.match(/^<([^>]+)>/u)?.[1] || trimmed;
  return trimmed.match(/^(\S+)/u)?.[1] || trimmed;
}

function renderLink(label, destination, recordPath) {
  const target = destinationOnly(destination);
  if (/^https?:\/\//iu.test(target)) return `<a href="${escapeHtml(target)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  if (/^(?:mailto:|tel:)/iu.test(target)) return `<a href="${escapeHtml(target)}">${escapeHtml(label)}</a>`;
  if (target.startsWith("#")) return `<a href="${escapeHtml(target)}">${escapeHtml(label)}</a>`;
  const resolved = resolveVaultPath(recordPath, target);
  if (/\.md$/iu.test(resolved)) return `<button class="inline-link" type="button" data-md-path="${escapeHtml(resolved)}">${escapeHtml(label)}</button>`;
  return `<a href="/api/file?path=${encodeURIComponent(resolved)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
}

function renderMedia(alt, destination, recordPath) {
  const target = destinationOnly(destination);
  if (/^https?:\/\//iu.test(target)) return `<a class="external-media" href="${escapeHtml(target)}" target="_blank" rel="noopener noreferrer">打开外部媒体：${escapeHtml(alt || target)}</a>`;
  const resolved = resolveVaultPath(recordPath, target);
  const src = `/api/file?path=${encodeURIComponent(resolved)}`;
  if (/\.(?:mp4|mov|m4v|webm)$/iu.test(resolved)) return `<figure><video controls preload="metadata" src="${src}"></video><figcaption>${escapeHtml(alt || resolved)}</figcaption></figure>`;
  if (/\.(?:mp3|m4a|wav|aac|ogg|flac)$/iu.test(resolved)) return `<figure><audio controls preload="metadata" src="${src}"></audio><figcaption>${escapeHtml(alt || resolved)}</figcaption></figure>`;
  return `<figure><img src="${src}" alt="${escapeHtml(alt)}" loading="lazy" /><figcaption>${escapeHtml(alt || resolved)}</figcaption></figure>`;
}

function markdownToHtml(markdown, recordPath) {
  const source = String(markdown).replace(/^---[\s\S]*?---\s*/u, "");
  const lines = source.split(/\r?\n/u);
  const output = [];
  const isFence = (line) => /^\s*```/u.test(line);
  const isList = (line) => /^\s*(?:[-*+] |\d+[.)、]\s+)/u.test(line);
  const isSpecial = (line, next) => !line.trim() || isFence(line) || /^#{1,6}\s+/u.test(line) || /^\s*>/u.test(line) || /^\s*(?:---+|\*\*\*+)\s*$/u.test(line) || isList(line) || (line.includes("|") && /^\s*\|?\s*:?-{3,}/u.test(next || ""));
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    const fence = line.match(/^\s*```\s*([^\s`]*)/u);
    if (fence) {
      const code = [];
      index += 1;
      while (index < lines.length && !isFence(lines[index])) code.push(lines[index++]);
      if (index < lines.length) index += 1;
      output.push(`<div class="code-block"><div class="code-toolbar"><span>${escapeHtml(fence[1] || "code")}</span><button type="button" data-copy-code>复制代码</button></div><pre><code>${escapeHtml(code.join("\n"))}</code></pre></div>`);
      continue;
    }
    if (line.includes("|") && /^\s*\|?\s*:?-{3,}/u.test(lines[index + 1] || "")) {
      const tableLines = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) tableLines.push(lines[index++]);
      const split = (value) => value.trim().replace(/^\||\|$/gu, "").split("|").map((cell) => cell.trim());
      const headers = split(tableLines[0]);
      const rows = tableLines.slice(2).map(split);
      output.push(`<div class="table-wrap"><table><thead><tr>${headers.map((cell) => `<th>${renderInline(cell, recordPath)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((_, cellIndex) => `<td>${renderInline(row[cellIndex] || "", recordPath)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/u);
    if (heading) {
      const level = heading[1].length;
      const title = stripMarkdown(heading[2]);
      const id = `section-${index}-${title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/gu, "")}`;
      output.push(`<h${level} id="${escapeHtml(id)}">${renderInline(heading[2], recordPath)}</h${level}>`);
      index += 1; continue;
    }
    if (/^\s*(?:---+|\*\*\*+)\s*$/u.test(line)) { output.push("<hr>"); index += 1; continue; }
    if (/^\s*>/u.test(line)) {
      const quote = [];
      while (index < lines.length && /^\s*>/u.test(lines[index])) quote.push(lines[index++].replace(/^\s*>\s?/u, ""));
      output.push(`<blockquote>${quote.map((item) => renderInline(item, recordPath)).join("<br>")}</blockquote>`);
      continue;
    }
    if (isList(line)) {
      const listLines = [];
      while (index < lines.length && isList(lines[index])) listLines.push(lines[index++]);
      const ordered = /^\s*\d+[.)、]\s+/u.test(listLines[0]);
      const hasTasks = listLines.some((item) => /^\s*[-*+]\s+\[[ xX]\]/u.test(item));
      const tag = ordered ? "ol" : "ul";
      output.push(`<${tag}${hasTasks ? ' class="task-list"' : ""}>${listLines.map((item) => {
        const task = item.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/u);
        const content = task ? task[2] : item.replace(/^\s*(?:[-*+] |\d+[.)、]\s+)/u, "");
        return `<li>${task ? `<span class="task-box ${/x/iu.test(task[1]) ? "is-done" : ""}">${/x/iu.test(task[1]) ? "✓" : ""}</span>` : ""}${renderInline(content, recordPath)}</li>`;
      }).join("")}</${tag}>`);
      continue;
    }
    const paragraph = [line];
    index += 1;
    while (index < lines.length && !isSpecial(lines[index], lines[index + 1])) paragraph.push(lines[index++]);
    output.push(`<p>${paragraph.map((item) => renderInline(item, recordPath)).join("<br>")}</p>`);
  }
  return output.join("\n");
}

function showReader(record) {
  state.currentReaderPath = record.path;
  elements.readerType.textContent = record.frontmatter.type || record.category.type;
  elements.readerTitle.textContent = record.title;
  elements.readerPath.textContent = record.path;
  elements.markdownReader.innerHTML = markdownToHtml(record.text, record.path);
  if (!elements.readerDialog.open) elements.readerDialog.showModal();
  elements.markdownReader.scrollTop = 0;
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const input = document.createElement("textarea");
    input.value = text; input.style.position = "fixed"; input.style.opacity = "0";
    document.body.append(input); input.select(); document.execCommand("copy"); input.remove();
  }
  showToast(successMessage);
}

function currentReaderRecord() {
  return state.files.find((record) => record.path === state.currentReaderPath);
}

async function revealCurrentFile() {
  const record = currentReaderRecord();
  if (!record) return;
  if (!state.serverMode) {
    await copyText(record.path, "已复制路径；兼容模式无法直接在文件夹中定位。");
    return;
  }
  try {
    const response = await fetch(`/api/reveal?path=${encodeURIComponent(record.path)}`, { method: "POST" });
    if (!response.ok) throw new Error(String(response.status));
    showToast("已在文件夹中显示文件。");
  } catch { showToast("文件定位失败，路径已保留在阅读器顶部。"); }
}

const ATLAS_COLORS = { projects: "#4f78d7", knowledge: "#168d7c", content: "#d98b3a", prompts: "#8065c9", business: "#cf6f68", archive: "#8e8a82", system: "#71808c" };

function hashNumber(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

function recordRelations(record, records) {
  const targets = new Set();
  for (const match of record.text.matchAll(/\[[^\]]+\]\(([^)]+\.md(?:#[^)]+)?)\)/giu)) targets.add(resolveVaultPath(record.path, match[1]));
  [record.frontmatter.related, record.frontmatter.derived_from].forEach((raw) => termList(raw).forEach((value) => {
    const normalized = resolveVaultPath(record.path, value);
    const match = records.find((item) => item.path === normalized || item.title.toLocaleLowerCase("zh-CN") === value.toLocaleLowerCase("zh-CN"));
    if (match) targets.add(match.path);
  }));
  return targets;
}

function buildAtlas(records, width, height) {
  const categories = [...new Set(records.map((record) => record.category.nav))];
  const categoryIndex = new Map(categories.map((category, index) => [category, index]));
  const nodes = records.map((record) => {
    const seed = hashNumber(record.path);
    const group = categoryIndex.get(record.category.nav) || 0;
    const groupAngle = group / Math.max(1, categories.length) * Math.PI * 2 - Math.PI / 2;
    const spread = ((seed % 1000) / 1000 - 0.5) * 0.78;
    const scale = 0.38 + ((seed >>> 10) % 1000) / 1000 * 0.58;
    const x = width * 0.5 + Math.cos(groupAngle + spread) * Math.min(width * 0.36, 390) * scale;
    const y = height * 0.5 + Math.sin(groupAngle + spread) * Math.min(height * 0.34, 220) * scale;
    return { record, x, y, baseX: x, baseY: y, phase: ((seed >>> 5) % 628) / 100, speed: 0.16 + ((seed >>> 16) % 20) / 100, radius: 4 + Math.min(3, record.tags.length * 0.35), color: ATLAS_COLORS[record.category.nav] || "#168d7c" };
  });
  const indexByPath = new Map(nodes.map((node, index) => [node.record.path, index]));
  const edgeKeys = new Set();
  const edges = [];
  const add = (a, b, kind) => {
    if (a === undefined || b === undefined || a === b) return;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key); edges.push({ a, b, kind });
  };
  nodes.forEach((node, source) => recordRelations(node.record, records).forEach((path) => add(source, indexByPath.get(path), "reference")));
  const connected = new Set(edges.flatMap((edge) => [edge.a, edge.b]));
  const byTag = new Map();
  nodes.forEach((node, index) => node.record.tags.filter((tag) => tag !== node.record.category.type).slice(0, 3).forEach((tag) => {
    const key = tag.toLocaleLowerCase("zh-CN");
    if (!byTag.has(key)) byTag.set(key, []);
    byTag.get(key).push(index);
  }));
  byTag.forEach((indices) => {
    const anchor = indices.find((index) => connected.has(index)) ?? indices[0];
    indices.filter((index) => !connected.has(index)).slice(0, 4).forEach((index) => { add(anchor, index, "tag"); connected.add(index); });
  });
  return { nodes, edges };
}

function renderAtlas() {
  if (state.atlasFrame) cancelAnimationFrame(state.atlasFrame);
  state.atlasFrame = null;
  const records = state.files.filter((record) => scopeAllows(record, "library"));
  elements.atlasEmpty.hidden = records.length > 0;
  elements.knowledgeGraph.hidden = records.length === 0;
  elements.atlasNodeList.innerHTML = records.slice().sort((a, b) => a.title.localeCompare(b.title, "zh-CN")).map((record) => `<li><button data-open="${escapeHtml(record.path)}"><span style="--node-color:${ATLAS_COLORS[record.category.nav] || "#168d7c"}"></span><strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(record.category.type)}</small></button></li>`).join("");
  elements.atlasNodeList.querySelectorAll("[data-open]").forEach((button) => button.addEventListener("click", () => selectRecord(button.dataset.open, true)));
  if (!records.length) return;
  const graph = buildAtlas(records, elements.atlasStage.clientWidth, elements.atlasStage.clientHeight);
  state.atlasNodes = graph.nodes; state.atlasEdges = graph.edges;
  const references = graph.edges.filter((edge) => edge.kind === "reference").length;
  elements.atlasStats.innerHTML = `<span><strong>${records.length}</strong> 节点</span><span><strong>${references}</strong> 真实引用</span><span><strong>${graph.edges.length - references}</strong> 标签补边</span>`;
  const counts = new Map();
  records.forEach((record) => counts.set(record.category.nav, { label: record.category.type, count: (counts.get(record.category.nav)?.count || 0) + 1 }));
  elements.atlasLegend.innerHTML = [...counts.entries()].map(([key, item]) => `<span><i style="background:${ATLAS_COLORS[key] || "#168d7c"}"></i>${escapeHtml(item.label)} ${item.count}</span>`).join("");
  drawAtlas(0);
}

function drawAtlas(time = 0) {
  if (state.view !== "atlas") return;
  const canvas = elements.knowledgeGraph;
  const context = canvas.getContext("2d");
  const width = canvas.clientWidth; const height = canvas.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
  context.setTransform(dpr, 0, 0, dpr, 0, 0); context.clearRect(0, 0, width, height);
  const animate = !state.reduceMotion && document.visibilityState === "visible";
  const seconds = time / 1000;
  state.atlasNodes.forEach((node) => {
    node.x = animate ? node.baseX + Math.cos(seconds * node.speed + node.phase) * 2.4 : node.baseX;
    node.y = animate ? node.baseY + Math.sin(seconds * node.speed * 0.82 + node.phase) * 1.8 : node.baseY;
  });
  state.atlasEdges.forEach((edge) => {
    const first = state.atlasNodes[edge.a]; const second = state.atlasNodes[edge.b];
    context.strokeStyle = edge.kind === "reference" ? "rgba(32,104,99,.30)" : "rgba(82,101,112,.12)";
    context.lineWidth = edge.kind === "reference" ? 1.2 : 0.7;
    context.beginPath(); context.moveTo(first.x, first.y); context.lineTo(second.x, second.y); context.stroke();
  });
  let hovered = null;
  state.atlasNodes.forEach((node) => {
    const active = Math.hypot(node.x - state.atlasPointer.x, node.y - state.atlasPointer.y) <= node.radius + 7;
    if (active) hovered = node;
    context.globalAlpha = active ? 1 : 0.82; context.fillStyle = node.color;
    context.beginPath(); context.arc(node.x, node.y, active ? node.radius + 2 : node.radius, 0, Math.PI * 2); context.fill();
  });
  context.globalAlpha = 1;
  if (hovered) {
    elements.atlasTooltip.hidden = false;
    elements.atlasTooltip.innerHTML = `<strong>${escapeHtml(hovered.record.title)}</strong><span>${escapeHtml(hovered.record.category.type)} · ${escapeHtml(hovered.record.updated)}</span>`;
    elements.atlasTooltip.style.left = `${Math.min(width - 230, hovered.x + 14)}px`;
    elements.atlasTooltip.style.top = `${Math.max(12, hovered.y - 22)}px`;
    canvas.style.cursor = "pointer";
  } else { elements.atlasTooltip.hidden = true; canvas.style.cursor = "default"; }
  state.atlasFrame = animate ? requestAnimationFrame(drawAtlas) : null;
}

function formatTime(date) {
  if (!date) return "尚未同步";
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
}

let toastTimer;
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 3000);
}

function clearConditions() {
  state.search = ""; state.scope = "library"; state.visibleCardCount = CONFIG.cardPageSize;
  elements.searchInput.value = "";
  if (state.view === "overview") renderCards(); else setView("library", "library");
}

elements.connectVault.addEventListener("click", connectVault);
elements.manualRefresh.addEventListener("click", () => state.serverMode ? readServerVault({ force: true, announce: true }) : refreshVault({ force: true, announce: true }));
elements.healthRefresh.addEventListener("click", () => state.serverMode ? readServerVault({ force: true, announce: true }) : refreshVault({ force: true, announce: true }));
elements.folderFallback.addEventListener("change", async (event) => { state.rootHandle = null; state.fallbackFiles = [...event.target.files]; await refreshVault({ force: true, announce: true }); });
elements.loadMore.addEventListener("click", () => { state.visibleCardCount += CONFIG.cardPageSize; renderCards(); });
elements.navList.addEventListener("click", (event) => {
  const button = event.target.closest(".nav-item");
  if (button) setView(button.dataset.view, button.dataset.scope);
});
elements.filterRow.addEventListener("click", (event) => {
  const button = event.target.closest("[data-scope]");
  if (!button) return;
  state.scope = button.dataset.scope; state.visibleCardCount = CONFIG.cardPageSize;
  setView(state.view === "overview" && state.scope === "library" ? "overview" : "library", state.scope);
});
elements.searchInput.addEventListener("input", (event) => { state.search = event.target.value; state.visibleCardCount = CONFIG.cardPageSize; renderCards(); });
elements.clearFilters.addEventListener("click", clearConditions);
document.querySelectorAll("[data-clear-filters]").forEach((button) => button.addEventListener("click", clearConditions));
document.querySelectorAll("[data-go-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.goView)));
elements.closeSelection.addEventListener("click", () => { state.selectedPath = null; renderCards(); renderGlobalContext(); });
elements.closeReader.addEventListener("click", () => elements.readerDialog.close());
elements.readerDialog.addEventListener("click", (event) => {
  if (event.target === elements.readerDialog) elements.readerDialog.close();
});
elements.markdownReader.addEventListener("click", (event) => {
  const internal = event.target.closest("[data-md-path]");
  if (internal) { selectRecord(internal.dataset.mdPath, true); return; }
  const copy = event.target.closest("[data-copy-code]");
  if (copy) copyText(copy.closest(".code-block")?.querySelector("code")?.textContent || "", "代码已复制。");
});
elements.copyCodex.addEventListener("click", () => {
  const record = currentReaderRecord();
  if (record) copyText(`请读取并基于知识库文件 \`${record.path}\` 继续工作。\n\n目标：${record.title}`, "已复制续接指令，可交给 Codex 或 WorkBuddy。");
});
elements.copyPath.addEventListener("click", () => { const record = currentReaderRecord(); if (record) copyText(record.path, "文件路径已复制。"); });
elements.revealFile.addEventListener("click", revealCurrentFile);
elements.knowledgeGraph.addEventListener("pointermove", (event) => {
  const bounds = elements.knowledgeGraph.getBoundingClientRect(); state.atlasPointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  if (!state.atlasFrame) drawAtlas(0);
});
elements.knowledgeGraph.addEventListener("pointerleave", () => { state.atlasPointer = { x: -9999, y: -9999 }; if (!state.atlasFrame) drawAtlas(0); });
elements.knowledgeGraph.addEventListener("click", () => {
  const node = state.atlasNodes.find((item) => Math.hypot(item.x - state.atlasPointer.x, item.y - state.atlasPointer.y) <= item.radius + 8);
  if (node) selectRecord(node.record.path, true);
});
window.addEventListener("resize", () => { if (state.view === "atlas") renderAtlas(); });
document.addEventListener("visibilitychange", () => {
  if (state.view !== "atlas") return;
  if (document.visibilityState === "visible") renderAtlas();
  else if (state.atlasFrame) { cancelAnimationFrame(state.atlasFrame); state.atlasFrame = null; }
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("en-US") === "k") { event.preventDefault(); elements.searchInput.focus(); }
  if (event.key === "Escape" && state.selectedPath && !elements.readerDialog.open) { state.selectedPath = null; renderCards(); renderGlobalContext(); }
});

const platformName = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent;
elements.searchShortcut.textContent = /win/iu.test(platformName) ? "Ctrl K" : "⌘ K";
setSyncState("idle", "正在连接");
renderView();
bootstrapLocalServer().then((connected) => { if (!connected) setSyncState("idle", "等待连接"); });
