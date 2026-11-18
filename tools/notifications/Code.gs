/**
 * THE BEST · championship sign-ups and reminders (Google Apps Script)
 *
 * Free, and runs in your own Google account:
 *   - players sign up for a championship on the website, with an email address or a WhatsApp number
 *   - sign-ups are saved in a private Google Sheet that only you can open
 *   - email sign-ups get a confirmation, then a reminder shortly before the start
 *     (15, 20 or 30 minutes, as set for each championship in the site's admin dashboard)
 *   - for WhatsApp sign-ups you get an email with one-tap WhatsApp links, so you send the reminder
 *     from your own phone (automatic WhatsApp messages need Meta's paid Business API)
 *   - players get an email when a championship's time changes, or it's called off or back on
 *
 * Set-up, once (about 5 minutes; the admin dashboard shows the same steps):
 *   1. Open https://script.new, paste this whole file and save.
 *   2. Choose the setup function, press Run and allow the permissions.
 *   3. Deploy > New deployment > Web app, Execute as: Me, Who has access: Anyone > Deploy.
 *   4. Paste the web app URL into the dashboard: Sign-ups & reminders > Save to site.
 * After changing this file: Deploy > Manage deployments > Edit > Version: New version > Deploy.
 *
 * You can cancel a player's place by typing "cancelled" in the Status column of the sheet.
 */

// ---------- Settings ----------
const SITE_URL = "https://billmarkeg.github.io/the-best/";
const TIME_ZONE = "Africa/Cairo"; // emails show times in this time zone
const TIME_ZONE_LABEL = { en: "Cairo time", ar: "بتوقيت القاهرة" };
const ADMIN_EMAIL = ""; // who gets the WhatsApp links and sign-up news; empty = the account running this script
const ADMIN_LANG = "en"; // "en" or "ar": the language of the emails you get
const DEFAULT_COUNTRY_CODE = "20"; // numbers typed the local way (010…) are Egyptian: +20 10…
const EMAIL_ADMIN_ON_SIGNUP = true; // also email you when someone signs up or cancels
const SENDER_NAME = "The Best";

// ---------- Sheet layout ----------
const SIGNUPS = "Sign-ups";
const LOG = "Log";
const HEADERS = ["Signed up", "Championship", "Championship ID", "Name", "Email", "Phone", "WhatsApp", "Language", "Status", "Reminded", "Token"];
const COL = { at: 0, champ: 1, champId: 2, name: 3, email: 4, phone: 5, wa: 6, lang: 7, status: 8, reminded: 9, token: 10 };
const LIVE_HOURS = 6; // a championship counts as being played for 6 hours after its start
const REMINDER_GRACE_MIN = 15; // a late run can still send the reminder up to 15 minutes after the start

/* ================= Set-up ================= */

/** Run once from the editor: creates the sheet and the 5-minute reminder timer, and emails you the sheet link. */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let book = null;
  const id = props.getProperty("SHEET_ID");
  if (id) {
    try { book = SpreadsheetApp.openById(id); } catch (err) { book = null; }
  }
  if (!book) book = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.create("The Best · sign-ups");
  props.setProperty("SHEET_ID", book.getId());
  sheet_(book, SIGNUPS, HEADERS);
  sheet_(book, LOG, ["Time", "Event", "Championship", "Details"]);

  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === "tick") ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger("tick").timeBased().everyMinutes(5).create();

  const lang = adminLang_(), L = TEXT[lang];
  send_(adminEmail_(), lang, L.setupSubject, L.setupTitle, [
    L.setupIntro,
    { html: link_(book.getUrl(), L.setupSheet), text: book.getUrl() },
    L.setupNext,
  ], [], L.adminFooter);
  log_("setup", "", book.getUrl());
  Logger.log("Sign-ups sheet: " + book.getUrl());
  Logger.log("Next: Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone), then paste the web app URL in the site's admin dashboard.");
}

function sheet_(book, name, headers) {
  let sh = book.getSheetByName(name);
  if (!sh) {
    const sheets = book.getSheets();
    // A brand-new spreadsheet has one empty sheet: use it for the sign-ups.
    if (name === SIGNUPS && sheets.length === 1 && sheets[0].getLastRow() === 0) {
      sh = sheets[0];
      sh.setName(name);
    } else {
      sh = book.insertSheet(name);
    }
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sh;
}

function book_() {
  const id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  if (!id) throw new Error("Run setup() first.");
  return SpreadsheetApp.openById(id);
}

function signupSheet_() {
  return sheet_(book_(), SIGNUPS, HEADERS);
}

/* ================= Web app (called by the website) ================= */

function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : "";
  try {
    if (action === "list") return json_(publicList_());
    return json_({ ok: true, service: "the-best-signups", version: 1 });
  } catch (err) {
    log_("error", "", String(err && err.stack ? err.stack : err));
    return json_({ ok: false, error: "server" });
  }
}

