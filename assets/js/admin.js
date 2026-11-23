/* THE BEST · admin dashboard (admin.html)
   Only usable with a GitHub token that can write to the site's repository: every change is a
   commit, made from this browser (see github.js). Here the admin announces championships,
   records each championship's winner, edits or deletes winners, and connects the free
   Google Apps Script service that handles sign-ups and reminders (tools/notifications/Code.gs). */
import { t, tp, setLang, isArabic, applyStatic, fmtDateTime, fmtDate, tzName, iso } from "./i18n.js?v=20261123002647";
import {
  $, $$, esc, icon, fmt, avatar, assignColors, showPlayer, showTeam, showEvent, slug,
  getJSON, getOptionalJSON, loadArabicNames, normalizeEf, normalizeChamps, normalizeConfig,
  DATA_PES, DATA_EF, DATA_CHAMPS, DATA_CONFIG, newerPending, hasPending, savePending, watchPending,
  readGithubConfig, saveGithubConfig, toast, initImageFallback, confirmBox,
  champStatus, champName, remindMinutes, fetchSignups, isSignupUrl,
} from "./core.js?v=20261123002647";
import { checkConnection, commitData } from "./github.js?v=20261123002647";
import { initWinnerForm, openWinnerForm, removeWinner } from "./winner-form.js?v=20261123002647";

const LS_SHEET = "thebest.sheetUrl";
const SCRIPT_PATH = "tools/notifications/Code.gs";
const STATUS_KEY = { upcoming: "stUpcoming", live: "stLive", awaiting: "stAwaiting", finished: "stFinished", cancelled: "stCancelled" };

const state = {
  ef: { updatedAt: "", winners: [] },
  champs: { updatedAt: "", championships: [] },
  config: { updatedAt: "", signupApi: "" },
  pesPlayers: [],
  counts: null,
  countsError: "",
  connected: false,
  repo: "",
};
let champEditing = null, champBusy = false, setupOpened = false;

/* ---------------- rendering ---------------- */
function renderAll() {
  const players = [...new Set([...state.pesPlayers, ...state.ef.winners.map((w) => w.player)])];
  assignColors(players);
  $("#playerList").innerHTML = players.map((p) => `<option value="${esc(p)}"></option>`).join("");
  const events = new Set(["eFootball", ...state.ef.winners.map((w) => w.event).filter(Boolean), ...state.champs.championships.map((c) => c.name)]);
  $("#eventList").innerHTML = [...events].map((e) => `<option value="${esc(e)}"></option>`).join("");
  renderChamps();
  renderWinners();
  renderSettings();
  $("#pendingBanner").hidden = !hasPending();
}

const ORDER = { live: 0, upcoming: 1, awaiting: 2, finished: 3, cancelled: 4 };
function renderChamps() {
  const now = Date.now();
  const list = state.champs.championships
    .map((c) => ({ c, status: champStatus(c, now), start: Date.parse(c.startsAt) }))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.status === "upcoming" ? a.start - b.start : b.start - a.start));
  $("#champList").innerHTML = list.length ? list.map(champRow).join("") : `<p class="card empty">${esc(t("champsEmpty"))}</p>`;
}

const btn = (act, id, label, ico, cls = "btn-ghost") =>
  `<button class="btn ${cls} btn-sm" type="button" data-act="${act}" data-id="${esc(id)}">${icon(ico)}<span>${esc(t(label))}</span></button>`;

