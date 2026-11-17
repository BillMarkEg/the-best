# The Best · eFootball champions

A small static website for our tournaments: the latest champion first, the eFootball roll of honour, news with win photos, all-time stats, and every title since PES 2012. It runs on GitHub Pages and needs no build step.

## What's where

| Path | What it is |
|---|---|
| `index.html`, `assets/` | The website (HTML, CSS, JavaScript, images) |
| `data/efootball.json` | eFootball-era winners. The **Add winner** button on the site edits this file. |
| `data/pes_history.json` | PES-era winners, generated from the `tournments` sheet |
| `data/names_ar.json` | Arabic names for teams, tournaments and (optionally) players |
| `assets/js/i18n.js` | All English and Arabic interface text |
| `our_tournments.xlsx` | The original sheet (`tournments`, PES 2012 to PES 2021) plus the new `eFootball` sheet |
| `tools/sync_excel.py` | Keeps the workbook and the website data in sync |
| `tools/bump_version.py` | Makes browsers download new code after you change CSS/JavaScript |

## Put it online (one time)

1. Create a new **public** repository on GitHub, for example `the-best` (no README, no .gitignore).
2. In this folder, push the code:
   ```bash
   git remote add origin https://github.com/<your-user>/the-best.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.
4. After a minute the site is live at `https://<your-user>.github.io/the-best/`.

## Add a winner from the website

1. Create a token once: [GitHub → Fine-grained tokens → Generate new token](https://github.com/settings/personal-access-tokens/new)
   - Repository access: **Only select repositories** → `the-best`
   - Repository permissions: **Contents → Read and write**
2. On the site click **Add winner → GitHub connection**, paste the token, then press **Save & test connection**.
   The token is stored only in that browser. Use it only on your own devices.
3. Fill in the winner (champion, team, optional score, star player and story), attach the **win image** and,
   if you like, a **background photo** (for example your star player). Press **Publish**.

The site commits the images and `data/efootball.json` to the repository; GitHub Pages redeploys it, so everyone sees the new winner after about a minute. The new win goes to the top of the page and first in the news.
When connected, each eFootball winner also shows **edit** and **delete** buttons, for example to add a win image later.

Images are resized to 1600px on your device before upload, which also strips location data from phone photos.

## Arabic

- The **العربية** button in the header switches the whole site to Arabic, right to left. Each visitor's choice is remembered.
- Share `https://billmarkeg.github.io/the-best/?lang=ar` to open the site straight in Arabic.
- Team and tournament names come from `data/names_ar.json`. Add or fix names there; anything not listed is shown as written.
  Player nicknames stay as written unless you add them under `"players"`.
- When adding a winner, the optional **Arabic version** section takes the Arabic team, tournament and star names plus an Arabic headline and story.
  Leave it empty and the Arabic headline and story are written for you.

## Keep the Excel file up to date

Winners added on the website live in `data/efootball.json`. To copy them into the workbook's `eFootball` sheet
(and to refresh the PES history if you fix something in the `tournments` sheet):

```bash
git pull
python tools/sync_excel.py
```

Close the workbook in Excel first. The script needs `openpyxl` (`pip install openpyxl`).

## Changing the code

GitHub Pages lets browsers keep files for 10 minutes, so after an update a visitor could get the new page with old scripts.
After editing anything in `assets/css` or `assets/js`, run this before committing:

```bash
python tools/bump_version.py
```

It gives every CSS and JavaScript link a new `?v=` tag, so browsers download the new code straight away.
Winners added from the website don't need it: those only change data and images.

## Preview locally

Browsers block the data files when you open `index.html` directly, so start a small web server in this folder:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Photo credits

- Background: [Camp Nou, Barcelona v Chelsea 2018](https://commons.wikimedia.org/wiki/File:Camp_Nou_Barcelona_Chelsea_14-03-2018.jpg) by Azulino, CC BY-SA 4.0
- [Gareth Bale playing for Wales, 2015](https://commons.wikimedia.org/wiki/File:Gareth_Bale_WAL_2015.jpg) by Jon Candy, CC BY-SA 2.0
- [Luis Suárez, Uruguay v England, 2014 World Cup](https://commons.wikimedia.org/wiki/File:FIFA_World_Cup_2014_-_Uruguay_2_-_England_1_-_140619-6454-jikatu_(14282608880).jpg) by Jimmy Baikovicius, CC BY-SA 2.0

All three were resized for the web. eFootball™ and PES are trademarks of Konami; this is a private fan site.