function doPost(e) {
  let p;
  try {
    p = JSON.parse(e && e.postData ? e.postData.contents : "{}");
  } catch (err) {
    return json_({ ok: false, error: "invalid" });
  }
  try {
    if (p && p.action === "register") return json_(register_(p));
    if (p && p.action === "cancel") return json_(cancel_(p));
    return json_({ ok: false, error: "invalid" });
  } catch (err) {
    log_("error", "", String(err && err.stack ? err.stack : err));
    return json_({ ok: false, error: "server" });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Public: how many players signed up for each championship, and their names (never emails or numbers). */
function publicList_() {
  const out = {};
  readRows_(signupSheet_()).forEach(function (r) {
    if (r.status !== "active") return;
    const o = out[r.champId] || (out[r.champId] = { count: 0, names: [] });
    o.count += 1;
    o.names.push(r.name);
  });
  return { ok: true, championships: out };
}

function register_(p) {
  if (p.website) return { ok: true, token: "", count: 0, names: [] }; // only bots fill the hidden "website" field
  const lang = p.lang === "ar" ? "ar" : "en";
  const champId = clean_(p.championshipId, 80);
  const name = clean_(p.nickname, 40);
  const email = clean_(p.email, 120).toLowerCase();
  const phone = p.phone ? normalizePhone_(p.phone) : "";
  if (!champId || !name) return { ok: false, error: "invalid" };
  if (email && !validEmail_(email)) return { ok: false, error: "email" };
  if (p.phone && !phone) return { ok: false, error: "phone" };
  if (!email && !phone) return { ok: false, error: "contact" };
  if (!rateOk_(email || phone)) return { ok: false, error: "rate" };

  // A championship announced a moment ago may not be in the cached list yet: look again without the cache.
  const champ = findChamp_(champId, false) || findChamp_(champId, true);
  if (!champ) return { ok: false, error: "unknown" };
  const now = now_();
  if (status_(champ, now.getTime()) !== "upcoming") return { ok: false, error: "closed" };

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: "busy" };
  let result, token, soon;
  try {
    const sh = signupSheet_();
    const active = readRows_(sh).filter(function (r) { return r.champId === champId && r.status === "active"; });
    const existing = active.filter(function (r) { return (email && r.email === email) || (phone && r.phone === phone); })[0];
    if (existing) {
      // Already signed up: keep the place, update the name and language.
      sh.getRange(existing.row, COL.name + 1).setValue(text_(name));
      sh.getRange(existing.row, COL.lang + 1).setValue(lang);
      return {
        ok: true, already: true, token: existing.token, count: active.length,
        names: active.map(function (r) { return r === existing ? name : r.name; }),
      };
    }
    const max = Number(champ.maxPlayers) || 0;
    if (max && active.length >= max) return { ok: false, error: "full" };
    token = Utilities.getUuid().replace(/-/g, "");
    soon = Date.parse(champ.startsAt) - now.getTime() <= lead_(champ) * 60000;
    const row = [];
    row[COL.at] = now;
    row[COL.champ] = text_(champ.name);
    row[COL.champId] = text_(champId);
    row[COL.name] = text_(name);
    row[COL.email] = text_(email);
    row[COL.phone] = phone ? text_("+" + phone) : "";
    row[COL.wa] = phone ? "https://wa.me/" + phone : "";
    row[COL.lang] = lang;
    row[COL.status] = "active";
    row[COL.reminded] = soon ? now : ""; // signing up inside the reminder window: this email is the reminder
    row[COL.token] = text_(token);
    sh.appendRow(row);
    result = { ok: true, token: token, count: active.length + 1, names: active.map(function (r) { return r.name; }).concat([name]) };
  } finally {
    lock.releaseLock();
  }

  const member = { name: name, email: email, phone: phone, lang: lang, token: token };
  if (email) {
    if (soon) sendReminder_(champ, member, now);
    else sendConfirmation_(champ, member);
  }
  if (EMAIL_ADMIN_ON_SIGNUP) sendAdminSignup_(champ, member, result.count, soon);
  log_("signup", champ.name, name + (email ? " · email" : " · WhatsApp"));
  return result;
}

function cancel_(p) {
  const token = clean_(p.token, 64);
  if (!token) return { ok: false, error: "invalid" };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: "busy" };
  let r, remaining;
  try {
    const sh = signupSheet_();
    const rows = readRows_(sh);
    r = rows.filter(function (x) { return x.token === token; })[0];
    if (!r || r.status !== "active") return { ok: false, error: "notfound" };
    sh.getRange(r.row, COL.status + 1).setValue("cancelled");
    remaining = rows.filter(function (x) { return x.champId === r.champId && x.status === "active" && x !== r; });
  } finally {
    lock.releaseLock();
  }
  log_("cancel", r.champName, r.name);
  if (EMAIL_ADMIN_ON_SIGNUP) sendAdminCancel_(r, remaining.length);
  return { ok: true, championshipId: r.champId, count: remaining.length, names: remaining.map(function (x) { return x.name; }) };
}