function champRow({ c, status }) {
  const winner = c.winnerId ? state.ef.winners.find((w) => w.id === c.winnerId) : null;
  const n = state.counts ? state.counts[c.id]?.count || 0 : null;
  const names = state.counts?.[c.id]?.names || [];
  const meta = [`<span>${icon("calendar")}${esc(fmtDateTime(c.startsAt, { year: true }))}</span>`];
  if (status === "upcoming") meta.push(`<span>${icon("bell")}${esc(t("remindShort", { minutes: fmt(remindMinutes(c)) }))}</span>`);
  if (c.maxPlayers) meta.push(`<span>${icon("users")}${esc(t("maxShort", { max: fmt(c.maxPlayers) }))}</span>`);

  let signups = "";
  if (status !== "finished" && status !== "cancelled") {
    if (!state.config.signupApi) signups = `<p class="a-signups muted">${icon("users")}${esc(t("champSignupsOff"))}</p>`;
    else if (n !== null) signups = `<p class="a-signups">${icon("users")}<span>${esc(tp("signedUpN", n))}${names.length ? ` · ${names.map((x) => `<bdi>${esc(x)}</bdi>`).join(", ")}` : ""}</span></p>`;
  }
  const actions = [];
  if (status === "live" || status === "awaiting") actions.push(btn("record", c.id, "actRecord", "trophy", "btn-primary"));
  if (status === "upcoming") actions.push(btn("record", c.id, "actRecord", "trophy"));
  if (winner) actions.push(btn("editwinner", winner.id, "actEditWinner", "trophy"));
  actions.push(btn("edit", c.id, "actEdit", "edit"));
  if (status === "upcoming" || status === "live") actions.push(btn("calloff", c.id, "actCallOff", "ban"));
  if (status === "cancelled") actions.push(btn("restore", c.id, "actRestore", "restore"));
  actions.push(btn("delete", c.id, "actDelete", "trash", "btn-ghost danger"));
  return `
    <article class="card a-row is-${status}">
      <div class="a-main">
        <div class="a-title"><span class="badge st-${status}">${esc(t(STATUS_KEY[status]))}</span><h3><bdi>${esc(champName(c))}</bdi></h3></div>
        <p class="a-meta">${meta.join("")}</p>
        ${winner ? `<p class="a-winner">${avatar(winner.player)}<span>${esc(t("champWinnerLine", { player: iso(showPlayer(winner.player)), team: iso(showTeam(winner)) }))}</span></p>` : ""}
        ${signups}
      </div>
      <div class="a-actions">${actions.join("")}</div>
    </article>`;
}

function renderWinners() {
  const list = state.ef.winners.slice().reverse();
  $("#winnerList").innerHTML = list.length ? list.map((w) => {
    const c = w.championshipId ? state.champs.championships.find((x) => x.id === w.championshipId) : null;
    const meta = [
      `<span>${icon("shield")}<bdi>${esc(showTeam(w))}</bdi></span>`,
      `<span>${icon("trophy")}<bdi>${esc(c ? champName(c) : showEvent(w) || "eFootball")}</bdi></span>`,
    ];
    if (w.date) meta.push(`<span>${icon("calendar")}${esc(fmtDate(w.date))}</span>`);
    return `
      <article class="card a-row">
        <div class="a-main">
          <div class="a-title">${avatar(w.player)}<h3><bdi>${esc(showPlayer(w.player))}</bdi></h3></div>
          <p class="a-meta">${meta.join("")}</p>
        </div>
        <div class="a-actions">
          ${btn("editwinner", w.id, "actEdit", "edit")}
          ${btn("delwinner", w.id, "actDelete", "trash", "btn-ghost danger")}
        </div>
      </article>`;
  }).join("") : `<p class="card empty">${esc(t("winnersEmpty"))}</p>`;
}

const totalSignups = (counts) => Object.values(counts || {}).reduce((n, c) => n + (c.count || 0), 0);
function renderSettings() {
  const api = state.config.signupApi;
  const input = $("#apiForm").elements.api;
  if (!input.dataset.dirty) input.value = api;
  $("#apiRemove").hidden = !api;
  const st = $("#setStatus");
  let cls = "", text;
  if (!api) [cls, text] = ["warn", t("setOff")];
  else if (state.countsError) [cls, text] = ["error", t("setErr", { error: state.countsError })];
  else if (state.counts) [cls, text] = ["ok", t("setOk", { n: fmt(totalSignups(state.counts)) })];
  else text = t("setChecking");
  st.className = `set-status ${cls}`;
  st.textContent = text;
  if (!setupOpened) {
    $("#setupHow").open = !api;
    setupOpened = true;
  }
  $("#setupCallout").hidden = Boolean(api);
  const sheet = readSheetUrl();
  $("#sheetUrl").value = sheet;
  $("#sheetOpen").hidden = !sheet;
  if (sheet) $("#sheetOpen").href = sheet;
  const cfg = readGithubConfig();
  $("#scriptLink").href = cfg.owner && cfg.repo
    ? `https://github.com/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/blob/${encodeURIComponent(cfg.branch)}/${SCRIPT_PATH}`
    : SCRIPT_PATH;
}
const readSheetUrl = () => {
  try { return localStorage.getItem(LS_SHEET) || ""; } catch { return ""; }
};

