# The Best · eFootball champions

A small static website for our tournaments: the latest champion first, upcoming championships with sign-up and reminders, the eFootball roll of honour, news with win photos, all-time stats, and every title since PES 2012. It runs on GitHub Pages and needs no build step.

## What's where

| Path | What it is |
|---|---|
| `index.html`, `assets/` | The public website (HTML, CSS, JavaScript, images) |
| `admin.html` | The admin dashboard: championships, winners and sign-ups. It only works with your GitHub token. |
| `data/championships.json` | Announced championships, edited from the dashboard |
| `data/efootball.json` | eFootball-era winners, edited from the dashboard |
| `data/config.json` | The address of the sign-up service, set from the dashboard |
| `data/pes_history.json` | PES-era winners, generated from the `tournments` sheet |
| `data/names_ar.json` | Arabic names for teams, tournaments and (optionally) players |
| `assets/js/i18n.js` | All English and Arabic interface text |
| `tools/notifications/Code.gs` | The free Google Apps Script that keeps the sign-ups and sends the reminders |
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

## The admin dashboard

Open **https://billmarkeg.github.io/the-best/admin.html**. It isn't linked from the site, so bookmark it.

1. Create a token once: [GitHub → Fine-grained tokens → Generate new token](https://github.com/settings/personal-access-tokens/new)
   - Repository access: **Only select repositories** → `the-best`
   - Repository permissions: **Contents → Read and write**
2. On the dashboard, paste the token and press **Connect**. The token is stored only in that browser, so connect once per device and use it only on your own devices.

Then:

- **New championship**: name (and an Arabic name), date, start time, when to remind players (15, 20 or 30 minutes before), and optionally the maximum number of players and the details. Press **Announce**. About a minute later it's on the site with a countdown and a **Sign up** button.
- **Record winner**: after the final, press **Record winner** on the championship. The winner form is already filled in with the championship's name and date (and the number of players who signed up); add the champion, team, score, star player and photos, then **Publish**. The championship moves to *Finished*, and the winner goes to the top of the site and first in the news.
- **Already played?** Create the championship with its real date: the winner form opens straight away, and the winner is placed in the list by date.
- **Edit**, **Call off**, **Restore**, **Delete**: changing the time or calling a championship off also tells the players who signed up (see below).
- **Winners**: edit or delete any eFootball winner. Deleting a championship's winner puts the championship back to *Needs a winner*.

Every change is one commit to the repository, made from your browser; GitHub Pages updates the site for everyone in about a minute. Images are resized to 1600px on your device before upload, which also strips location data from phone photos.

## Sign-ups and reminders (free)

Players sign up on the site with their name and an email address or a WhatsApp number. The sign-ups go into a Google Sheet in your own Google account, through a small Google Apps Script (`tools/notifications/Code.gs`). It's free: Gmail lets the script send about 100 emails a day, plenty for us.

- **Email players** get a confirmation (with *Add to Google Calendar* and a cancel link), then a reminder 15, 20 or 30 minutes before the start, as set for the championship.
- **WhatsApp players**: automatic WhatsApp messages need Meta's paid WhatsApp Business API, so instead the script emails **you** at reminder time with a one-tap WhatsApp link for each of them. The message is ready, in the player's language: tap, then send. The same email has a link to post the reminder in your WhatsApp group.
- If you change a championship's time, call it off or restore it, the email players get an email and you get WhatsApp links for the others.
- The site shows how many players signed up and their names, never their emails or numbers.
- To take someone off the list, type `cancelled` in the *Status* column of the sheet.

### Set it up (once, about 5 minutes)

1. Open [script.new](https://script.new) while signed in to your Google account. A new Apps Script project opens.
2. Replace the sample code with `tools/notifications/Code.gs` (the dashboard's **Copy the script** button copies it with this site's address filled in), then press **Save**.
3. Choose the `setup` function in the toolbar and press **Run**. Allow the permissions Google asks for. It's your own script, so if Google warns that the app isn't verified, choose **Advanced → Go to project**. You'll get an email with the link to your sign-ups sheet.
4. Press **Deploy → New deployment**, choose the type **Web app**, set **Execute as: Me** and **Who has access: Anyone**, then **Deploy**, and copy the **Web app URL**.
5. In the dashboard, under **Sign-ups & reminders**, paste the URL, press **Test**, then **Save to site**.

The settings at the top of the script cover the time zone used in emails (Cairo), the language of the emails you get, whether you're emailed on every sign-up, and the country code for numbers typed without one (20, Egypt).
If you change the script later, publish the new code with **Deploy → Manage deployments → Edit → Version: New version → Deploy**; the URL stays the same.

## Arabic

- The **العربية** button in the header switches the whole site to Arabic, right to left. Each visitor's choice is remembered.
- Share `https://billmarkeg.github.io/the-best/?lang=ar` to open the site straight in Arabic.
- Team and tournament names come from `data/names_ar.json`. Add or fix names there; anything not listed is shown as written.
  Player nicknames stay as written unless you add them under `"players"`.
- Championships have an optional Arabic name and Arabic details. Players who sign up from the Arabic site get their emails and WhatsApp messages in Arabic.
- When recording a winner, the optional **Arabic version** section takes the Arabic team, tournament and star names plus an Arabic headline and story.
  Leave it empty and the Arabic headline and story are written for you.

## Keep the Excel file up to date

Winners added on the dashboard live in `data/efootball.json`. To copy them into the workbook's `eFootball` sheet
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

It gives every CSS and JavaScript link on every page a new `?v=` tag, so browsers download the new code straight away.
Changes made from the dashboard don't need it: those only change data and images.

## Preview locally

Browsers block the data files when you open `index.html` directly, so start a small web server in this folder:

```bash
python -m http.server 8000
```

Then open http://localhost:8000 (and http://localhost:8000/admin.html for the dashboard).

## Photo credits

- Background: [Camp Nou, Barcelona v Chelsea 2018](https://commons.wikimedia.org/wiki/File:Camp_Nou_Barcelona_Chelsea_14-03-2018.jpg) by Azulino, CC BY-SA 4.0
- [Gareth Bale playing for Wales, 2015](https://commons.wikimedia.org/wiki/File:Gareth_Bale_WAL_2015.jpg) by Jon Candy, CC BY-SA 2.0
- [Luis Suárez, Uruguay v England, 2014 World Cup](https://commons.wikimedia.org/wiki/File:FIFA_World_Cup_2014_-_Uruguay_2_-_England_1_-_140619-6454-jikatu_(14282608880).jpg) by Jimmy Baikovicius, CC BY-SA 2.0

All three were resized for the web. eFootball™ and PES are trademarks of Konami; this is a private fan site.