function readRows_(sh) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, HEADERS.length).getValues().map(function (v, i) {
    return {
      row: i + 2,
      champName: String(v[COL.champ]),
      champId: String(v[COL.champId]),
      name: String(v[COL.name]),
      email: String(v[COL.email]).trim().toLowerCase(),
      phone: String(v[COL.phone]).replace(/\D/g, ""),
      lang: String(v[COL.lang]) === "ar" ? "ar" : "en",
      status: String(v[COL.status]).trim().toLowerCase(),
      reminded: v[COL.reminded],
      token: String(v[COL.token]),
    };
  });
}

/* ================= Championships (read from the website) ================= */

function championships_(fresh) {
  const cache = CacheService.getScriptCache();
  if (!fresh) {
    const hit = cache.get("championships");
    if (hit) return JSON.parse(hit);
  }
  const url = base_() + "data/championships.json?t=" + now_().getTime();
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (res.getResponseCode() !== 200) throw new Error("Couldn't load " + url + " (HTTP " + res.getResponseCode() + ")");
  const data = JSON.parse(res.getContentText());
  const list = (data && Array.isArray(data.championships) ? data.championships : []).filter(function (c) {
    return c && c.id && c.name && !isNaN(Date.parse(c.startsAt));
  });
  try { cache.put("championships", JSON.stringify(list), 60); } catch (err) { /* too big to cache: fine */ }
  return list;
}

function findChamp_(id, fresh) {
  return championships_(fresh).filter(function (c) { return c.id === id; })[0] || null;
}

function status_(c, now) {
  if (c.cancelled) return "cancelled";
  if (c.winnerId) return "finished";
  const start = Date.parse(c.startsAt);
  if (now < start) return "upcoming";
  return now < start + LIVE_HOURS * 3600000 ? "live" : "awaiting";
}

function lead_(c) {
  return Math.min(120, Math.max(5, Number(c.remindBefore) || 30));
}

/* ================= Every 5 minutes: reminders and changes ================= */

function tick() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return; // a sign-up is being saved right now: the next run catches up
  try {
    tickLocked_();
  } catch (err) {
    log_("error", "", "tick: " + String(err && err.stack ? err.stack : err));
  } finally {
    lock.releaseLock();
  }
}

function tickLocked_() {
  const list = championships_(true);
  const sh = signupSheet_();
  const rows = readRows_(sh).filter(function (r) { return r.status === "active"; });
  const props = PropertiesService.getScriptProperties();
  const known = JSON.parse(props.getProperty("STATE") || "{}");
  const next = {};
  const now = now_(), nowMs = now.getTime();

  list.forEach(function (c) {
    const st = known[c.id] || {};
    const mine = rows.filter(function (r) { return r.champId === c.id; });
    const start = Date.parse(c.startsAt), lead = lead_(c) * 60000;
    if (mine.length) {
      if (c.cancelled) {
        if (!st.cancelled) notifyChange_(c, mine, "cancelled");
      } else if (st.cancelled && start > nowMs) {
        notifyChange_(c, mine, "restored");
        resetReminders_(sh, mine, start - lead > nowMs);
      } else if (st.startsAt && st.startsAt !== c.startsAt && start > nowMs && !c.winnerId) {
        notifyChange_(c, mine, "moved");
        resetReminders_(sh, mine, start - lead > nowMs);
      }
      if (!c.cancelled && !c.winnerId && nowMs >= start - lead && nowMs < start + REMINDER_GRACE_MIN * 60000) {
        const due = mine.filter(function (r) { return !r.reminded; });
        if (due.length) sendReminders_(sh, c, due, mine, now);
      }
    }
    next[c.id] = { startsAt: c.startsAt, cancelled: Boolean(c.cancelled) };
  });
  props.setProperty("STATE", JSON.stringify(next));
}