function renderRemindOptions() {
  $$("#champForm select[name=remindBefore] option").forEach((o) => { o.textContent = t("remindOpt", { n: fmt(o.value) }); });
}

/* ---------------- sign-in ---------------- */
function setLoginStatus(message, type = "") {
  const el = $("#loginStatus");
  el.textContent = message;
  el.className = `form-status ${type}`;
}
function showDashboard() {
  $("#loginCard").hidden = true;
  $("#dash").hidden = false;
  $("#connLabel").textContent = t("connectedAs", { repo: state.repo });
  refreshCounts();
}
function showLogin() {
  const cfg = readGithubConfig(), f = $("#loginForm").elements;
  f.ghOwner.value = cfg.owner;
  f.ghRepo.value = cfg.repo;
  f.ghBranch.value = cfg.branch;
  f.ghToken.value = "";
  f.ghToken.placeholder = cfg.token ? t("tokenSaved") : "github_pat_…";
  $("#dash").hidden = true;
  $("#loginCard").hidden = false;
}
async function connect(cfg) {
  setLoginStatus(t("stConnecting"));
  $("#loginBtn").disabled = true;
  try {
    const { repo, canWrite, reason } = await checkConnection(cfg, DATA_EF);
    if (!canWrite) {
      // Open "How do I get a token?" so the fix is right there.
      if (reason === "token") $("#loginForm .howto").open = true;
      throw new Error(reason === "token" ? t("errReadOnly", { repo: cfg.repo }) : t("stNoPush", { repo }));
    }
    state.connected = true;
    state.repo = repo;
    setLoginStatus("");
    showDashboard();
  } catch (err) {
    state.connected = false;
    showLogin();
    setLoginStatus(err.message || String(err), "error");
  } finally {
    $("#loginBtn").disabled = false;
  }
}
function onLogin(e) {
  e.preventDefault();
  const f = e.currentTarget.elements, current = readGithubConfig();
  const cfg = {
    owner: f.ghOwner.value.trim(),
    repo: f.ghRepo.value.trim(),
    branch: f.ghBranch.value.trim() || "main",
    token: f.ghToken.value.trim() || current.token,
  };
  if (!cfg.owner || !cfg.repo || !cfg.token) return setLoginStatus(t("stFillGh"), "error");
  saveGithubConfig(cfg);
  connect(cfg);
}
function disconnect() {
  saveGithubConfig({ ...readGithubConfig(), token: "" });
  state.connected = false;
  showLogin();
  setLoginStatus(t("stForgot"), "ok");
}

/* ---------------- publishing ---------------- */
/** After a commit: show the new data straight away and keep it until GitHub Pages serves it. */
function applyPublished(files) {
  savePending(files);
  if (files[DATA_EF]) state.ef = normalizeEf(files[DATA_EF]);
  if (files[DATA_CHAMPS]) state.champs = normalizeChamps(files[DATA_CHAMPS]);
  if (files[DATA_CONFIG]) state.config = normalizeConfig(files[DATA_CONFIG]);
  renderAll();
  watchPending(onLive);
}
function onLive(live) {
  if (live[DATA_EF]) state.ef = normalizeEf(live[DATA_EF]);
  if (live[DATA_CHAMPS]) state.champs = normalizeChamps(live[DATA_CHAMPS]);
  if (live[DATA_CONFIG]) state.config = normalizeConfig(live[DATA_CONFIG]);
  renderAll();
  toast(t("toastLive"), "ok");
}
const findChamp = (data, id) => {
  data.championships = Array.isArray(data.championships) ? data.championships : [];
  const c = data.championships.find((x) => x.id === id);
  if (!c) throw new Error(t("errChampGone"));
  return c;
};
async function publish(edits, message) {
  toast(t("stPublishing"));
  try {
    const result = await commitData(readGithubConfig(), { edits, message });
    applyPublished(result.files);
    return true;
  } catch (err) {
    toast(err.message || String(err), "error");
    return false;
  }
}

