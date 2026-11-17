/* Add / edit / delete eFootball winners from the website.

   Changes are committed straight to the site's GitHub repository with the
   GitHub REST API (one commit per change: the images + data/efootball.json).
   GitHub Pages then redeploys the site, usually within a minute.
   The access token is stored in this browser only (localStorage). */

import { state, applyEfootball, toast, teamName, readGithubConfig, registerLocalImage, renderAll } from "./app.js";

const LS_GITHUB = "thebest.github";
const DATA_PATH = "data/efootball.json";
const IMG_DIR = "assets/img/news";
const MAX_IMAGE_SIDE = 1600;

const $ = (sel, root = document) => root.querySelector(sel);
let dialog, form, editing = null, busy = false;
const objectUrls = [];

export function initAdmin() {
  dialog = $("#winnerDialog");
  form = $("#winnerForm");
  document.addEventListener("click", onDocumentClick);
  form.addEventListener("submit", onSubmit);
  dialog.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => closeDialog()));
  dialog.addEventListener("cancel", (e) => { if (busy) e.preventDefault(); });
  dialog.addEventListener("close", resetDialog);
  dialog.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));
  $("#winFile").addEventListener("change", () => previewFile("winFile", "winPreview"));
  $("#coverFile").addEventListener("change", () => previewFile("coverFile", "coverPreview"));
  $("#ghTest").addEventListener("click", testConnection);
  $("#ghForget").addEventListener("click", forgetToken);
  refreshAdminMode();
  if (location.hash === "#add") openEditor(null);
}

/* ---------------- dialog ---------------- */
function refreshAdminMode() {
  const connected = Boolean(readGithubConfig().token);
  document.body.classList.toggle("is-admin", connected);
  $("#connDot").classList.toggle("on", connected);
}

function onDocumentClick(e) {
  const target = e.target.closest?.("[data-add],[data-edit],[data-delete]");
  if (!target) return;
  if (target.hasAttribute("data-add")) return openEditor(null);
  const id = target.dataset.edit || target.dataset.delete;
  const winner = state.ef.winners.find((w) => w.id === id);
  if (!winner) return;
  if (target.hasAttribute("data-edit")) openEditor(winner);
  else removeWinner(winner);
}

function showTab(name) {
  dialog.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
  dialog.querySelectorAll(".panel").forEach((p) => { p.hidden = p.dataset.panel !== name; });
}

function setStatus(message, type = "") {
  const el = $("#formStatus");
  el.textContent = message;
  el.className = `form-status ${type}`;
}

function setBusy(on) {
  busy = on;
  $("#publishBtn").disabled = on;
  $("#ghTest").disabled = on;
  dialog.querySelectorAll("[data-close]").forEach((b) => { b.disabled = on; });
}

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

function setPreview(previewId, src) {
  const box = $(`#${previewId}`);
  box.replaceChildren();
  if (src) {
    const im = new Image();
    im.alt = "";
    im.src = state.localImages.get(src) || src;
    box.append(im);
  } else {
    box.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-image"/></svg>';
  }
}

function previewFile(inputId, previewId) {
  const file = $(`#${inputId}`).files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  objectUrls.push(url);
  setPreview(previewId, url);
}

const FIELDS = ["player", "team", "event", "date", "runnerUp", "score", "star", "competitors", "headline", "story", "coverCredit"];

function openEditor(winner) {
  editing = winner;
  form.reset();
  form.querySelectorAll(".field.invalid").forEach((f) => f.classList.remove("invalid"));
  $("#dialogTitle").textContent = winner ? "Edit winner" : "Add a new winner";
  $("#publishBtn span").textContent = winner ? "Save changes" : "Publish";
  const f = form.elements;
  if (winner) FIELDS.forEach((k) => { f[k].value = winner[k] || ""; });
  else { f.event.value = "eFootball"; f.date.value = today(); }
  setPreview("winPreview", winner?.winImage);
  setPreview("coverPreview", winner?.cover);
  $("#winRemoveWrap").hidden = !winner?.winImage;
  $("#coverRemoveWrap").hidden = !winner?.cover;
  fillGithubFields();
  showTab("winner");
  setStatus(readGithubConfig().token ? "" : "Not connected to GitHub on this device yet. You'll be asked when you publish.", readGithubConfig().token ? "" : "warn");
  dialog.showModal();
  setTimeout(() => f.player.focus(), 30);
}

function closeDialog(force = false) {
  if (busy && !force) return;
  dialog.close();
}

function resetDialog() {
  editing = null;
  objectUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));
  setStatus("");
}

/* ---------------- GitHub connection ---------------- */
function fillGithubFields() {
  const cfg = readGithubConfig(), f = form.elements;
  f.ghOwner.value = cfg.owner;
  f.ghRepo.value = cfg.repo;
  f.ghBranch.value = cfg.branch;
  f.ghToken.value = "";
  f.ghToken.placeholder = cfg.token ? "Saved on this device ✓ (paste to replace)" : "github_pat_…";
}

