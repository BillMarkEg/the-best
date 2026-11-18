/* Upcoming championships on the public site: announcement cards with a live countdown,
   sign-up with an email or WhatsApp number (through the Google Apps Script service in
   data/config.json), cancelling a place, add-to-calendar and share on WhatsApp. */
import { t, tp, getLang, fmtDateTime, fmtRelative, tzName, iso } from "./i18n.js?v=20261118102123";
import {
  $, $$, esc, icon, fmt, avatar, showPlayer, champStatus, champName, champDetails, remindMinutes,
  fetchSignups, postSignup, normalizePhone, validEmail, toast, confirmBox,
} from "./core.js?v=20261118102123";

const LS_MEMBER = "thebest.member";   // this visitor's name / email / number, to fill the form next time
const LS_SIGNUPS = "thebest.signups"; // { [championshipId]: { token, nickname, channel } } signed up from this browser
const SHOW_AWAITING_MS = 2 * 86400e3; // "result coming soon" stays up to 2 days after the start
const SHOW_CANCELLED_MS = 86400e3;    // a cancelled championship stays visible until a day after its planned start

let S = null;          // the app state (championships, config)
let counts = null;     // { [id]: { count, names } } from the sign-up service, null until loaded
let countsFailed = false;
let countsApi = "";
let fetching = false;
let current = null;    // the championship in the sign-up dialog
let busy = false;
let statusKey = "";

const api = () => S?.config?.signupApi || "";
function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
const mySignups = () => readJSON(LS_SIGNUPS, {});
function forget(id, token = "") {
  const mine = mySignups();
  if (mine[id] && (!token || mine[id].token === token)) {
    delete mine[id];
    writeJSON(LS_SIGNUPS, mine);
  }
}

export function initAnnouncements(state) {
  S = state;
  const dialog = $("#signupDialog"), form = $("#signupForm");
  document.addEventListener("click", onClick);
  form.addEventListener("submit", onSubmit);
  form.addEventListener("change", (e) => { if (e.target.name === "channel") showChannel(); });
  dialog.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => { if (!busy) dialog.close(); }));
  dialog.addEventListener("cancel", (e) => { if (busy) e.preventDefault(); });
  setInterval(tick, 1000);
  setInterval(() => { if (!document.hidden) refreshCounts(true); }, 120000);
  handleCancelLink();
}

/** Links from emails and WhatsApp end in #announcements, but the section only appears once the data has loaded. */
let scrolled = false;
function scrollToSectionOnce() {
  if (scrolled || location.hash !== "#announcements" || $("#announcements").hidden) return;
  scrolled = true;
  requestAnimationFrame(() => $("#announcements").scrollIntoView());
}

/* ---------------- which championships to show ---------------- */
const ORDER = { live: 0, upcoming: 1, awaiting: 2, cancelled: 3 };
function visible(now = Date.now()) {
  return S.champs.championships
    .map((c) => ({ c, status: champStatus(c, now), start: Date.parse(c.startsAt) }))
    .filter(({ status, start }) =>
      status === "upcoming" || status === "live" ||
      (status === "awaiting" && now - start < SHOW_AWAITING_MS) ||
      (status === "cancelled" && now - start < SHOW_CANCELLED_MS))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.start - b.start);
}

/* ---------------- rendering ---------------- */
export function renderAnnouncements() {
  if (!S) return;
  const now = Date.now();
  const list = visible(now);
  statusKey = list.map((x) => `${x.c.id}:${x.status}`).join("|");
  $("#announcements").hidden = !list.length;
  $$('.site-nav a[href="#announcements"]').forEach((a) => { a.hidden = !list.length; });
  renderBanner(list, now);
  if (list.length) {
    const [first, ...rest] = list;
    $("#annFeatured").innerHTML = card(first, true, now);
    $("#annMore").innerHTML = rest.length
      ? `<h3 class="ann-more-title">${esc(t("annMore"))}</h3><div class="ann-grid">${rest.map((x) => card(x, false, now)).join("")}</div>`
      : "";
    updateCountdowns(now);
    scrollToSectionOnce();
  }
  if (api() && api() !== countsApi) refreshCounts();
}