function resetReminders_(sh, rows, doReset) {
  if (!doReset) return;
  rows.forEach(function (r) {
    if (!r.reminded) return;
    sh.getRange(r.row, COL.reminded + 1).setValue("");
    r.reminded = "";
  });
}

function sendReminders_(sh, c, due, all, now) {
  due.forEach(function (r) {
    if (r.email) sendReminder_(c, r, now);
    sh.getRange(r.row, COL.reminded + 1).setValue(now);
    r.reminded = now;
  });
  sendAdminDigest_(c, all, "reminder");
  log_("reminder", c.name, due.length + " player(s)");
}

/** The time changed, or it was called off or is back on: email the players, and WhatsApp links for you. */
function notifyChange_(c, rows, kind) {
  rows.forEach(function (r) {
    if (r.email) sendChange_(c, r, kind);
  });
  sendAdminDigest_(c, rows, kind);
  log_(kind, c.name, rows.length + " player(s)");
}

/* ================= Emails ================= */

const TEXT = {
  en: {
    dir: "ltr",
    footer: "You get this email because you signed up on The Best.",
    adminFooter: "Sent by your sign-ups script (Google Apps Script).",
    openSite: "Open the site",
    calendar: "Add to Google Calendar",
    cancel: "Can't make it? Cancel your place",
    starts: "Starts:",
    confirmSubject: "You're in: {champ}",
    confirmTitle: "You're signed up!",
    confirmBody: "Hi {name}, you're signed up for {champ}.",
    confirmRemind: "We'll email you {mins} before the start.",
    reminderSubject: "⏰ {champ} starts in {mins}",
    reminderTitle: "Get ready, {name}!",
    reminderBody: "{champ} starts in {mins}.",
    movedSubject: "New time for {champ}",
    movedTitle: "New start time",
    movedBody: "Hi {name}, {champ} has a new start time.",
    restoredSubject: "{champ} is back on",
    restoredTitle: "It's back on!",
    restoredBody: "Hi {name}, {champ} is back on, and you're still signed up.",
    cancelledSubject: "{champ} is called off",
    cancelledTitle: "Called off",
    cancelledBody: "Hi {name}, {champ} has been called off. Sorry about that!",
    waReminder: "Hi {name}! {champ} starts in {mins} ({time}). Get ready! 🏆",
    waMoved: "Hi {name}! New time for {champ}: {time}.",
    waRestored: "Hi {name}! {champ} is back on: {time}.",
    waCancelled: "Hi {name}, {champ} has been called off.",
    aSignupSubject: "New sign-up: {name} for {champ} ({count})",
    aSignupBody: "{name} signed up for {champ}. Signed up so far: {count}.",
    aCancelSubject: "{name} cancelled: {champ} ({count})",
    aCancelBody: "{name} cancelled their place in {champ}. Still signed up: {count}.",
    aByEmail: "Email: {email}",
    aByPhone: "WhatsApp: +{phone}",
    aSendWa: "Send on WhatsApp",
    aSoonNote: "It starts soon, so this link has the reminder ready to send:",
    aReminderSubject: "⏰ {champ} starts in {mins} · {count} signed up",
    aReminderBody: "{champ} starts in {mins}. The email reminders are sent; tap the links below to remind the WhatsApp players.",
    aMovedSubject: "New time sent: {champ}",
    aMovedBody: "The players who signed up by email got the new time. Tap the links below to tell the WhatsApp players.",
    aRestoredSubject: "Back on, players told: {champ}",
    aRestoredBody: "The players who signed up by email know it's back on. Tap the links below to tell the WhatsApp players.",
    aCancelledSubject: "Call-off sent: {champ}",
    aCancelledBody: "The players who signed up by email know it's called off. Tap the links below to tell the WhatsApp players.",
    aPlayers: "Players",
    aEmailed: "emailed ✓",
    aGroup: "Post in your WhatsApp group",
    aGroupText: "⏰ {champ} starts in {mins} ({time}). Get ready! 🏆 {url}",
    setupSubject: "The Best: sign-ups are set up ✓",
    setupTitle: "Sign-ups are set up ✓",
    setupIntro: "Your sign-ups script works. Sign-ups are saved in this Google Sheet:",
    setupSheet: "Open the sign-ups sheet",
    setupNext: "Next: in the Apps Script editor press Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone). Then paste the web app URL into the site's dashboard, under Sign-ups & reminders.",
  },
  ar: {
    dir: "rtl",
    footer: "وصلتك هذه الرسالة لأنك سجّلت في موقع الأفضل.",
    adminFooter: "أُرسلت من سكربت التسجيل الخاص بك (Google Apps Script).",
    openSite: "افتح الموقع",
    calendar: "أضف إلى تقويم Google",
    cancel: "لن تتمكن من الحضور؟ ألغِ تسجيلك",
    starts: "البداية:",
    confirmSubject: "تم تسجيلك: {champ}",
    confirmTitle: "تم تسجيلك!",
    confirmBody: "أهلًا {name}، تم تسجيلك في {champ}.",
    confirmRemind: "سنرسل لك تذكيرًا قبل البداية بـ {mins}.",
    reminderSubject: "⏰ {champ} تبدأ بعد {mins}",
    reminderTitle: "استعد يا {name}!",
    reminderBody: "{champ} تبدأ بعد {mins}.",
    movedSubject: "موعد جديد لـ {champ}",
    movedTitle: "موعد بداية جديد",
    movedBody: "أهلًا {name}، تغيّر موعد بداية {champ}.",
    restoredSubject: "عادت {champ}",
    restoredTitle: "البطولة عادت!",
    restoredBody: "أهلًا {name}، عادت {champ}، وما زلت مسجّلًا فيها.",
    cancelledSubject: "أُلغيت {champ}",
    cancelledTitle: "أُلغيت البطولة",
    cancelledBody: "أهلًا {name}، تم إلغاء {champ}. نعتذر عن ذلك!",
    waReminder: "أهلًا {name}! {champ} تبدأ بعد {mins} ({time}). استعد! 🏆",
    waMoved: "أهلًا {name}! موعد جديد لـ {champ}: {time}.",
    waRestored: "أهلًا {name}! عادت {champ}: {time}.",
    waCancelled: "أهلًا {name}، تم إلغاء {champ}.",
    aSignupSubject: "تسجيل جديد: {name} في {champ} ({count})",
    aSignupBody: "سجّل {name} في {champ}. عدد المسجّلين حتى الآن: {count}.",
    aCancelSubject: "ألغى {name}: {champ} ({count})",
    aCancelBody: "ألغى {name} تسجيله في {champ}. عدد المسجّلين الآن: {count}.",
    aByEmail: "البريد: {email}",
    aByPhone: "واتساب: ‎+{phone}",
    aSendWa: "أرسل على واتساب",
    aSoonNote: "البطولة تبدأ قريبًا، وهذا الرابط فيه رسالة التذكير جاهزة للإرسال:",
    aReminderSubject: "⏰ {champ} تبدأ بعد {mins} · المسجّلون: {count}",
    aReminderBody: "{champ} تبدأ بعد {mins}. أُرسلت تذكيرات البريد، واضغط الروابط في الأسفل لتذكير لاعبي واتساب.",
    aMovedSubject: "أُرسل الموعد الجديد: {champ}",
    aMovedBody: "وصل الموعد الجديد للمسجّلين بالبريد. اضغط الروابط في الأسفل لإبلاغ لاعبي واتساب.",
    aRestoredSubject: "عادت البطولة وأُبلغ اللاعبون: {champ}",
    aRestoredBody: "عرف المسجّلون بالبريد أن البطولة عادت. اضغط الروابط في الأسفل لإبلاغ لاعبي واتساب.",
    aCancelledSubject: "أُرسل خبر الإلغاء: {champ}",
    aCancelledBody: "عرف المسجّلون بالبريد أن البطولة أُلغيت. اضغط الروابط في الأسفل لإبلاغ لاعبي واتساب.",
    aPlayers: "اللاعبون",
    aEmailed: "وصله البريد ✓",
    aGroup: "انشر في مجموعة واتساب",
    aGroupText: "⏰ {champ} تبدأ بعد {mins} ({time}). استعدوا! 🏆 {url}",
    setupSubject: "الأفضل: تم إعداد التسجيل ✓",
    setupTitle: "تم إعداد التسجيل ✓",
    setupIntro: "سكربت التسجيل يعمل، وتُحفظ التسجيلات في جدول Google هذا:",
    setupSheet: "افتح جدول التسجيلات",
    setupNext: "الخطوة التالية: في محرّر Apps Script اضغط Deploy ثم New deployment ثم Web app (Execute as: Me، وWho has access: Anyone). بعدها الصق رابط تطبيق الويب في لوحة تحكم الموقع ضمن «التسجيل والتذكيرات».",
  },
};