/* ---------------- championships ---------------- */
function setChampStatus(message, type = "") {
  const el = $("#champStatus");
  el.textContent = message;
  el.className = `form-status ${type}`;
}
const pad = (n) => String(n).padStart(2, "0");
function openChamp(c = null) {
  champEditing = c;
  const form = $("#champForm"), f = form.elements;
  form.reset();
  form.querySelectorAll(".field.invalid").forEach((x) => x.classList.remove("invalid"));
  $("#champDlgTitle").textContent = t(c ? "dlgEditChamp" : "dlgNewChamp");
  $("#champSave span").textContent = t(c ? "btnSave" : "btnAnnounce");
  if (c) {
    const d = new Date(c.startsAt);
    f.name.value = c.name || "";
    f.nameAr.value = c.nameAr || "";
    f.date.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    f.time.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    f.remindBefore.value = String([15, 20, 30].includes(Number(c.remindBefore)) ? c.remindBefore : 30);
    f.maxPlayers.value = c.maxPlayers || "";
    f.details.value = c.details || "";
    f.detailsAr.value = c.detailsAr || "";
  } else {
    f.remindBefore.value = "30";
  }
  $("#champTz").textContent = t("tzHint", { tz: tzName() });
  $("#champTimeHint").hidden = !(c && state.config.signupApi && champStatus(c) === "upcoming");
  setChampStatus("");
  $("#champDialog").showModal();
  setTimeout(() => f.name.focus(), 30);
}

async function onChampSubmit(e) {
  e.preventDefault();
  if (champBusy) return;
  const form = e.currentTarget, f = form.elements;
  const v = (k) => f[k].value.trim();
  form.querySelectorAll(".field.invalid").forEach((x) => x.classList.remove("invalid"));
  const name = v("name").replace(/\s+/g, " ");
  const missing = ["name", "date", "time"].filter((k) => !v(k));
  if (missing.length) {
    missing.forEach((k) => f[k].closest(".field").classList.add("invalid"));
    f[missing[0]].focus();
    return setChampStatus(t("errChampRequired"), "error");
  }
  const start = new Date(`${v("date")}T${v("time")}`);
  if (Number.isNaN(start.getTime())) {
    f.date.closest(".field").classList.add("invalid");
    return setChampStatus(t("errChampRequired"), "error");
  }
  const max = v("maxPlayers") ? Number(v("maxPlayers")) : 0;
  if (v("maxPlayers") && (!Number.isInteger(max) || max < 2 || max > 128)) {
    f.maxPlayers.closest(".field").classList.add("invalid");
    return setChampStatus(t("errChampMax"), "error");
  }
  const entry = {
    name,
    nameAr: v("nameAr"),
    startsAt: start.toISOString(),
    remindBefore: Number(f.remindBefore.value) || 30,
    maxPlayers: max || null,
    details: v("details"),
    detailsAr: v("detailsAr"),
  };
  const was = champEditing;
  const id = was?.id || `${slug(name)}-${Date.now().toString(36)}`;
  champBusy = true;
  $("#champSave").disabled = true;
  setChampStatus(t("stPublishing"));
  try {
    const result = await commitData(readGithubConfig(), {
      edits: {
        [DATA_CHAMPS]: (data) => {
          if (was) Object.assign(findChamp(data, was.id), entry);
          else data.championships = [...(Array.isArray(data.championships) ? data.championships : []), { id, ...entry, createdAt: new Date().toISOString() }];
        },
      },
      message: was ? `Update championship: ${name}` : `Announce championship: ${name}`,
    });
    applyPublished(result.files);
    $("#champDialog").close();
    const c = state.champs.championships.find((x) => x.id === id);
    if (!was && c && champStatus(c) !== "upcoming") {
      toast(t("toastChampPast"), "ok");
      openRecord(c);
    } else {
      toast(was ? t("toastChampSaved") : t("toastChampAdded", { name }), "ok");
    }
  } catch (err) {
    setChampStatus(err.message || String(err), "error");
  } finally {
    champBusy = false;
    $("#champSave").disabled = false;
  }
}