const chip = (key, tone = "", vars = {}, ico = "") =>
  `<span class="status-chip${tone ? ` ${tone}` : ""}">${ico ? icon(ico) : ""}${esc(t(key, vars))}</span>`;

function card({ c, status, start }, featured, now) {
  const n = counts ? counts[c.id]?.count || 0 : null;
  const names = counts?.[c.id]?.names || [];
  const max = Number(c.maxPlayers) || 0;
  const full = Boolean(max && n !== null && n >= max);
  const mine = mySignups()[c.id];
  const when = fmtDateTime(c.startsAt);
  const tz = tzName(new Date(start));
  const whenText = status === "cancelled" ? t("annWas", { when }) : status === "upcoming" ? t("annStarts", { when }) : t("annStarted", { when });
  const kicker = { upcoming: featured ? t("annNext") : "", live: t("annLive"), awaiting: t("annAwaiting"), cancelled: t("annCancelled") }[status];

  // The kicker already says "Playing now" / "Result coming soon" / "Cancelled"; chips add the sign-up state.
  const chips = [];
  if (status === "upcoming") chips.push(api() ? (full ? chip("chipFull", "warn") : chip("chipOpen", "ok")) : chip("chipSoon"));
  if (max && n !== null && (status === "upcoming" || status === "live")) chips.push(chip("chipPlaces", "", { count: fmt(n), max: fmt(max) }, "users"));
  if (status === "upcoming" && api()) chips.push(chip("chipReminder", "", { minutes: fmt(remindMinutes(c)) }, "bell"));

  const details = champDetails(c);
  // Three parts, so the countdown can sit beside the text on wide screens and under the title on phones.
  return `
    <article class="card ann-card${featured ? " featured" : ""} is-${status}" data-champ="${esc(c.id)}">
      <div class="ann-head">
        ${kicker ? `<p class="kicker">${status === "live" ? '<span class="live-dot" aria-hidden="true"></span>' : ""}${esc(kicker)}</p>` : ""}
        <h3 class="ann-name"><bdi>${esc(champName(c))}</bdi></h3>
        <p class="ann-when">${icon("calendar")}<span>${esc(whenText)}${tz ? ` <span class="tz">(${esc(tz)})</span>` : ""}</span></p>
        ${chips.length ? `<div class="ann-chips">${chips.join("")}</div>` : ""}
      </div>
      ${status === "upcoming" ? countdownHtml(c, start - now) : ""}
      <div class="ann-rest">
        ${details ? `<p class="ann-details" dir="auto">${esc(details)}</p>` : ""}
        ${status !== "cancelled" && api() ? peopleHtml(n, names) : ""}
        ${actionsHtml(c, status, full, mine)}
      </div>
    </article>`;
}

function countdownHtml(c, ms) {
  const units = [["d", "cdDays"], ["h", "cdHours"], ["m", "cdMin"], ["s", "cdSec"]];
  return `
    <div class="countdown" data-countdown="${esc(c.startsAt)}" role="timer" aria-label="${esc(t("cdAria", { rel: fmtRelative(ms) }))}">
      ${units.map(([u, key]) => `<div class="cd-unit"><b data-u="${u}" aria-hidden="true">00</b><span aria-hidden="true">${esc(t(key))}</span></div>`).join("")}
    </div>`;
}

function peopleHtml(n, names) {
  if (n === null) return countsFailed ? `<p class="ann-people-note">${esc(t("annCountsError"))}</p>` : "";
  if (!n) return `<p class="ann-people-note">${esc(t("annNobody"))}</p>`;
  const shown = names.slice(0, 16);
  return `
    <div class="ann-people">
      <p class="ann-people-title">${icon("users")}<span>${esc(tp("signedUpN", n))}</span></p>
      <ul class="people">${shown.map((p) => `<li>${avatar(p)}<bdi>${esc(showPlayer(p))}</bdi></li>`).join("")}${names.length > shown.length ? `<li class="more">+${fmt(names.length - shown.length)}</li>` : ""}</ul>
    </div>`;
}