function sendConfirmation_(c, m) {
  const L = TEXT[m.lang], start = new Date(c.startsAt);
  const vars = { name: m.name, champ: champName_(c, m.lang), mins: minutes_(lead_(c), m.lang) };
  const paras = [fill_(L.confirmBody, vars), L.starts + " " + when_(start, m.lang), fill_(L.confirmRemind, vars)];
  const details = champDetails_(c, m.lang);
  if (details) paras.push(details);
  send_(m.email, m.lang, fill_(L.confirmSubject, vars), L.confirmTitle, paras, [
    { label: L.calendar, url: calendarUrl_(c, m.lang), primary: true },
    { label: L.cancel, url: cancelUrl_(m.token, c.id, m.lang) },
  ]);
}

function sendReminder_(c, m, now) {
  const L = TEXT[m.lang], start = new Date(c.startsAt);
  const vars = { name: m.name, champ: champName_(c, m.lang), mins: minutes_(minutesLeft_(start, now), m.lang) };
  send_(m.email, m.lang, fill_(L.reminderSubject, vars), fill_(L.reminderTitle, vars), [
    fill_(L.reminderBody, vars),
    L.starts + " " + when_(start, m.lang),
  ], [
    { label: L.openSite, url: siteUrl_(m.lang), primary: true },
    { label: L.cancel, url: cancelUrl_(m.token, c.id, m.lang) },
  ]);
}

