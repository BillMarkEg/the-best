/* English / Arabic interface text.
   Static HTML uses data-i18n="key" (text), data-i18n-html="key" (trusted markup)
   and data-i18n-attr="attr:key;attr:key". Scripts call t(), tp() and the formatters.
   Names from the data (players, teams, tournaments) are translated separately,
   through data/names_ar.json and the optional Arabic fields of each winner. */

const LS_LANG = "thebest.lang";

const EN = {
  pageTitle: "The Best · eFootball Champions",
  skip: "Skip to content",
  brandHome: "The Best, home",
  brandName: "THE BEST",
  brandSub: "eFootball champions",
  navSections: "Sections",
  navChampions: "Champions",
  navNews: "News",
  navStats: "Stats",
  navHistory: "History",
  addWinner: "Add winner",
  langSwitch: "العربية",
  langSwitchLabel: "Switch to Arabic",
  langSwitchCode: "ar",
  pending: "Publishing your latest change. GitHub Pages usually needs about a minute, then everyone sees it.",
  loading: "Loading…",
  loadError: "Couldn't load results",
  fileProtocol: "Open the site through a web server (see README): browsers block data files on file://.",

  // Hero
  latestChampionGame: "Latest champion · {game}",
  noChampion: "No champion yet",
  heroEfTitles: "eFootball titles",
  heroAllTitles: "Titles all-time",
  heroRank: "All-time rank",
  heroStreak: "Win streak",
  winningMoment: "Winning moment",
  winAlt: "{player} winning with {team}",
  photo: "Photo:",
  finalChip: ({ score, runnerUp }) => `Final ${[score, runnerUp && `v ${runnerUp}`].filter(Boolean).join(" ")}`,
  starChip: "Star player: {star}",

  // Champions
  champKicker: "eFootball era",
  champTitle: "Champions",
  champLede: "Every title since we switched from PES to eFootball. The full PES history is further down.",
  thChampion: "Champion",
  thTeam: "Team",
  thTournament: "Tournament",
  thDate: "Date",
  thStar: "Star player",
  thActions: "Actions",
  thPlayers: "Players",
  thGame: "Game",
  thTitles: "Titles",
  latestTag: "(latest)",
  champEmpty: "No eFootball champion yet. Use “Add winner” to record the first one.",
  raceTitle: "eFootball title race",
  raceAllTime: "{titles} all-time",
  raceCountAria: "{titles} in eFootball",
  raceNone: "No titles yet.",
  raceLevel: ({ names, titles }) => `Level at the top: ${names} have ${titles} each.`,
  editAria: "Edit {who}",
  deleteAria: "Delete {who}",

  // News
  newsKicker: "Latest first",
  newsTitle: "News",
  newsEmpty: "No news yet. Add the first eFootball winner.",
  badgeLatest: "LATEST",
  autoHeadline: "{player} lifts the trophy with {team}",
  storyFinal: ({ runnerUp, score }) =>
    runnerUp && score ? `Beat ${runnerUp} ${score} in the final.` : runnerUp ? `Beat ${runnerUp} in the final.` : `Won the final ${score}.`,
  storyTitles: ({ ef, all, player }) => `${ordinalEn(ef)} eFootball title for ${player}, ${ordinalEn(all)} overall.`,
  storyFirstEra: "The first champion of the eFootball era.",
  allPlayers: "All players",

  // Stats
  statsKicker: "All-time · PES + eFootball",
  statsTitle: "Stats",
  kTournaments: "Tournaments",
  kTournamentsSub: "{pes} PES · {ef} eFootball",
  kMostTitles: "Most titles",
  kStreak: "Longest winning streak",
  kHaul: "Most titles in one tournament",
  kChampions: "Different champions",
  kChampionsSub: "including Com",
  kClubs: "Winning clubs",
  kClubsSub: "different teams lifted a trophy",
  titlesTitle: "Titles by player",
  titlesSub: "All tournaments since PES 2012",
  titlesTip: ({ player, titles, pct, ef }) => `${player}: ${titles}, ${pct}% of all tournaments${ef ? ` (${ef} in eFootball)` : ""}`,
  clubsTitle: "Favourite clubs",
  clubsSub: "The teams each player won the most with",
  seasonsTitle: "Who won each tournament",
  seasonsSub: "Share of titles per tournament, newest first",
  showTable: "Show as table",
  showChart: "Show as chart",
  showAllSeasons: "Show all {n} tournaments",
  showFewer: "Show fewer",
  legendPlayers: "Players",
  others: "Others",
  othersList: "Others ({names})",
  segTip: "{label}: {n} of {total} ({pct}%)",

  // History
  historyKicker: "PES 2012 → today",
  historyTitle: "All-time winners",
  historyLede: "Every title ever recorded: the PES sheet plus the eFootball era.",
  fPlayer: "Player",
  fAllPlayers: "All players",
  fGame: "Game",
  fGameAll: "PES + eFootball",
  fGamePes: "PES only",
  fGameEf: "eFootball only",
  fSearch: "Search",
  fSearchPh: "Team or tournament…",
  showing: "Showing {shown} of {total}",
  showMore: "Show {n} more",
  historyEmpty: "No titles match these filters.",

  // Footer
  footerData: "<strong>THE BEST</strong> · Results from <code>our_tournments.xlsx</code> (PES sheet + eFootball sheet).",
  footerCredits: 'Background: <a href="https://commons.wikimedia.org/wiki/File:Camp_Nou_Barcelona_Chelsea_14-03-2018.jpg" target="_blank" rel="noopener">Camp Nou, Barcelona v Chelsea 2018</a> by Azulino, <a href="https://creativecommons.org/licenses/by-sa/4.0" target="_blank" rel="noopener">CC BY-SA 4.0</a>. News photos are credited on each story.',
  footerFine: "eFootball™ and PES are trademarks of Konami. This is a private fan site and isn't affiliated with Konami.",

  // Add / edit dialog
  dlgAdd: "Add a new winner",
  dlgEdit: "Edit winner",
  close: "Close",
  tabWinner: "Winner",
  tabGithub: "GitHub connection",
  lPlayer: "Champion",
  lTeam: "Team",
  lEvent: "Tournament",
  lDate: "Date",
  lRunnerUp: "Runner-up",
  lScore: "Final score",
  lStar: "Star player",
  lComp: "Players in the tournament",
  lHeadline: "Headline",
  lHeadlineHint: "(optional, written for you if empty)",
  lStory: "Story",
  optional: "(optional)",
  phPlayer: "e.g. Legend Master",
  phTeam: "e.g. Suzhou Dongwu F.C.",
  phRunnerUp: "Who lost the final",
  phScore: "e.g. 3-1",
  phStar: "e.g. Luis Suárez",
  phStory: "How did the final go?",
  lWinImg: "Win image",
  lWinImgHint: "(screenshot or photo of the win)",
  lRemoveImg: "Remove current image",
  lCover: "Background photo",
  lCoverHint: "(shown behind the win image, e.g. your star player)",
  lRemoveCover: "Remove current photo",
  lCoverCredit: "Background photo credit",
  lCoverCreditHint: "(optional, e.g. photographer and license)",
  arSection: "Arabic version",
  arSectionHint: "(optional, shown when the site is in Arabic)",
  lTeamAr: "Team in Arabic",
  lEventAr: "Tournament in Arabic",
  lStarAr: "Star player in Arabic",
  lHeadlineAr: "Headline in Arabic",
  lStoryAr: "Story in Arabic",
  imgHint: "Images are resized on your device before upload, which also strips location data from phone photos.",
  ghHint: "Winners are saved straight into the site's GitHub repository, so everyone sees them about a minute later. Connect once per device; your token stays in this browser only.",
  lOwner: "GitHub user / org",
  lRepo: "Repository",
  lBranch: "Branch",
  lToken: "Access token",
  howtoSummary: "How do I get a token?",
  howtoSteps: '<li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → Fine-grained tokens → Generate new token</a>.</li><li>Repository access: <b>Only select repositories</b> → pick this site\'s repository.</li><li>Permissions → Repository permissions → <b>Contents: Read and write</b>.</li><li>Generate, copy the token and paste it above. Only use it on your own devices.</li>',
  btnTest: "Save & test connection",
  btnForget: "Forget token",
  btnCancel: "Cancel",
  btnPublish: "Publish",
  btnSave: "Save changes",
  tokenSaved: "Saved on this device ✓ (paste to replace)",

  // Status, toasts, errors
  stNotConnected: "Not connected to GitHub on this device yet. You'll be asked when you publish.",
  stRequired: "Champion and team are required.",
  stConnectFirst: "Connect to GitHub first: fill in these fields and press “Save & test connection”. Your winner details are kept.",
  stResizing: "Resizing images…",
  stPublishing: "Publishing to GitHub…",
  stFillGh: "Fill in the GitHub user/org, repository and token.",
  stChecking: "Checking the connection…",
  stConnected: "Connected to {repo} ✓ You can publish winners now.",
  stNoPush: "Connected, but this account can't push to {repo}.",
  stForgot: "Token removed from this device.",
  toastAdded: "🏆 {player} added! Live for everyone in about a minute.",
  toastSaved: "Saved ✓ The site updates for everyone in about a minute.",
  toastDeleting: "Deleting…",
  toastDeleted: "Deleted “{label}”. The site updates for everyone in about a minute.",
  toastLive: "Your update is now live for everyone ✓",
  confirmDelete: "Delete “{label}” from the eFootball champions?\n\nThis publishes the change to the website.",
  errNetwork: "Couldn't reach GitHub. Check your internet connection and try again.",
  err401: "GitHub rejected the token (expired or mistyped?).",
  err403: "This token can't write to the repository. It needs “Contents: Read and write”.",
  err404: "Repository, branch or data file not found. Check the GitHub connection settings.",
  err409: "GitHub reported a conflict. Please try again.",
  err422: "Someone else published at the same moment. Please try again.",
  errOther: "GitHub error {status}",
  errNotImage: "“{name}” isn't an image.",
  errReadImage: "Couldn't read “{name}”. Try a JPG or PNG.",
  errProcessImage: "Couldn't process the image.",
  errGone: "This winner isn't in the published data any more (deleted elsewhere?). Reload the page.",
  errAlreadyRemoved: "That winner was already removed.",

  // Plurals (Intl.PluralRules categories)
  titlesN: { one: "{n} title", other: "{n} titles" },
};

