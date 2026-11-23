/* Publishing from the admin dashboard: changes are committed straight to the site's GitHub
   repository with the GitHub REST API, one commit per change (images + data files).
   GitHub Pages then redeploys the site, usually within a minute.
   The access token is stored in this browser only (localStorage). */
import { t } from "./i18n.js?v=20261123002647";

const MAX_IMAGE_SIDE = 1600;

export const branchPath = (cfg) => cfg.branch.split("/").map(encodeURIComponent).join("/");

export async function gh(cfg, method, path, body) {
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
    throw new Error(t("errNetwork"));
  }
  if (res.ok) return res.status === 204 ? null : res.json();
  let detail = "";
  try { detail = (await res.json()).message || ""; } catch { /* no body */ }
  const known = { 401: "err401", 403: "err403", 404: "err404", 409: "err409", 422: "err422" }[res.status];
  const reason = known ? t(known) : t("errOther", { status: res.status });
  const err = new Error(detail ? `${reason} (${detail})` : reason);
  err.status = res.status;
  throw err;
}

/**
 * Checks the token: returns { repo: "owner/name", canWrite, reason }. Throws a translated error.
 * reason is "account" when the GitHub account can't push, "token" when the token itself is read-only.
 */
export async function checkConnection(cfg, dataPath) {
  const repo = await gh(cfg, "GET", "");
  await gh(cfg, "GET", `/git/ref/heads/${branchPath(cfg)}`);
  await gh(cfg, "GET", `/contents/${dataPath}?ref=${encodeURIComponent(cfg.branch)}`);
  if (repo.permissions && repo.permissions.push === false) return { repo: repo.full_name, canWrite: false, reason: "account" };
  // repo.permissions describes the account, not the token: a fine-grained token can still be read-only.
  // Saving a blob is a harmless write (no commit, no branch change; the same text always makes the same blob)
  // that fails when the token lacks "Contents: Read and write".
  try {
    await gh(cfg, "POST", "/git/blobs", { content: "The Best dashboard: write check\n", encoding: "utf-8" });
  } catch (err) {
    if (err.status === 403 || err.status === 404) return { repo: repo.full_name, canWrite: false, reason: "token" };
    throw err;
  }
  return { repo: repo.full_name, canWrite: true, reason: "" };
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

/** Resize to fit 1600px and re-encode as JPEG. Re-encoding also drops EXIF/GPS data from phone photos. */
export async function compressImage(file) {
  if (!file.type.startsWith("image/")) throw new Error(t("errNotImage", { name: file.name }));
  let source;
  try {
    source = await createImageBitmap(file);
  } catch {
    source = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error(t("errReadImage", { name: file.name })));
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
  if (!blob) throw new Error(t("errProcessImage"));
  return blob;
}

/* ---------------- committing ---------------- */
/** A JSON data file at a commit, or null when the file doesn't exist yet. */
async function readJsonAt(cfg, ref, path) {
  let file;
  try {
    file = await gh(cfg, "GET", `/contents/${path}?ref=${ref}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
  let b64 = file.content;
  if (!b64 || file.encoding !== "base64") b64 = (await gh(cfg, "GET", `/git/blobs/${file.sha}`)).content;
  return JSON.parse(base64ToUtf8(b64));
}

/**
 * One commit with new images and edited JSON data files.
 * `edits` maps a data file path to a function that changes that file's data in place (it may throw
 * to stop the publish). The files are read from the latest commit first, so changes made from
 * another device are never overwritten. Returns { sha, files: { [path]: newData } }.
 */
export async function commitData(cfg, { uploads = [], edits, message }) {
  const ref = await gh(cfg, "GET", `/git/ref/heads/${branchPath(cfg)}`);
  const baseSha = ref.object.sha;
  const updatedAt = new Date().toISOString();
  const files = {};
  for (const [path, edit] of Object.entries(edits)) {
    const data = (await readJsonAt(cfg, baseSha, path)) || {};
    edit(data);
    delete data.updatedAt;
    files[path] = { updatedAt, ...data };
  }

  const contents = [];
  for (const u of uploads) contents.push({ path: u.path, content: await blobToBase64(u.blob) });
  for (const [path, data] of Object.entries(files)) contents.push({ path, content: utf8ToBase64(`${JSON.stringify(data, null, 2)}\n`) });
  const tree = [];
  for (const c of contents) {
    const blob = await gh(cfg, "POST", "/git/blobs", { content: c.content, encoding: "base64" });
    tree.push({ path: c.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const baseCommit = await gh(cfg, "GET", `/git/commits/${baseSha}`);
  const newTree = await gh(cfg, "POST", "/git/trees", { base_tree: baseCommit.tree.sha, tree });
  const commit = await gh(cfg, "POST", "/git/commits", { message: `${message}\n\nPublished from the website.`, tree: newTree.sha, parents: [baseSha] });
  await gh(cfg, "PATCH", `/git/refs/heads/${branchPath(cfg)}`, { sha: commit.sha, force: false });
  return { sha: commit.sha, files };
}