function sendChange_(c, m, kind) {
  const L = TEXT[m.lang], start = new Date(c.startsAt);
  const vars = { name: m.name, champ: champName_(c, m.lang) };
  const paras = [fill_(L[kind + "Body"], vars)];
  const buttons = [];
  if (kind === "cancelled") {
    buttons.push({ label: L.openSite, url: siteUrl_(m.lang) });
  } else {
    paras.push(L.starts + " " + when_(start, m.lang));
    buttons.push({ label: L.calendar, url: calendarUrl_(c, m.lang), primary: true });
    buttons.push({ label: L.cancel, url: cancelUrl_(m.token, c.id, m.lang) });
  }
  send_(m.email, m.lang, fill_(L[kind + "Subject"], vars), L[kind + "Title"], paras, buttons);
}

function sendAdminSignup_(c, m, count, soon) {
  const lang = adminLang_(), L = TEXT[lang];
  const vars = { name: m.name, champ: champName_(c, lang), count: count };
  const paras = [fill_(L.aSignupBody, vars)];
  if (m.email) paras.push(fill_(L.aByEmail, { email: m.email }));
  if (m.phone) {
    paras.push(fill_(L.aByPhone, { phone: m.phone }));
    if (soon) {
      const url = waUrl_(m.phone, waText_(c, m, "reminder", now_()));
      paras.push({ html: esc_(L.aSoonNote) + " " + link_(url, L.aSendWa), text: L.aSoonNote + " " + url });
    }
  }
  const subject = fill_(L.aSignupSubject, vars);
  send_(adminEmail_(), lang, subject, subject, paras, [{ label: L.openSite, url: siteUrl_(lang) }], L.adminFooter);
}

function sendAdminCancel_(r, count) {
  const lang = adminLang_(), L = TEXT[lang];
  const vars = { name: r.name, champ: r.champName, count: count };
  const subject = fill_(L.aCancelSubject, vars);
  send_(adminEmail_(), lang, subject, subject, [fill_(L.aCancelBody, vars)], [], L.adminFooter);
}

/** To you: everyone who signed up, with a ready-to-send WhatsApp message for each WhatsApp player. */
function sendAdminDigest_(c, players, kind) {
  const lang = adminLang_(), L = TEXT[lang], now = now_(), start = new Date(c.startsAt);
  const key = kind.charAt(0).toUpperCase() + kind.slice(1);
  const vars = {
    champ: champName_(c, lang), mins: minutes_(minutesLeft_(start, now), lang), count: players.length,
    time: time_(start, lang), url: siteUrl_(lang),
  };
  const lines = players.map(function (m) {
    if (m.phone) {
      const url = waUrl_(m.phone, waText_(c, m, kind, now));
      return { html: "<b>" + esc_(m.name) + "</b> · +" + esc_(m.phone) + " · " + link_(url, L.aSendWa), text: m.name + " · +" + m.phone + " · " + url };
    }
    return { html: "<b>" + esc_(m.name) + "</b> · " + esc_(m.email) + " · " + esc_(L.aEmailed), text: m.name + " · " + m.email + " · " + L.aEmailed };
  });
  const paras = [
    fill_(L["a" + key + "Body"], vars),
    L.starts + " " + when_(start, lang),
    {
      html: "<b>" + esc_(L.aPlayers) + "</b><br>" + lines.map(function (x) { return x.html; }).join("<br>"),
      text: L.aPlayers + ":\n" + lines.map(function (x) { return x.text; }).join("\n"),
    },
  ];
  const buttons = [];
  if (kind === "reminder") buttons.push({ label: L.aGroup, url: "https://wa.me/?text=" + encodeURIComponent(fill_(L.aGroupText, vars)), primary: true });
  buttons.push({ label: L.openSite, url: siteUrl_(lang) });
  const subject = fill_(L["a" + key + "Subject"], vars);
  send_(adminEmail_(), lang, subject, subject, paras, buttons, L.adminFooter);
}