const AR = {
  pageTitle: "الأفضل · أبطال eFootball",
  skip: "تخطَّ إلى المحتوى",
  brandHome: "الأفضل، الصفحة الرئيسية",
  brandName: "الأفضل",
  brandSub: "أبطال eFootball",
  navSections: "الأقسام",
  navChampions: "الأبطال",
  navNews: "الأخبار",
  navStats: "الإحصائيات",
  navHistory: "السجل",
  addWinner: "إضافة بطل",
  langSwitch: "English",
  langSwitchLabel: "التبديل إلى الإنجليزية",
  langSwitchCode: "en",
  pending: "جارٍ نشر آخر تعديل. يحتاج GitHub Pages عادةً إلى دقيقة تقريبًا، ثم يظهر للجميع.",
  loading: "جارٍ التحميل…",
  loadError: "تعذّر تحميل النتائج",
  fileProtocol: "افتح الموقع عبر خادم ويب (راجع README)، فالمتصفحات تمنع ملفات البيانات عند فتح الملف مباشرة.",

  latestChampionGame: "آخر بطل · {game}",
  noChampion: "لا يوجد بطل بعد",
  heroEfTitles: "ألقاب eFootball",
  heroAllTitles: "مجموع الألقاب",
  heroRank: "الترتيب التاريخي",
  heroStreak: "سلسلة الانتصارات",
  winningMoment: "لحظة التتويج",
  winAlt: "{player} يتوّج مع {team}",
  photo: "الصورة:",
  finalChip: ({ score, runnerUp }) => `النهائي ${[score, runnerUp && `أمام ${runnerUp}`].filter(Boolean).join(" ")}`,
  starChip: "النجم: {star}",

  champKicker: "عصر eFootball",
  champTitle: "الأبطال",
  champLede: "كل الألقاب منذ انتقالنا من PES إلى eFootball. سجل PES الكامل في الأسفل.",
  thChampion: "البطل",
  thTeam: "الفريق",
  thTournament: "البطولة",
  thDate: "التاريخ",
  thStar: "النجم",
  thActions: "إجراءات",
  thPlayers: "المشاركون",
  thGame: "اللعبة",
  thTitles: "الألقاب",
  latestTag: "(الأحدث)",
  champEmpty: "لا يوجد بطل في eFootball بعد. استخدم «إضافة بطل» لتسجيل أول بطل.",
  raceTitle: "سباق ألقاب eFootball",
  raceAllTime: "{titles} في المجموع",
  raceCountAria: "{titles} في eFootball",
  raceNone: "لا ألقاب بعد.",
  raceLevel: ({ names, titles, count }) => `تعادل في الصدارة: ${names}، ${count === 2 ? "لكلٍّ منهما" : "لكلٍّ منهم"} ${titles}.`,
  editAria: "تعديل {who}",
  deleteAria: "حذف {who}",

  newsKicker: "الأحدث أولًا",
  newsTitle: "الأخبار",
  newsEmpty: "لا أخبار بعد. أضف أول بطل في eFootball.",
  badgeLatest: "الأحدث",
  autoHeadline: "{player} يتوّج باللقب مع {team}",
  storyFinal: ({ runnerUp, score }) =>
    runnerUp && score ? `فاز على ${runnerUp} بنتيجة ${score} في النهائي.` : runnerUp ? `فاز على ${runnerUp} في النهائي.` : `فاز في النهائي بنتيجة ${score}.`,
  storyTitles: ({ ef, all, player }) =>
    `${ef === 1 ? "أول لقب" : `اللقب رقم ${ef}`} في eFootball لـ ${player}، ${all === 1 ? "وأول لقب في تاريخه" : `ورقم ${all} في مجموع ألقابه`}.`,
  storyFirstEra: "أول بطل في عصر eFootball.",
  allPlayers: "كل اللاعبين",

  statsKicker: "كل الأوقات · PES + eFootball",
  statsTitle: "الإحصائيات",
  kTournaments: "البطولات",
  kTournamentsSub: "{pes} PES · {ef} eFootball",
  kMostTitles: "الأكثر تتويجًا",
  kStreak: "أطول سلسلة انتصارات",
  kHaul: "أكثر ألقاب في بطولة واحدة",
  kChampions: "أبطال مختلفون",
  kChampionsSub: "من بينهم Com",
  kClubs: "أندية متوّجة",
  kClubsSub: "عدد الفرق المختلفة التي رفعت الكأس",
  titlesTitle: "الألقاب حسب اللاعب",
  titlesSub: "كل البطولات منذ PES 2012",
  titlesTip: ({ player, titles, pct, ef }) => `${player}: ${titles}، ${pct}% من كل البطولات${ef ? ` (منها ${ef} في eFootball)` : ""}`,
  clubsTitle: "الأندية المفضلة",
  clubsSub: "الفرق التي حقق بها كل لاعب أكثر ألقابه",
  seasonsTitle: "من فاز بكل بطولة",
  seasonsSub: "توزيع الألقاب في كل بطولة، الأحدث أولًا",
  showTable: "عرض كجدول",
  showChart: "عرض كرسم بياني",
  showAllSeasons: "عرض كل البطولات ({n})",
  showFewer: "عرض أقل",
  legendPlayers: "اللاعبون",
  others: "آخرون",
  othersList: "آخرون ({names})",
  segTip: "{label}: {n} من {total} ({pct}%)",

  historyKicker: "من PES 2012 حتى اليوم",
  historyTitle: "كل الأبطال عبر التاريخ",
  historyLede: "كل لقب مسجّل: جدول PES مع عصر eFootball.",
  fPlayer: "اللاعب",
  fAllPlayers: "كل اللاعبين",
  fGame: "اللعبة",
  fGameAll: "PES + eFootball",
  fGamePes: "PES فقط",
  fGameEf: "eFootball فقط",
  fSearch: "بحث",
  fSearchPh: "فريق أو بطولة…",
  showing: "عرض {shown} من أصل {total}",
  showMore: "عرض المزيد ({n})",
  historyEmpty: "لا توجد ألقاب تطابق هذا البحث.",

  footerData: "<strong>الأفضل</strong> · النتائج من <code>our_tournments.xlsx</code> (جدول PES وجدول eFootball).",
  footerCredits: 'الخلفية: <a href="https://commons.wikimedia.org/wiki/File:Camp_Nou_Barcelona_Chelsea_14-03-2018.jpg" target="_blank" rel="noopener">كامب نو، برشلونة ضد تشيلسي 2018</a> بعدسة Azulino، برخصة <a href="https://creativecommons.org/licenses/by-sa/4.0" target="_blank" rel="noopener">CC BY-SA 4.0</a>. صور الأخبار منسوبة لأصحابها في كل خبر.',
  footerFine: "eFootball™ وPES علامتان تجاريتان لشركة Konami. هذا موقع خاص بالمشجعين وغير تابع لـ Konami.",

  dlgAdd: "إضافة بطل جديد",
  dlgEdit: "تعديل البطل",
  close: "إغلاق",
  tabWinner: "البطل",
  tabGithub: "الربط مع GitHub",
  lPlayer: "البطل",
  lTeam: "الفريق",
  lEvent: "البطولة",
  lDate: "التاريخ",
  lRunnerUp: "الوصيف",
  lScore: "نتيجة النهائي",
  lStar: "النجم",
  lComp: "المشاركون في البطولة",
  lHeadline: "العنوان",
  lHeadlineHint: "(اختياري، يُكتب تلقائيًا إن تُرك فارغًا)",
  lStory: "القصة",
  optional: "(اختياري)",
  phPlayer: "مثال: Legend Master",
  phTeam: "مثال: Suzhou Dongwu F.C.",
  phRunnerUp: "من خسر النهائي",
  phScore: "مثال: 3-1",
  phStar: "مثال: Luis Suárez",
  phStory: "كيف جرت المباراة النهائية؟",
  lWinImg: "صورة الفوز",
  lWinImgHint: "(لقطة شاشة أو صورة للتتويج)",
  lRemoveImg: "إزالة الصورة الحالية",
  lCover: "صورة الخلفية",
  lCoverHint: "(تظهر خلف صورة الفوز، مثل نجم فريقك)",
  lRemoveCover: "إزالة الصورة الحالية",
  lCoverCredit: "حقوق صورة الخلفية",
  lCoverCreditHint: "(اختياري، مثل اسم المصوّر والرخصة)",
  arSection: "النسخة العربية",
  arSectionHint: "(اختياري، تظهر عند عرض الموقع بالعربية)",
  lTeamAr: "اسم الفريق بالعربية",
  lEventAr: "اسم البطولة بالعربية",
  lStarAr: "النجم بالعربية",
  lHeadlineAr: "العنوان بالعربية",
  lStoryAr: "القصة بالعربية",
  imgHint: "تُصغَّر الصور على جهازك قبل رفعها، وهذا يحذف أيضًا بيانات الموقع الجغرافي من صور الهاتف.",
  ghHint: "يُحفظ الأبطال مباشرة في مستودع الموقع على GitHub، فيراهم الجميع بعد دقيقة تقريبًا. اربط مرة واحدة لكل جهاز، ويبقى الرمز في هذا المتصفح فقط.",
  lOwner: "مستخدم أو منظمة GitHub",
  lRepo: "المستودع",
  lBranch: "الفرع",
  lToken: "رمز الوصول",
  howtoSummary: "كيف أحصل على رمز وصول؟",
  howtoSteps: '<li>افتح <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">صفحة إنشاء رمز جديد على GitHub</a> (Fine-grained tokens).</li><li>في <b>Repository access</b> اختر <b>Only select repositories</b> ثم مستودع هذا الموقع.</li><li>في <b>Permissions</b> ثم <b>Repository permissions</b> اجعل <b>Contents</b> على <b>Read and write</b>.</li><li>اضغط <b>Generate token</b>، ثم انسخ الرمز والصقه في الأعلى. استخدمه على أجهزتك فقط.</li>',
  btnTest: "حفظ واختبار الاتصال",
  btnForget: "حذف الرمز من هذا الجهاز",
  btnCancel: "إلغاء",
  btnPublish: "نشر",
  btnSave: "حفظ التغييرات",
  tokenSaved: "محفوظ على هذا الجهاز ✓ (الصق رمزًا جديدًا للاستبدال)",

  stNotConnected: "هذا الجهاز غير مربوط بـ GitHub بعد. سيُطلب منك الربط عند النشر.",
  stRequired: "البطل والفريق حقلان مطلوبان.",
  stConnectFirst: "اربط GitHub أولًا: املأ هذه الحقول واضغط «حفظ واختبار الاتصال». بيانات البطل ما زالت محفوظة.",
  stResizing: "جارٍ تصغير الصور…",
  stPublishing: "جارٍ النشر على GitHub…",
  stFillGh: "املأ مستخدم GitHub والمستودع ورمز الوصول.",
  stChecking: "جارٍ التحقق من الاتصال…",
  stConnected: "تم الربط مع {repo} ✓ يمكنك نشر الأبطال الآن.",
  stNoPush: "تم الربط، لكن هذا الحساب لا يملك صلاحية الكتابة في {repo}.",
  stForgot: "تم حذف الرمز من هذا الجهاز.",
  toastAdded: "🏆 تمت إضافة {player}! سيظهر للجميع خلال دقيقة تقريبًا.",
  toastSaved: "تم الحفظ ✓ يتحدّث الموقع للجميع خلال دقيقة تقريبًا.",
  toastDeleting: "جارٍ الحذف…",
  toastDeleted: "تم حذف «{label}». يتحدّث الموقع للجميع خلال دقيقة تقريبًا.",
  toastLive: "تحديثك متاح الآن للجميع ✓",
  confirmDelete: "حذف «{label}» من أبطال eFootball؟\n\nسيُنشر هذا التغيير على الموقع.",
  errNetwork: "تعذّر الوصول إلى GitHub. تحقّق من اتصالك بالإنترنت وحاول مجددًا.",
  err401: "رفض GitHub رمز الوصول (ربما انتهت صلاحيته أو كُتب خطأ).",
  err403: "هذا الرمز لا يملك صلاحية الكتابة في المستودع. يحتاج إلى «Contents: Read and write».",
  err404: "لم يُعثر على المستودع أو الفرع أو ملف البيانات. راجع إعدادات الربط مع GitHub.",
  err409: "أبلغ GitHub عن تعارض. حاول مرة أخرى.",
  err422: "نشر شخص آخر في اللحظة نفسها. حاول مرة أخرى.",
  errOther: "خطأ من GitHub ({status})",
  errNotImage: "«{name}» ليس ملف صورة.",
  errReadImage: "تعذّرت قراءة «{name}». جرّب صورة JPG أو PNG.",
  errProcessImage: "تعذّرت معالجة الصورة.",
  errGone: "هذا البطل لم يعد موجودًا في البيانات المنشورة (ربما حُذف من مكان آخر). أعد تحميل الصفحة.",
  errAlreadyRemoved: "هذا البطل محذوف بالفعل.",

  titlesN: { zero: "لا ألقاب", one: "لقب واحد", two: "لقبان", few: "{n} ألقاب", many: "{n} لقبًا", other: "{n} لقب" },
};

