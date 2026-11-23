/* Shared by the public site (app.js, announce.js) and the admin dashboard (admin.js).
   Keep the ?v= tags identical in every file (tools/bump_version.py does it), so all pages
   load one copy of each module. */
import { t, isArabic, fmtNum } from "./i18n.js?v=20261123002532";

export const DATA_PES = "data/pes_history.json";
export const DATA_EF = "data/efootball.json";
export const DATA_CHAMPS = "data/championships.json";
export const DATA_CONFIG = "data/config.json";
const DATA_NAMES_AR = "data/names_ar.json";
const LS_PENDING = "thebest.pending";
const LS_GITHUB = "thebest.github";

export const store = {
  namesAr: { players: new Map(), teams: new Map(), events: new Map() },
  localImages: new Map(),
  colors: new Map(),
};

/* Player identity colours: one fixed colour per player, never re-assigned by rank
   or filters. Only three hues: in the stacked tournament bars any two players can
   end up side by side, and only the first three categorical slots stay
   distinguishable for colour-blind readers in every pairing (checked against the
   #0f1626 card surface). Everyone else (Lava, Com, new players) shares the
   neutral "Others" grey and is identified by name, initials and tooltips. */
export const PALETTE = ["#3987e5", "#d95926", "#199e70"];
export const FIXED_SLOTS = { "Legend Master": 0, Lord: 1, Moo: 2 };
export const NEUTRAL = "#646e83";
export function assignColors(players) {
  const m = new Map();
  for (const [p, slot] of Object.entries(FIXED_SLOTS)) m.set(p, PALETTE[slot]);
  for (const p of players) if (!m.has(p)) m.set(p, NEUTRAL);
  store.colors = m;
}

/* ---------------- helpers ---------------- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
export const bdi = (v) => `<bdi>${esc(v)}</bdi>`;
export const icon = (name, cls = "") => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
export const fmt = (n) => fmtNum(n);
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
// Capitalise the first letter, but leave camel-case names like "eFootball" alone.
export const capFirst = (s) => (!s || /^[a-z][A-Z]/.test(s) ? s || "" : s[0].toUpperCase() + s.slice(1));
export const safeUrl = (u) => (/^https?:\/\//i.test(String(u || "")) ? String(u) : "");
export const slug = (s) => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "item";
const ABBR = new Set(["fc", "cf", "sc", "ac", "afc", "fk", "sv", "cd", "ud", "psg", "atm"]);
/** Display name for a team: capitalises lower-case words from the sheet ("celta vigo" → "Celta Vigo"). */
export function teamName(team) {
  return String(team ?? "").trim().split(/\s+/)
    .map((w) => (ABBR.has(w.toLowerCase()) ? w.toUpperCase() : /^[a-z]/.test(w) ? capFirst(w) : w))
    .join(" ");
}
export const eventName = (e) => capFirst(String(e ?? "").trim());

/* Names in the current language: the winner's own Arabic field, then data/names_ar.json, then as written. */
export const arName = (map, value) => (isArabic() ? map.get(String(value ?? "").trim().toLowerCase()) || "" : "");
export const showPlayer = (p) => arName(store.namesAr.players, p) || String(p ?? "");
export const showTeam = (w) => (isArabic() && w.teamAr) || arName(store.namesAr.teams, w.team) || teamName(w.team);
export const showEvent = (w) => (isArabic() && w.eventAr) || arName(store.namesAr.events, w.event) || eventName(w.event);
export const showStar = (w) => (isArabic() && w.starAr) || w.star || "";
export const prettyComp = (c) => (String(c).trim().toLowerCase() === "all" ? t("allPlayers") : String(c));

export const initials = (name) => {
  const p = String(name ?? "?").trim().split(/\s+/);
  return (p.length > 1 ? p[0][0] + p[p.length - 1][0] : p[0].slice(0, 2)).toUpperCase();
};
export const colorOf = (p) => store.colors.get(p) || NEUTRAL;
export const avatar = (p, cls = "") => `<span class="avatar ${cls}" style="--c:${colorOf(p)}" aria-hidden="true">${esc(initials(showPlayer(p)))}</span>`;
const isUrl = (p) => /^(https?:|blob:|data:)/i.test(String(p));
export function img(path, cls, alt = "", extra = 'loading="lazy"') {
  const src = store.localImages.get(path) || path;
  return `<img class="${cls}" src="${esc(src)}"${isUrl(path) ? "" : ` data-path="${esc(path)}"`} alt="${esc(alt)}" ${extra} decoding="async">`;
}