function waText_(c, m, kind, now) {
  const L = TEXT[m.lang], start = new Date(c.startsAt);
  const vars = { name: m.name, champ: champName_(c, m.lang), mins: minutes_(minutesLeft_(start, now), m.lang), time: time_(start, m.lang) };
  const tpl = { reminder: L.waReminder, moved: L.waMoved, restored: L.waRestored, cancelled: L.waCancelled }[kind];
  return fill_(tpl, vars) + (kind === "cancelled" ? "" : " " + siteUrl_(m.lang));
}

/** Paragraphs are plain text (escaped here) or { html, text } pairs; buttons are { label, url, primary }. */
function send_(to, lang, subject, title, paras, buttons, footer) {
  const L = TEXT[lang];
  const font = lang === "ar" ? "Tahoma, Arial, sans-serif" : "Arial, Helvetica, sans-serif";
  const htmlParas = paras.map(function (p) { return typeof p === "string" ? esc_(p) : p.html; });
  const html =
    '<div dir="' + L.dir + '" style="font-family:' + font + ';font-size:16px;line-height:1.6;color:#0b1222;max-width:560px;margin:0 auto;padding:8px">' +
    '<p style="margin:0 0 6px;font-size:13px;font-weight:bold;letter-spacing:1px;color:#b7791f">🏆 THE BEST</p>' +
    '<h2 style="margin:0 0 14px;font-size:22px;line-height:1.35">' + esc_(title) + "</h2>" +
    htmlParas.map(function (p) { return '<p style="margin:0 0 12px">' + p + "</p>"; }).join("") +
    (buttons.length ? '<p style="margin:20px 0 8px">' + buttons.map(button_).join(" ") + "</p>" : "") +
    '<p style="margin:22px 0 0;font-size:12px;color:#64748b">' + esc_(footer || L.footer) + "</p></div>";
  const text = [title]
    .concat(paras.map(function (p) { return typeof p === "string" ? p : p.text; }))
    .concat(buttons.map(function (b) { return b.label + ": " + b.url; }))
    .concat([footer || L.footer])
    .join("\n\n");
  return mail_(to, subject, html, text);
}

function button_(b) {
  return '<a href="' + esc_(b.url) + '" style="display:inline-block;margin:0 0 8px;padding:10px 18px;border-radius:999px;background:' +
    (b.primary ? "#38bdf8" : "#e9eef8") + ';color:#04111d;text-decoration:none;font-weight:bold">' + esc_(b.label) + "</a>";
}

function link_(url, label) {
  return '<a href="' + esc_(url) + '" style="color:#0369a1;font-weight:bold">' + esc_(label) + "</a>";
}

function mail_(to, subject, htmlBody, body) {
  if (!to) return false;
  try {
    if (MailApp.getRemainingDailyQuota() < 1) {
      log_("quota", "", "Daily email limit reached, not sent: " + subject);
      return false;
    }
    MailApp.sendEmail({ to: to, subject: subject, htmlBody: htmlBody, body: body, name: SENDER_NAME });
    return true;
  } catch (err) {
    log_("mail-error", "", to + ": " + err);
    return false;
  }
}

/* ================= Helpers ================= */

const DAYS = {
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  ar: ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"],
};
const MONTHS = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
};

function fmt_(date, pattern) {
  return Utilities.formatDate(date, TIME_ZONE, pattern);
}

/** "8:30 PM" / "8:30 م" in TIME_ZONE. */
function time_(date, lang) {
  const ampm = fmt_(date, "a");
  return fmt_(date, "h:mm") + " " + (lang === "ar" ? (ampm === "AM" ? "ص" : "م") : ampm);
}