function actionsHtml(c, status, full, mine) {
  if (status !== "upcoming") return "";
  const parts = [];
  if (mine) parts.push(`<p class="ann-mine">${icon("check")}<span>${esc(t("annYoureIn", { name: iso(mine.nickname) }))}</span></p>`);
  else if (api() && !full) parts.push(`<button class="btn btn-primary" type="button" data-signup="${esc(c.id)}">${icon("bell")}<span>${esc(t("btnSignUp"))}</span></button>`);
  parts.push(`<button class="btn btn-ghost btn-sm" type="button" data-ics="${esc(c.id)}">${icon("calendar")}<span>${esc(t("btnCalendar"))}</span></button>`);
  parts.push(`<a class="btn btn-ghost btn-sm" href="${esc(waShareUrl(c))}" target="_blank" rel="noopener">${icon("chat")}<span>${esc(t("btnShareWa"))}</span></a>`);
  if (mine && api()) parts.push(`<button class="btn btn-ghost btn-sm danger" type="button" data-unsign="${esc(c.id)}">${esc(t("btnCancelPlace"))}</button>`);
  const note = api() ? t("annReminderNote", { minutes: fmt(remindMinutes(c)) }) : t("annSoonNote");
  return `<div class="ann-actions">${parts.join("")}</div><p class="ann-note">${esc(note)}</p>`;
}

/* The slim bar under the header: the next (or live) championship, visible on every screen size. */
function renderBanner(list, now) {
  const banner = $("#nextBanner");
  const next = list.find((x) => x.status === "live" || x.status === "upcoming");
  banner.hidden = !next;
  if (!next) return;
  const canSign = next.status === "upcoming" && api() && !mySignups()[next.c.id];
  banner.dataset.start = next.c.startsAt;
  banner.dataset.status = next.status;
  banner.dataset.name = champName(next.c);
  banner.innerHTML = `
    <div class="container next-inner">${icon("megaphone")}<span class="nb-text"></span>
      <a class="nb-cta" href="#announcements">${esc(t(canSign ? "bannerCta" : "bannerCtaView"))}</a>
    </div>`;
  updateBanner(now);
}
function updateBanner(now) {
  const banner = $("#nextBanner");
  if (banner.hidden || !banner.dataset.start) return;
  const name = iso(banner.dataset.name);
  banner.querySelector(".nb-text").textContent = banner.dataset.status === "live"
    ? t("bannerLive", { name })
    : t("bannerNext", { name, rel: fmtRelative(Date.parse(banner.dataset.start) - now) });
}