const STRINGS = { en: EN, ar: AR };

function ordinalEn(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function initialLang() {
  try {
    const q = new URLSearchParams(location.search).get("lang");
    if (q === "ar" || q === "en") return q;
    return localStorage.getItem(LS_LANG) === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}

let lang = initialLang();
const pluralRules = {};

export const getLang = () => lang;
export const isArabic = () => lang === "ar";

/** Translate a key; {name} placeholders are filled from vars. Values may also be functions of vars. */
export function t(key, vars = {}) {
  const value = STRINGS[lang][key] ?? EN[key] ?? key;
  if (typeof value === "function") return value(vars);
  return String(value).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
}

/** Count with the right plural form, e.g. tp("titlesN", 15) → "15 titles" / "15 لقبًا". */
export function tp(key, n) {
  const forms = STRINGS[lang][key] || EN[key];
  pluralRules[lang] ||= new Intl.PluralRules(lang);
  const form = forms[pluralRules[lang].select(n)] ?? forms.other;
  return form.replace("{n}", fmtNum(n));
}

/** Numbers keep Western digits in both languages, so scores and stats read the same. */
export const fmtNum = (n) => Number(n || 0).toLocaleString(lang === "ar" ? "ar-EG-u-nu-latn" : "en-US");

export function fmtDate(d) {
  if (!d) return "";
  const date = new Date(`${d}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString(lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { day: "numeric", month: lang === "ar" ? "long" : "short", year: "numeric" });
}

export function listJoin(items) {
  try {
    return new Intl.ListFormat(lang, { style: "long", type: "conjunction" }).format(items);
  } catch {
    return items.join(lang === "ar" ? " و" : " and ");
  }
}

/** Keep a name's own direction inside a sentence of the other script (Unicode first-strong isolate). */
export const iso = (s) => `⁨${s}⁩`;

/** Apply the current language to the static page: <html lang/dir>, title and data-i18n elements. */
export function applyStatic(root = document) {
  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === "ar" ? "rtl" : "ltr";
  document.title = t("pageTitle");
  root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    el.dataset.i18nAttr.split(";").forEach((pair) => {
      const [attr, key] = pair.split(":");
      if (attr && key) el.setAttribute(attr.trim(), t(key.trim()));
    });
  });
}

export function setLang(next) {
  lang = next === "ar" ? "ar" : "en";
  try { localStorage.setItem(LS_LANG, lang); } catch { /* storage unavailable */ }
  try {
    const url = new URL(location.href);
    if (url.searchParams.has("lang")) {
      url.searchParams.set("lang", lang);
      history.replaceState(null, "", url);
    }
  } catch { /* ignore */ }
  applyStatic();
}