/** "Friday 20 November, 8:30 PM (Cairo time)" / "الجمعة 20 نوفمبر، 8:30 م (بتوقيت القاهرة)". */
function when_(date, lang) {
  const day = DAYS[lang][Number(fmt_(date, "u")) - 1];
  const month = MONTHS[lang][Number(fmt_(date, "M")) - 1];
  const d = fmt_(date, "d");
  return lang === "ar"
    ? day + " " + d + " " + month + "، " + time_(date, lang) + " (" + TIME_ZONE_LABEL.ar + ")"
    : day + " " + d + " " + month + ", " + time_(date, lang) + " (" + TIME_ZONE_LABEL.en + ")";
}

function minutesLeft_(start, now) {
  return Math.max(1, Math.round((start.getTime() - now.getTime()) / 60000));
}

/** "30 minutes" / "30 دقيقة" (Arabic counts take different forms). */
function minutes_(n, lang) {
  if (lang === "ar") {
    if (n === 1) return "دقيقة واحدة";
    if (n === 2) return "دقيقتين";
    if (n >= 3 && n <= 10) return n + " دقائق";
    return n + " دقيقة";
  }
  return n === 1 ? "1 minute" : n + " minutes";
}

function champName_(c, lang) {
  return lang === "ar" && c.nameAr ? c.nameAr : c.name;
}

function champDetails_(c, lang) {
  return (lang === "ar" && c.detailsAr ? c.detailsAr : c.details) || "";
}

function base_() {
  return SITE_URL.replace(/\/?$/, "/");
}

function siteUrl_(lang) {
  return base_() + (lang === "ar" ? "?lang=ar" : "") + "#announcements";
}

function cancelUrl_(token, champId, lang) {
  return base_() + "?cancel=" + encodeURIComponent(token) + "&c=" + encodeURIComponent(champId) + (lang === "ar" ? "&lang=ar" : "") + "#announcements";
}

function calendarUrl_(c, lang) {
  const start = new Date(c.startsAt), end = new Date(start.getTime() + 2 * 3600000);
  const utc = function (d) { return Utilities.formatDate(d, "UTC", "yyyyMMdd'T'HHmmss'Z'"); };
  const details = [champDetails_(c, lang), siteUrl_(lang)].filter(String).join("\n\n");
  return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(champName_(c, lang)) +
    "&dates=" + utc(start) + "/" + utc(end) + "&details=" + encodeURIComponent(details);
}

function waUrl_(phone, text) {
  return "https://wa.me/" + phone + "?text=" + encodeURIComponent(text);
}

function adminEmail_() {
  return ADMIN_EMAIL || Session.getEffectiveUser().getEmail();
}

function adminLang_() {
  return ADMIN_LANG === "ar" ? "ar" : "en";
}

/** International digits for WhatsApp (no +), or "" when it can't be a phone number. */
function normalizePhone_(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  let d = s.replace(/\D/g, "");
  if (s.charAt(0) === "+") { /* already international */ }
  else if (d.indexOf("00") === 0) d = d.slice(2);
  else if (d.charAt(0) === "0") d = DEFAULT_COUNTRY_CODE + d.slice(1);
  else if (d.length <= 10) d = DEFAULT_COUNTRY_CODE + d;
  return d.length >= 8 && d.length <= 15 ? d : "";
}

function validEmail_(s) {
  return s.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

/** At most 30 sign-ups a minute in total, and 6 per email or number per 10 minutes. */
function rateOk_(key) {
  const cache = CacheService.getScriptCache();
  const minute = "rate:" + Math.floor(now_().getTime() / 60000);
  const all = Number(cache.get(minute) || 0);
  if (all >= 30) return false;
  cache.put(minute, String(all + 1), 120);
  const k = "rate:" + String(key).slice(0, 200);
  const mine = Number(cache.get(k) || 0);
  if (mine >= 6) return false;
  cache.put(k, String(mine + 1), 600);
  return true;
}

function clean_(value, max) {
  return String(value == null ? "" : value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Text for a sheet cell: the leading apostrophe stops Sheets reading it as a formula, number or date. */
function text_(value) {
  const s = String(value == null ? "" : value);
  return s ? "'" + s : "";
}

function esc_(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
  });
}

function fill_(tpl, vars) {
  return String(tpl).replace(/\{(\w+)\}/g, function (_, k) { return vars[k] == null ? "" : String(vars[k]); });
}

function log_(event, champ, details) {
  try {
    const sh = sheet_(book_(), LOG, ["Time", "Event", "Championship", "Details"]);
    sh.appendRow([now_(), event, text_(champ || ""), text_(String(details || "").slice(0, 500))]);
  } catch (err) {
    /* logging must never break a sign-up */
  }
}

function now_() {
  return new Date();
}