function openRecord(c) {
  openWinnerForm({ championship: c, signups: state.counts?.[c.id]?.count || 0 });
}

async function callOff(c) {
  const ok = await confirmBox({ title: t("confirmCallOffTitle"), message: t("confirmCallOff", { name: champName(c) }), ok: t("btnCallOff"), danger: true });
  if (!ok) return;
  if (await publish({ [DATA_CHAMPS]: (data) => { findChamp(data, c.id).cancelled = true; } }, `Call off championship: ${c.name}`)) {
    toast(t("toastCalledOff", { name: champName(c) }), "ok");
  }
}
async function restore(c) {
  if (await publish({ [DATA_CHAMPS]: (data) => { delete findChamp(data, c.id).cancelled; } }, `Restore championship: ${c.name}`)) {
    toast(t("toastRestored", { name: champName(c) }), "ok");
  }
}
async function deleteChamp(c) {
  const ok = await confirmBox({
    title: t("confirmDeleteChampTitle"),
    message: t(c.winnerId ? "confirmDeleteChampWinner" : "confirmDeleteChamp", { name: champName(c) }),
    ok: t("btnDelete"),
    danger: true,
  });
  if (!ok) return;
  const edits = {
    [DATA_CHAMPS]: (data) => {
      findChamp(data, c.id);
      data.championships = data.championships.filter((x) => x.id !== c.id);
    },
  };
  if (state.ef.winners.some((w) => w.championshipId === c.id)) {
    edits[DATA_EF] = (data) => {
      for (const w of data.winners || []) if (w.championshipId === c.id) delete w.championshipId;
    };
  }
  if (await publish(edits, `Delete championship: ${c.name}`)) toast(t("toastChampDeleted", { name: champName(c) }), "ok");
}

function onAction(e) {
  const el = e.target.closest?.("[data-act]");
  if (!el) return;
  const id = el.dataset.id, act = el.dataset.act;
  if (act === "editwinner" || act === "delwinner") {
    const w = state.ef.winners.find((x) => x.id === id);
    if (!w) return;
    if (act === "delwinner") return removeWinner(w);
    const c = w.championshipId ? state.champs.championships.find((x) => x.id === w.championshipId) : null;
    return openWinnerForm({ winner: w, championship: c });
  }
  const c = state.champs.championships.find((x) => x.id === id);
  if (!c) return;
  if (act === "edit") openChamp(c);
  else if (act === "record") openRecord(c);
  else if (act === "calloff") callOff(c);
  else if (act === "restore") restore(c);
  else if (act === "delete") deleteChamp(c);
}

/* ---------------- sign-ups & reminders ---------------- */
function setApiStatus(message, type = "") {
  const el = $("#apiStatus");
  el.textContent = message;
  el.className = `form-status ${type}`;
}
async function refreshCounts() {
  const api = state.config.signupApi;
  if (!api) {
    state.counts = null;
    state.countsError = "";
    return renderAll();
  }
  try {
    state.counts = await fetchSignups(api);
    state.countsError = "";
  } catch (err) {
    state.counts = null;
    state.countsError = err.message || String(err);
  }
  renderAll();
}
async function testApi() {
  const url = $("#apiForm").elements.api.value.trim();
  if (!isSignupUrl(url)) return setApiStatus(t("apiInvalid"), "error");
  setApiStatus(t("setChecking"));
  try {
    const counts = await fetchSignups(url);
    setApiStatus(t("apiTestOk", { n: fmt(totalSignups(counts)) }), "ok");
  } catch (err) {
    setApiStatus(t("setErr", { error: err.message || String(err) }), "error");
  }
}
async function saveApi(e) {
  e.preventDefault();
  const input = $("#apiForm").elements.api;
  const url = input.value.trim();
  if (!isSignupUrl(url)) return setApiStatus(t("apiInvalid"), "error");
  setApiStatus(t("stPublishing"));
  try {
    const result = await commitData(readGithubConfig(), { edits: { [DATA_CONFIG]: (data) => { data.signupApi = url; } }, message: "Turn on sign-ups and reminders" });
    delete input.dataset.dirty;
    applyPublished(result.files);
    setApiStatus(t("apiSaved"), "ok");
    refreshCounts();
  } catch (err) {
    setApiStatus(err.message || String(err), "error");
  }
}
async function removeApi() {
  const input = $("#apiForm").elements.api;
  if (await publish({ [DATA_CONFIG]: (data) => { data.signupApi = ""; } }, "Turn off sign-ups")) {
    delete input.dataset.dirty;
    input.value = "";
    setApiStatus(t("apiRemoved"), "ok");
    refreshCounts();
  }
}
async function copyScript() {
  try {
    const res = await fetch(SCRIPT_PATH, { cache: "no-cache" });
    if (!res.ok) throw new Error(String(res.status));
    // The script reads championships from this site, so it gets this site's address.
    const site = `${location.origin}${location.pathname.replace(/[^/]*$/, "")}`;
    const code = (await res.text()).replace(/^const SITE_URL = ".*";$/m, `const SITE_URL = "${site}";`);
    await navigator.clipboard.writeText(code);
    toast(t("scriptCopied"), "ok");
  } catch {
    toast(t("scriptCopyFail"), "error");
  }
}