function saveGithubFields() {
  const f = form.elements, current = readGithubConfig();
  const cfg = {
    owner: f.ghOwner.value.trim(),
    repo: f.ghRepo.value.trim(),
    branch: f.ghBranch.value.trim() || "main",
    token: f.ghToken.value.trim() || current.token,
  };
  try { localStorage.setItem(LS_GITHUB, JSON.stringify(cfg)); } catch { /* storage unavailable */ }
  return cfg;
}

async function testConnection() {
  const cfg = saveGithubFields();
  fillGithubFields();
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    setStatus("Fill in the GitHub user/org, repository and token.", "error");
    return;
  }
  setBusy(true);
  setStatus("Checking the connection…");
  try {
    const repo = await gh(cfg, "GET", "");
    await gh(cfg, "GET", `/git/ref/heads/${branchPath(cfg)}`);
    await gh(cfg, "GET", `/contents/${DATA_PATH}?ref=${encodeURIComponent(cfg.branch)}`);
    const canWrite = repo.permissions ? repo.permissions.push !== false : true;
    refreshAdminMode();
    renderAll();
    if (canWrite) {
      setStatus(`Connected to ${repo.full_name} ✓ You can publish winners now.`, "ok");
      setTimeout(() => { if (dialog.open) showTab("winner"); }, 900);
    } else {
      setStatus(`Connected, but this account can't push to ${repo.full_name}.`, "error");
    }
  } catch (err) {
    setStatus(err.message, "error");
  } finally {
    setBusy(false);
  }
}

function forgetToken() {
  const cfg = readGithubConfig();
  try { localStorage.setItem(LS_GITHUB, JSON.stringify({ ...cfg, token: "" })); } catch { /* storage unavailable */ }
  fillGithubFields();
  refreshAdminMode();
  renderAll();
  setStatus("Token removed from this device.", "ok");
}

const branchPath = (cfg) => cfg.branch.split("/").map(encodeURIComponent).join("/");

async function gh(cfg, method, path, body) {
  // "thebest.apiBase" lets a local mock API stand in for GitHub while testing; normally unset.
  const base = (localStorage.getItem("thebest.apiBase") || "https://api.github.com").replace(/\/$/, "");
  let res;
  try {
    res = await fetch(`${base}/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}${path}`, {
      method,
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${cfg.token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Couldn't reach GitHub. Check your internet connection and try again.");
  }
  if (res.ok) return res.status === 204 ? null : res.json();
  let detail = "";
  try { detail = (await res.json()).message || ""; } catch { /* no body */ }
  const reason = {
    401: "GitHub rejected the token (expired or mistyped?).",
    403: "This token can't write to the repository. It needs “Contents: Read and write”.",
    404: "Repository, branch or data file not found. Check the GitHub connection settings.",
    409: "GitHub reported a conflict. Please try again.",
    422: "Someone else published at the same moment. Please try again.",
  }[res.status];
  throw new Error(reason ? `${reason}${detail ? ` (${detail})` : ""}` : `GitHub error ${res.status}${detail ? `: ${detail}` : ""}`);
}

/* ---------------- encoding helpers ---------------- */
function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const base64ToUtf8 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(",")[1]);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});
const slug = (s) => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "winner";

/** Resize to fit 1600px and re-encode as JPEG. Re-encoding also drops EXIF/GPS data from phone photos. */
async function compressImage(file) {
  if (!file.type.startsWith("image/")) throw new Error(`“${file.name}” isn't an image.`);
  let source;
  try {
    source = await createImageBitmap(file);
  } catch {
    source = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error(`Couldn't read “${file.name}”. Try a JPG or PNG.`));
      im.src = URL.createObjectURL(file);
    });
  }
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0b1120";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Couldn't process the image.");
  return blob;
}

/* ---------------- committing ---------------- */
async function readDataAt(cfg, ref) {
  const file = await gh(cfg, "GET", `/contents/${DATA_PATH}?ref=${ref}`);
  let b64 = file.content;
  if (!b64 || file.encoding !== "base64") b64 = (await gh(cfg, "GET", `/git/blobs/${file.sha}`)).content;
  return JSON.parse(base64ToUtf8(b64));
}