/* ---------------- data ---------------- */
export async function getJSON(url, fresh = false) {
  // "no-cache" still uses the browser's copy, but checks with GitHub first that it hasn't changed.
  const res = await fetch(fresh ? `${url}?v=${Date.now()}` : url, { cache: fresh ? "no-store" : "no-cache" });
  if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status})`);
  return res.json();
}
/** Like getJSON, but a missing file (not published yet) gives an empty object instead of an error. */
export const getOptionalJSON = (url) => getJSON(url, true).catch(() => ({}));

export async function loadArabicNames() {
  try {
    const d = await getJSON(DATA_NAMES_AR);
    const toMap = (o) => new Map(Object.entries(o || {}).map(([k, v]) => [k.trim().toLowerCase(), String(v)]));
    store.namesAr = { players: toMap(d.players), teams: toMap(d.teams), events: toMap(d.events) };
  } catch { /* optional file: names stay as written */ }
}
export function normalizeEf(data) {
  const winners = Array.isArray(data?.winners) ? data.winners.filter((w) => w && w.player && w.team) : [];
  return { updatedAt: data?.updatedAt || "", winners };
}
export function normalizeChamps(data) {
  const list = Array.isArray(data?.championships)
    ? data.championships.filter((c) => c && c.id && c.name && !Number.isNaN(Date.parse(c.startsAt)))
    : [];
  return { updatedAt: data?.updatedAt || "", championships: list };
}
export function normalizeConfig(data) {
  return { updatedAt: data?.updatedAt || "", signupApi: String(data?.signupApi || "").trim() };
}

/* ---------------- championships ---------------- */
/** A championship counts as "playing now" for this long after its start, then waits for its winner. */
export const LIVE_HOURS = 6;
export function champStatus(c, now = Date.now()) {
  if (c.cancelled) return "cancelled";
  if (c.winnerId) return "finished";
  const start = Date.parse(c.startsAt);
  if (now < start) return "upcoming";
  return now < start + LIVE_HOURS * 3600e3 ? "live" : "awaiting";
}
export const champName = (c) => (isArabic() && c.nameAr) || c.name || "";
export const champDetails = (c) => (isArabic() && c.detailsAr) || c.details || "";
export const remindMinutes = (c) => Math.min(120, Math.max(5, Number(c.remindBefore) || 30));

/* ---------------- publishing state ----------------
   After a publish, the new data files are kept in this browser for up to 15 minutes, so the
   change shows straight away (on both pages) while GitHub Pages redeploys. */
const PENDING_TTL = 15 * 60 * 1000;
export function readPending() {
  try {
    const p = JSON.parse(localStorage.getItem(LS_PENDING) || "null");
    if (!p || !p.files || Date.now() - p.savedAt > PENDING_TTL) return null;
    return p;
  } catch {
    return null;
  }
}
export function savePending(files) {
  const merged = { savedAt: Date.now(), files: { ...(readPending()?.files || {}), ...files } };
  try { localStorage.setItem(LS_PENDING, JSON.stringify(merged)); } catch { /* storage unavailable */ }
}
export function clearPending() {
  try { localStorage.removeItem(LS_PENDING); } catch { /* storage unavailable */ }
}
export const hasPending = () => Boolean(readPending() && Object.keys(readPending().files).length);
/** The pending copy of a data file, when it's newer than the published one. */
export function newerPending(path, live) {
  const p = readPending()?.files?.[path];
  return p && (p.updatedAt || "") > (live?.updatedAt || "") ? p : null;
}
let watchTimer;
/** Poll the published files until GitHub Pages serves every pending change, then call onLive({path: data}). */
export function watchPending(onLive) {
  clearInterval(watchTimer);
  if (!hasPending()) return;
  let tries = 0;
  watchTimer = setInterval(async () => {
    tries += 1;
    const p = readPending();
    if (!p) {
      clearInterval(watchTimer);
      onLive({});
      return;
    }
    const live = {};
    let allLive = true;
    for (const [path, data] of Object.entries(p.files)) {
      try {
        live[path] = await getJSON(path, true);
        if ((live[path].updatedAt || "") < (data.updatedAt || "")) allLive = false;
      } catch {
        allLive = false;
      }
    }
    if (allLive) {
      clearInterval(watchTimer);
      clearPending();
      onLive(live);
    } else if (tries >= 40) {
      clearInterval(watchTimer);
    }
  }, 15000);
}

/* ---------------- GitHub connection (admin) ---------------- */
export function guessRepo() {
  const host = location.hostname;
  if (!host.endsWith(".github.io")) return {};
  const owner = host.replace(/\.github\.io$/, "");
  const first = location.pathname.split("/").filter(Boolean)[0];
  return { owner, repo: first && !first.includes(".") ? first : `${owner}.github.io` };
}
export function readGithubConfig() {
  let c = {};
  try { c = JSON.parse(localStorage.getItem(LS_GITHUB) || "{}"); } catch { /* ignore */ }
  const g = guessRepo();
  return { owner: c.owner || g.owner || "", repo: c.repo || g.repo || "", branch: c.branch || "main", token: c.token || "" };
}
export function saveGithubConfig(cfg) {
  try { localStorage.setItem(LS_GITHUB, JSON.stringify(cfg)); } catch { /* storage unavailable */ }
}

/* ---------------- UI bits ---------------- */
let toastTimer;
export function toast(message, type = "") {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.className = `toast ${type}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, type === "error" ? 9000 : 5500);
}

