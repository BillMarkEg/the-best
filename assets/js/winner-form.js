/* The winner form on the admin dashboard: record a championship's winner, or edit / delete a winner.
   One commit per change: the images, data/efootball.json and (when linked) data/championships.json. */
import { t, fmtDateTime } from "./i18n.js?v=20261123002532";
import {
  $, slug, readGithubConfig, registerLocalImage, toast, confirmBox, showPlayer, showTeam, champName, store,
  DATA_EF, DATA_CHAMPS,
} from "./core.js?v=20261123002532";
import { commitData, compressImage } from "./github.js?v=20261123002532";

const IMG_DIR = "assets/img/news";
const FIELDS = ["player", "team", "event", "date", "runnerUp", "score", "star", "competitors", "headline", "story", "coverCredit"];
const AR_FIELDS = ["teamAr", "eventAr", "starAr", "headlineAr", "storyAr"];

let dialog, form, editing = null, champ = null, busy = false, onSaved = () => {};
const objectUrls = [];

export function initWinnerForm({ saved }) {
  onSaved = saved;
  dialog = $("#winnerDialog");
  form = $("#winnerForm");
  form.addEventListener("submit", onSubmit);
  dialog.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => closeDialog()));
  dialog.addEventListener("cancel", (e) => { if (busy) e.preventDefault(); });
  dialog.addEventListener("close", resetDialog);
  $("#winFile").addEventListener("change", () => previewFile("winFile", "winPreview"));
  $("#coverFile").addEventListener("change", () => previewFile("coverFile", "coverPreview"));
}

function setStatus(message, type = "") {
  const el = $("#formStatus");
  el.textContent = message;
  el.className = `form-status ${type}`;
}
function setBusy(on) {
  busy = on;
  $("#publishBtn").disabled = on;
  dialog.querySelectorAll("[data-close]").forEach((b) => { b.disabled = on; });
}
const pad = (n) => String(n).padStart(2, "0");
const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function setPreview(previewId, src) {
  const box = $(`#${previewId}`);
  box.replaceChildren();
  if (src) {
    const im = new Image();
    im.alt = "";
    im.src = store.localImages.get(src) || src;
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

/** { championship, signups } records a championship's winner; { winner, championship } edits one. */
export function openWinnerForm({ winner = null, championship = null, signups = 0 } = {}) {
  editing = winner;
  champ = championship;
  form.reset();
  form.querySelectorAll(".field.invalid").forEach((f) => f.classList.remove("invalid"));
  $("#dialogTitle").textContent = t(winner ? "dlgEdit" : "dlgAdd");
  $("#publishBtn span").textContent = t(winner ? "btnSave" : "btnPublish");
  const f = form.elements;
  if (winner) {
    [...FIELDS, ...AR_FIELDS].forEach((k) => { f[k].value = winner[k] || ""; });
  } else if (championship) {
    f.event.value = championship.name;
    f.eventAr.value = championship.nameAr || "";
    f.date.value = localDate(new Date(championship.startsAt));
    if (signups) f.competitors.value = String(signups);
  } else {
    f.event.value = "eFootball";
    f.date.value = localDate(new Date());
  }
  const banner = $("#winnerChamp");
  banner.hidden = !championship;
  banner.textContent = championship ? t("winnerFor", { name: champName(championship), when: fmtDateTime(championship.startsAt, { year: true }) }) : "";
  form.querySelector(".ar-fields").open = AR_FIELDS.some((k) => f[k].value);
  setPreview("winPreview", winner?.winImage);
  setPreview("coverPreview", winner?.cover);
  $("#winRemoveWrap").hidden = !winner?.winImage;
  $("#coverRemoveWrap").hidden = !winner?.cover;
  setStatus("");
  dialog.showModal();
  setTimeout(() => f.player.focus(), 30);
}

function closeDialog(force = false) {
  if (busy && !force) return;
  dialog.close();
}
function resetDialog() {
  editing = null;
  champ = null;
  objectUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));
  setStatus("");
}