/** One commit containing the new images and the updated data file. `mutate` edits the data and returns the commit message. */
async function commitChange(cfg, files, mutate) {
  const ref = await gh(cfg, "GET", `/git/ref/heads/${branchPath(cfg)}`);
  const baseSha = ref.object.sha;
  const data = await readDataAt(cfg, baseSha); // always edit the latest published version
  data.winners = Array.isArray(data.winners) ? data.winners : [];
  const message = mutate(data);
  data.updatedAt = new Date().toISOString();
  const out = { updatedAt: data.updatedAt, ...data };

  const contents = [];
  for (const f of files) contents.push({ path: f.path, content: await blobToBase64(f.blob) });
  contents.push({ path: DATA_PATH, content: utf8ToBase64(`${JSON.stringify(out, null, 2)}\n`) });
  const tree = [];
  for (const c of contents) {
    const blob = await gh(cfg, "POST", "/git/blobs", { content: c.content, encoding: "base64" });
    tree.push({ path: c.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const baseCommit = await gh(cfg, "GET", `/git/commits/${baseSha}`);
  const newTree = await gh(cfg, "POST", "/git/trees", { base_tree: baseCommit.tree.sha, tree });
  const commit = await gh(cfg, "POST", "/git/commits", { message: `${message}\n\nPublished from the website.`, tree: newTree.sha, parents: [baseSha] });
  await gh(cfg, "PATCH", `/git/refs/heads/${branchPath(cfg)}`, { sha: commit.sha, force: false });
  return { sha: commit.sha, data: out };
}

async function onSubmit(e) {
  e.preventDefault();
  if (busy) return;
  const f = form.elements;
  const val = (k) => f[k].value.trim();
  const fields = Object.fromEntries(FIELDS.map((k) => [k, val(k)]));
  fields.event = fields.event || "eFootball";

  form.querySelectorAll(".field.invalid").forEach((el) => el.classList.remove("invalid"));
  const missing = ["player", "team"].filter((k) => !fields[k]);
  if (missing.length) {
    missing.forEach((k) => f[k].closest(".field").classList.add("invalid"));
    showTab("winner");
    f[missing[0]].focus();
    setStatus("Champion and team are required.", "error");
    return;
  }
  const cfg = readGithubConfig();
  if (!cfg.token || !cfg.owner || !cfg.repo) {
    fillGithubFields();
    showTab("github");
    setStatus("Connect to GitHub first: fill in these fields and press “Save & test connection”. Your winner details are kept.", "warn");
    return;
  }

  const wasEditing = editing;
  setBusy(true);
  try {
    const stamp = Date.now().toString(36);
    const id = wasEditing?.id || `${slug(fields.player)}-${slug(fields.team)}-${stamp}`;
    let winImage = wasEditing?.winImage || "";
    let cover = wasEditing?.cover || "";
    let coverCreditUrl = wasEditing?.coverCreditUrl || "";
    if (f.removeWin.checked) winImage = "";
    if (f.removeCover.checked) { cover = ""; coverCreditUrl = ""; }

    const uploads = [];
    const winFile = $("#winFile").files[0], coverFile = $("#coverFile").files[0];
    if (winFile || coverFile) setStatus("Resizing images…");
    if (winFile) {
      winImage = `${IMG_DIR}/${id}-win-${stamp}.jpg`;
      uploads.push({ path: winImage, blob: await compressImage(winFile) });
    }
    if (coverFile) {
      cover = `${IMG_DIR}/${id}-cover-${stamp}.jpg`;
      coverCreditUrl = "";
      uploads.push({ path: cover, blob: await compressImage(coverFile) });
    }

    setStatus("Publishing to GitHub…");
    const entry = { id, ...fields, winImage, cover, coverCreditUrl };
    const result = await commitChange(cfg, uploads, (data) => {
      if (wasEditing) {
        const i = data.winners.findIndex((w) => w.id === wasEditing.id);
        if (i < 0) throw new Error("This winner isn't in the published data any more (deleted elsewhere?). Reload the page.");
        data.winners[i] = { ...data.winners[i], ...entry };
        return `Update winner: ${entry.player} (${entry.team})`;
      }
      data.winners.push(entry);
      return `Add winner: ${entry.player} (${entry.team})`;
    });
    uploads.forEach((u) => registerLocalImage(u.path, u.blob));
    applyEfootball(result.data, { pending: true });
    closeDialog(true);
    toast(wasEditing ? "Saved ✓ The site updates for everyone in about a minute." : `🏆 ${entry.player} added! Live for everyone in about a minute.`, "ok");
    if (!wasEditing) document.getElementById("top").scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    console.error(err);
    setStatus(err.message || String(err), "error");
  } finally {
    setBusy(false);
  }
}

async function removeWinner(winner) {
  const cfg = readGithubConfig();
  if (!cfg.token) {
    openEditor(null);
    showTab("github");
    return;
  }
  const label = `${winner.player} – ${teamName(winner.team)}`;
  if (!window.confirm(`Delete “${label}” from the eFootball champions?\n\nThis publishes the change to the website.`)) return;
  toast("Deleting…");
  try {
    const result = await commitChange(cfg, [], (data) => {
      const before = data.winners.length;
      data.winners = data.winners.filter((w) => w.id !== winner.id);
      if (data.winners.length === before) throw new Error("That winner was already removed.");
      return `Remove winner: ${winner.player} (${winner.team})`;
    });
    applyEfootball(result.data, { pending: true });
    toast(`Deleted “${label}”. The site updates for everyone in about a minute.`, "ok");
  } catch (err) {
    toast(err.message || String(err), "error");
  }
}