/** Show an image we just uploaded straight away, before GitHub Pages has deployed it. */
export function registerLocalImage(path, blob) {
  store.localImages.set(path, URL.createObjectURL(blob));
}

/** Images published a moment ago may not be on GitHub Pages yet: retry from raw.githubusercontent.com. */
export function initImageFallback() {
  document.addEventListener("error", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLImageElement) || !el.dataset.path) return;
    if (!el.dataset.retried) {
      el.dataset.retried = "1";
      const { owner, repo, branch } = readGithubConfig();
      if (owner && repo) {
        const path = el.dataset.path.split("/").map(encodeURIComponent).join("/");
        el.src = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${path}`;
        return;
      }
    }
    el.hidden = true;
  }, true);
}

/** A styled yes/no dialog (instead of window.confirm). Resolves true when confirmed. */
export function confirmBox({ title, message, ok, cancel = t("btnCancel"), danger = false }) {
  return new Promise((resolve) => {
    const d = document.createElement("dialog");
    d.className = "dialog confirm-dialog";
    d.setAttribute("aria-labelledby", "confirmTitle");
    d.innerHTML = `
      <form method="dialog" class="dialog-inner">
        <header class="dialog-head"><h2 id="confirmTitle">${esc(title)}</h2></header>
        <div class="dialog-body"><p class="confirm-text">${esc(message)}</p></div>
        <footer class="dialog-foot">
          <span class="form-status"></span>
          <button class="btn btn-ghost" value="no">${esc(cancel)}</button>
          <button class="btn ${danger ? "btn-danger" : "btn-primary"}" value="yes">${esc(ok)}</button>
        </footer>
      </form>`;
    document.body.append(d);
    d.addEventListener("close", () => {
      resolve(d.returnValue === "yes");
      d.remove();
    });
    d.showModal();
    d.querySelector('[value="yes"]').focus();
  });
}

/* ---------------- sign-up service (Google Apps Script web app) ---------------- */
/** Accepts the Apps Script web app URL (and a localhost address, for testing). */
export const isSignupUrl = (u) =>
  /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec\/?$/i.test(String(u || "").trim()) ||
  /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/\S+$/i.test(String(u || "").trim());

async function timedFetch(url, opts = {}, ms = 25000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}
/** Public sign-up counts and names: { [championshipId]: { count, names } }. */
export async function fetchSignups(api) {
  const url = `${api}${api.includes("?") ? "&" : "?"}action=list&t=${Date.now()}`;
  const res = await timedFetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  let data;
  try { data = await res.json(); } catch { throw new Error("not JSON"); }
  if (!data || data.ok !== true) throw new Error(data?.error || "bad response");
  return data.championships || {};
}
/** POST as text/plain: Apps Script web apps can't answer CORS preflight requests. */
export async function postSignup(api, payload) {
  let res;
  try {
    res = await timedFetch(api, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
  } catch {
    return { ok: false, error: "network" };
  }
  if (!res.ok) return { ok: false, error: "network" };
  try {
    return await res.json();
  } catch {
    return { ok: false, error: "server" };
  }
}

/** International digits for WhatsApp (no +), or "" if it can't be a phone number.
    Numbers typed the local way (010…) get the default country code (Egypt, 20). */
export function normalizePhone(raw, countryCode = "20") {
  const s = String(raw || "").trim();
  if (!s) return "";
  let d = s.replace(/\D/g, "");
  if (s.startsWith("+")) { /* already international */ }
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = countryCode + d.slice(1);
  else if (d.length <= 10) d = countryCode + d;
  return d.length >= 8 && d.length <= 15 ? d : "";
}
export const validEmail = (s) => {
  const v = String(s || "").trim();
  return v.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
};