/** Winners are listed in the order they were won, so a back-filled winner goes in by date. */
function insertByDate(list, entry) {
  let i = list.length;
  if (entry.date) while (i > 0 && list[i - 1].date && list[i - 1].date > entry.date) i--;
  list.splice(i, 0, entry);
}

async function onSubmit(e) {
  e.preventDefault();
  if (busy) return;
  const f = form.elements;
  const val = (k) => f[k].value.trim();
  const fields = Object.fromEntries([...FIELDS, ...AR_FIELDS].map((k) => [k, val(k)]));
  fields.event = fields.event || "eFootball";

  form.querySelectorAll(".field.invalid").forEach((el) => el.classList.remove("invalid"));
  const missing = ["player", "team"].filter((k) => !fields[k]);
  if (missing.length) {
    missing.forEach((k) => f[k].closest(".field").classList.add("invalid"));
    f[missing[0]].focus();
    setStatus(t("stRequired"), "error");
    return;
  }

  const wasEditing = editing, forChamp = wasEditing ? null : champ;
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
    if (winFile || coverFile) setStatus(t("stResizing"));
    if (winFile) {
      winImage = `${IMG_DIR}/${id}-win-${stamp}.jpg`;
      uploads.push({ path: winImage, blob: await compressImage(winFile) });
    }
    if (coverFile) {
      cover = `${IMG_DIR}/${id}-cover-${stamp}.jpg`;
      coverCreditUrl = "";
      uploads.push({ path: cover, blob: await compressImage(coverFile) });
    }

    setStatus(t("stPublishing"));
    const entry = { id, ...(forChamp ? { championshipId: forChamp.id } : {}), ...fields, winImage, cover, coverCreditUrl };
    const edits = {
      [DATA_EF]: (data) => {
        data.winners = Array.isArray(data.winners) ? data.winners : [];
        if (wasEditing) {
          const i = data.winners.findIndex((w) => w.id === wasEditing.id);
          if (i < 0) throw new Error(t("errGone"));
          data.winners[i] = { ...data.winners[i], ...entry };
        } else {
          insertByDate(data.winners, entry);
        }
      },
    };
    if (forChamp) {
      edits[DATA_CHAMPS] = (data) => {
        const c = (data.championships || []).find((x) => x.id === forChamp.id);
        if (!c) throw new Error(t("errChampGone"));
        c.winnerId = id;
        delete c.cancelled;
      };
    }
    const message = wasEditing
      ? `Update winner: ${entry.player} (${entry.team})`
      : `Add winner: ${entry.player} (${entry.team})${forChamp ? ` for ${forChamp.name}` : ""}`;
    const result = await commitData(readGithubConfig(), { uploads, edits, message });
    uploads.forEach((u) => registerLocalImage(u.path, u.blob));
    closeDialog(true);
    onSaved(result.files);
    toast(wasEditing ? t("toastSaved") : t("toastAdded", { player: showPlayer(entry.player) }), "ok");
  } catch (err) {
    console.error(err);
    setStatus(err.message || String(err), "error");
  } finally {
    setBusy(false);
  }
}

export async function removeWinner(winner) {
  const label = `${showPlayer(winner.player)} – ${showTeam(winner)}`;
  const ok = await confirmBox({ title: t("confirmDeleteWinnerTitle"), message: t("confirmDelete", { label }), ok: t("btnDelete"), danger: true });
  if (!ok) return;
  toast(t("toastDeleting"));
  try {
    const edits = {
      [DATA_EF]: (data) => {
        const before = (data.winners || []).length;
        data.winners = (data.winners || []).filter((w) => w.id !== winner.id);
        if (data.winners.length === before) throw new Error(t("errAlreadyRemoved"));
      },
    };
    if (winner.championshipId) {
      // Its championship goes back to "needs a winner".
      edits[DATA_CHAMPS] = (data) => {
        data.championships = data.championships || [];
        for (const c of data.championships) if (c.winnerId === winner.id) delete c.winnerId;
      };
    }
    const result = await commitData(readGithubConfig(), { edits, message: `Remove winner: ${winner.player} (${winner.team})` });
    onSaved(result.files);
    toast(t("toastDeleted", { label }), "ok");
  } catch (err) {
    toast(err.message || String(err), "error");
  }
}