function updateCountdowns(now) {
  $$("[data-countdown]").forEach((el) => {
    const s = Math.floor(Math.max(0, Date.parse(el.dataset.countdown) - now) / 1000);
    const parts = { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
    for (const [u, v] of Object.entries(parts)) {
      const b = el.querySelector(`[data-u="${u}"]`);
      if (b) b.textContent = String(v).padStart(2, "0");
    }
  });
}

function tick() {
  if (!S) return;
  const now = Date.now();
  // A championship just started, or a status changed: draw the cards again.
  if (visible(now).map((x) => `${x.c.id}:${x.status}`).join("|") !== statusKey) {
    renderAnnouncements();
    return;
  }
  updateCountdowns(now);
  updateBanner(now);
}

/* ---------------- sign-up counts ---------------- */
async function refreshCounts(force = false) {
  const a = api();
  if (!a || fetching || (!force && a === countsApi)) return;
  countsApi = a;
  if (!visible().some((x) => x.status === "upcoming" || x.status === "live")) return;
  fetching = true;
  try {
    counts = await fetchSignups(a);
    countsFailed = false;
  } catch {
    countsFailed = true;
  } finally {
    fetching = false;
  }
  renderAnnouncements();
}

/* ---------------- actions ---------------- */
function onClick(e) {
  const el = e.target.closest?.("[data-signup],[data-ics],[data-unsign]");
  if (!el) return;
  const id = el.dataset.signup || el.dataset.ics || el.dataset.unsign;
  const c = S.champs.championships.find((x) => x.id === id);
  if (!c) return;
  if (el.hasAttribute("data-signup")) openSignup(c);
  else if (el.hasAttribute("data-ics")) downloadIcs(c);
  else cancelMine(c);
}

function setStatus(message, type = "") {
  const el = $("#suStatus");
  el.textContent = message;
  el.className = `form-status ${type}`;
}
function setBusy(on) {
  busy = on;
  $("#suSubmit").disabled = on;
  $$("#signupDialog [data-close]").forEach((b) => { b.disabled = on; });
}
function showStep(step) {
  const dialog = $("#signupDialog");
  dialog.querySelector('[data-step="form"]').hidden = step !== "form";
  dialog.querySelector('[data-step="done"]').hidden = step !== "done";
  $("#suSubmit").hidden = step !== "form";
  $("#suCancel").hidden = step !== "form";
  $("#suDone").hidden = step !== "done";
}
function showChannel() {
  const form = $("#signupForm");
  const ch = form.elements.channel.value;
  form.querySelector('[data-for="email"]').hidden = ch !== "email";
  form.querySelector('[data-for="whatsapp"]').hidden = ch !== "whatsapp";
  $("#suChannelNote").textContent = ch === "email" ? t("suEmailNote", { minutes: fmt(remindMinutes(current)) }) : t("suWaNote");
}

function openSignup(c) {
  current = c;
  const dialog = $("#signupDialog"), form = $("#signupForm"), f = form.elements;
  form.reset();
  form.querySelectorAll(".field.invalid").forEach((x) => x.classList.remove("invalid"));
  const me = readJSON(LS_MEMBER, {});
  f.nickname.value = me.nickname || "";
  f.email.value = me.email || "";
  f.phone.value = me.phone || "";
  const channel = me.channel === "whatsapp" ? "whatsapp" : "email";
  form.querySelector(`input[name="channel"][value="${channel}"]`).checked = true;
  $("#suFor").textContent = `${champName(c)} · ${fmtDateTime(c.startsAt)}`;
  showStep("form");
  showChannel();
  setStatus("");
  dialog.showModal();
  const first = !f.nickname.value ? f.nickname : channel === "email" ? f.email : f.phone;
  setTimeout(() => first.focus(), 30);
}

const ERRORS = {
  email: "suErrEmail", contact: "suErrEmail", phone: "suErrPhone", closed: "suErrClosed", full: "suErrFull",
  unknown: "suErrUnknown", rate: "suErrRate", busy: "suErrBusy", network: "suErrNetwork",
};
const errorText = (code) => (ERRORS[code] ? t(ERRORS[code]) : t("suErrOther", { code: code || "?" }));

async function onSubmit(e) {
  e.preventDefault();
  if (busy || !current) return;
  const form = e.currentTarget, f = form.elements;
  form.querySelectorAll(".field.invalid").forEach((x) => x.classList.remove("invalid"));
  const nickname = f.nickname.value.trim().replace(/\s+/g, " ").slice(0, 40);
  const channel = f.channel.value === "whatsapp" ? "whatsapp" : "email";
  const email = f.email.value.trim();
  const phone = normalizePhone(f.phone.value);
  const fail = (field, key) => {
    field.closest(".field").classList.add("invalid");
    field.focus();
    setStatus(t(key), "error");
  };
  if (!nickname) return fail(f.nickname, "suErrName");
  if (channel === "email" && !validEmail(email)) return fail(f.email, "suErrEmail");
  if (channel === "whatsapp" && !phone) return fail(f.phone, "suErrPhone");
  if (!api()) return setStatus(t("annSoonNote"), "warn");

  setBusy(true);
  setStatus(t("suSending"));
  const res = await postSignup(api(), {
    action: "register",
    championshipId: current.id,
    nickname,
    email: channel === "email" ? email : "",
    phone: channel === "whatsapp" ? phone : "",
    lang: getLang(),
    website: f.website.value, // hidden field: only bots fill it in
  });
  setBusy(false);
  if (!res.ok) return setStatus(errorText(res.error), "error");

  const me = readJSON(LS_MEMBER, {});
  writeJSON(LS_MEMBER, {
    nickname,
    channel,
    email: channel === "email" ? email : me.email || "",
    phone: channel === "whatsapp" ? f.phone.value.trim() : me.phone || "",
  });
  const mine = mySignups();
  mine[current.id] = { token: res.token || "", nickname, channel, at: Date.now() };
  writeJSON(LS_SIGNUPS, mine);
  if (typeof res.count === "number") {
    counts = { ...(counts || {}), [current.id]: { count: res.count, names: res.names || [] } };
    countsFailed = false;
  }
  const done = channel === "email" ? t("suDoneEmail", { minutes: fmt(remindMinutes(current)) }) : t("suDoneWa");
  $("#suDoneText").textContent = res.already ? `${t("suAlready")} ${done}` : done;
  $("#suDoneIcs").dataset.ics = current.id;
  setStatus("");
  showStep("done");
  $("#suDone").focus();
  renderAnnouncements();
}

async function cancelMine(c) {
  const mine = mySignups()[c.id];
  if (!mine || !api()) return;
  const ok = await confirmBox({ title: t("cancelTitle"), message: t("cancelMsg", { name: champName(c) }), ok: t("btnYesCancel"), cancel: t("btnKeep"), danger: true });
  if (!ok) return;
  const res = await postSignup(api(), { action: "cancel", token: mine.token });
  if (!res.ok && res.error !== "notfound") return toast(errorText(res.error), "error");
  forget(c.id);
  if (res.ok && typeof res.count === "number") counts = { ...(counts || {}), [c.id]: { count: res.count, names: res.names || [] } };
  toast(res.ok ? t("cancelDone", { name: champName(c) }) : t("cancelGone"), "ok");
  renderAnnouncements();
  if (!res.ok) refreshCounts(true);
}

/** The cancel link in the confirmation email: ?cancel=<token>&c=<championship id>. */
async function handleCancelLink() {
  const url = new URL(location.href);
  const token = url.searchParams.get("cancel");
  if (!token) return;
  const id = url.searchParams.get("c") || "";
  url.searchParams.delete("cancel");
  url.searchParams.delete("c");
  history.replaceState(null, "", url);
  const c = S.champs.championships.find((x) => x.id === id);
  const ok = await confirmBox({
    title: t("cancelTitle"),
    message: c ? t("cancelMsg", { name: champName(c) }) : t("cancelMsgGeneric"),
    ok: t("btnYesCancel"),
    cancel: t("btnKeep"),
    danger: true,
  });
  if (!ok) return;
  if (!api()) return toast(t("suErrNetwork"), "error");
  const res = await postSignup(api(), { action: "cancel", token });
  if (!res.ok && res.error !== "notfound") return toast(errorText(res.error), "error");
  forget(res.championshipId || id, token);
  toast(res.ok ? (c ? t("cancelDone", { name: champName(c) }) : t("cancelDoneGeneric")) : t("cancelGone"), "ok");
  refreshCounts(true);
}

/* ---------------- calendar & sharing ---------------- */
const pageUrl = () => `${location.origin}${location.pathname.replace(/index\.html$/, "")}${getLang() === "ar" ? "?lang=ar" : ""}#announcements`;

function waShareUrl(c) {
  const when = `${fmtDateTime(c.startsAt)} (${tzName(new Date(c.startsAt))})`;
  return `https://wa.me/?text=${encodeURIComponent(t("waShareText", { name: champName(c), when, url: pageUrl() }))}`;
}

/** iCalendar lines are folded at 75 bytes; Arabic letters take 2 bytes each in UTF-8. */
function fold(line) {
  const enc = new TextEncoder();
  let out = "", cur = "", bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > 74) {
      out += `${cur}\r\n `;
      cur = "";
      bytes = 1;
    }
    cur += ch;
    bytes += b;
  }
  return out + cur;
}
function icsFor(c) {
  const start = new Date(c.startsAt), end = new Date(start.getTime() + 2 * 3600e3);
  const stamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const text = (s) => String(s).replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);
  const url = pageUrl();
  const description = [champDetails(c), t("calDetails", { url })].filter(Boolean).join("\n\n");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The Best//Championships//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${c.id}@the-best`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${text(champName(c))}`, `DESCRIPTION:${text(description)}`, `URL:${url}`,
    "BEGIN:VALARM", `TRIGGER:-PT${remindMinutes(c)}M`, "ACTION:DISPLAY", `DESCRIPTION:${text(champName(c))}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR", "",
  ].map(fold).join("\r\n");
}
function downloadIcs(c) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([icsFor(c)], { type: "text/calendar;charset=utf-8" }));
  a.download = `${c.id}.ics`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