/* ---------------- wiring ---------------- */
function bindUI() {
  $("#langBtn").addEventListener("click", () => {
    setLang(isArabic() ? "en" : "ar");
    renderRemindOptions();
    if (state.connected) $("#connLabel").textContent = t("connectedAs", { repo: state.repo });
    renderAll();
  });
  $("#loginForm").addEventListener("submit", onLogin);
  $("#disconnectBtn").addEventListener("click", disconnect);
  $("#newChampBtn").addEventListener("click", () => openChamp());
  $("#champForm").addEventListener("submit", onChampSubmit);
  $$("#champDialog [data-close]").forEach((b) => b.addEventListener("click", () => { if (!champBusy) $("#champDialog").close(); }));
  $("#champDialog").addEventListener("cancel", (e) => { if (champBusy) e.preventDefault(); });
  $("#dash").addEventListener("click", onAction);
  $("#apiForm").addEventListener("submit", saveApi);
  $("#apiForm").elements.api.addEventListener("input", (e) => { e.target.dataset.dirty = "1"; });
  $("#apiTest").addEventListener("click", testApi);
  $("#apiRemove").addEventListener("click", removeApi);
  $("#copyScript").addEventListener("click", copyScript);
  $("#sheetUrl").addEventListener("change", (e) => {
    const v = e.target.value.trim();
    try { localStorage.setItem(LS_SHEET, /^https:\/\//.test(v) ? v : ""); } catch { /* storage unavailable */ }
    renderSettings();
  });
  // Statuses (upcoming → playing now → needs a winner) follow the clock.
  setInterval(() => { if (state.connected && !document.hidden) renderChamps(); }, 60000);
}

async function boot() {
  applyStatic();
  renderRemindOptions();
  initImageFallback();
  bindUI();
  initWinnerForm({ saved: applyPublished });
  try {
    const [ef, champs, config, pes] = await Promise.all([
      getJSON(DATA_EF, true), getOptionalJSON(DATA_CHAMPS), getOptionalJSON(DATA_CONFIG), getJSON(DATA_PES).catch(() => ({})), loadArabicNames(),
    ]);
    state.ef = normalizeEf(newerPending(DATA_EF, ef) || ef);
    state.champs = normalizeChamps(newerPending(DATA_CHAMPS, champs) || champs);
    state.config = normalizeConfig(newerPending(DATA_CONFIG, config) || config);
    state.pesPlayers = Array.isArray(pes.winners) ? [...new Set(pes.winners.map((w) => w.player))] : [];
  } catch (err) {
    console.error(err);
    toast(String(err.message || err), "error");
  }
  renderAll();
  watchPending(onLive);
  const cfg = readGithubConfig();
  if (cfg.token && cfg.owner && cfg.repo) connect(cfg);
  else showLogin();
}

boot();
