# Deploying the RSVP Backend (No Coding Required)

This guide walks you through putting the RSVP backend online using only your web browser. You do not need to install anything or use the command line. It should take about 15 to 20 minutes the first time.

You will be doing three things: creating a Google Sheet, pasting in some code, and copying a URL into the website's config file.

## Step 1: Create the Google Sheet

1. Open a new browser tab and go to `sheets.new`. This opens a brand new blank Google Sheet.
2. Click on "Untitled spreadsheet" in the top left and rename it to `Roshan 70th RSVPs`.
3. Leave the sheet otherwise empty. The backend code will create the tab and headers it needs automatically in Step 3.

## Step 2: Open Apps Script and paste in the code

1. In your new sheet, click **Extensions** in the top menu, then click **Apps Script**. This opens a new tab with the Apps Script editor, already linked to your sheet.
2. You will see a file called `Code.gs` with some placeholder code like `function myFunction() {}`. Select all of that placeholder text and delete it.
3. Open the file `apps-script/Code.gs` from the website project on your computer, select all of its contents, and copy it.
4. Paste the full contents into the empty `Code.gs` file in the Apps Script editor.
5. Click the floppy disk save icon (or press Ctrl+S) to save the project. You can name the project something like "Roshan 70th RSVP Backend" if it asks.

## Step 3: Run setup() once

This step creates the "RSVPs" tab with the right column headers, and creates a Google Drive folder called "Roshan 70th - Guest Photos" where uploaded photos will be stored.

1. At the top of the Apps Script editor, there is a row of buttons including a dropdown that lets you pick which function to run. Click that dropdown and choose `setup`.
2. Click the **Run** button (the play icon) next to it.
3. The first time you run anything, Google will ask you to authorize the script. Click **Review permissions**.
4. Choose your Google account.
5. You will likely see a screen that says "Google hasn't verified this app". This is expected and normal, it just means the script was not published on the public Google Marketplace (it does not need to be, it's private to you). Click the small **Advanced** link at the bottom left of that screen, then click **Go to Roshan 70th RSVP Backend (unsafe)** (the exact wording may vary slightly). This is safe because it is your own script running only in your own Google account.
6. On the next screen, review the permissions (access to your Sheets and Drive) and click **Allow**.
7. The script will run. At the bottom of the editor, a panel called "Execution log" should show a line ending in something like "Setup complete." If you see a red error instead, check the Troubleshooting section below.
8. Go back to your Google Sheet tab and confirm there is now a tab named **RSVPs** with a header row: `id`, `name`, `email`, `guest_count`, `timestamp`, `photo_urls`.

## Step 4: Set the ADMIN_TOKEN

The admin token is like a password that lets you view all RSVPs and delete entries from the admin page of the website. Anyone who has this token can see guest emails and delete RSVPs, so treat it like a password.

1. In the Apps Script editor, click the gear icon on the left sidebar labeled **Project Settings**.
2. Scroll down to the section called **Script Properties**.
3. Click **Add script property**.
4. In the "Property" box, type exactly: `ADMIN_TOKEN`
5. In the "Value" box, type a long random string that you make up yourself. For example, mash your keyboard or use a phrase like `roshan70-party-secret-8271-xyz`. Make it something nobody could easily guess.
6. Click **Save script properties**.

Important: do not reuse a real password you use elsewhere. This token will effectively be visible to anyone you eventually give admin access to, so treat it as its own separate secret and store a copy of it somewhere safe, like a notes app or password manager, so you don't lose it.

## Step 5: Deploy as a web app

1. In the Apps Script editor, click the blue **Deploy** button in the top right, then click **New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in the fields:
   - Description: something like "RSVP backend v1"
   - Execute as: **Me** (your Google account)
   - Who has access: **Anyone**
4. Click **Deploy**.
5. You may be asked to authorize again. Follow the same steps as in Step 3 (Advanced > Go to project > Allow).
6. Once deployed, you will see a **Web app URL**. It will look something like:
   `https://script.google.com/macros/s/AKfycb.../exec`
7. Copy this entire URL. This is the address the website will use to talk to your Google Sheet. Keep the tab open or paste the URL somewhere temporary, you'll need it in the next step. https://script.google.com/macros/s/AKfycbzmTOSIWEwnoWjNXhHSPW1nH59hg9BSPMHslv6joWtvJyuwvTJdL_Rs_63ZjoqFc2dg/exec

## Step 6: Paste the URL into the website config

1. Open the website project on your computer and find the file `js/config.js`.
2. Near the top, find this line:
   ```js
   APPS_SCRIPT_URL: "",
   ```
3. Replace the empty quotes with your web app URL, so it looks like this (using your real URL):
   ```js
   APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycb.../exec",
   ```
4. Save the file.
5. Commit and push this change to your website's repository (GitHub) the same way you normally publish updates to the site, so the live site picks up the new URL.

Once this is live, the site is no longer in "demo mode" and will send real RSVPs to your Google Sheet.

## Step 7: How to update the code later

If you ever need to change the backend code (for example, if you paste in an updated version of `Code.gs`):

1. Paste the new code into the `Code.gs` file in the Apps Script editor and save.
2. Click **Deploy > Manage deployments**.
3. Find your existing web app deployment in the list and click the pencil (edit) icon next to it.
4. Under "Version", choose **New version** from the dropdown.
5. Click **Deploy**.

This keeps the same web app URL, so you do not need to update `js/config.js` again. The website keeps working with no changes needed.

If instead you use **Deploy > New deployment**, that creates a brand new URL and you would need to update `js/config.js` again and re-publish the site. For routine updates, always prefer editing the existing deployment (New version) rather than creating a new one, so the URL stays the same.

## Step 8: Testing it

Once `js/config.js` has your real URL and the site is live:

1. Open the live website in your browser.
2. Fill out the RSVP form with a test name (for example "Test Guest") and a test email, and submit it.
3. Go back to your Google Sheet and open the **RSVPs** tab. You should see a new row appear with the test name, email, guest count, and a timestamp.
4. Go to the admin page on the website (usually something like `admin.html`), enter the ADMIN_TOKEN you set in Step 4, and confirm you can see the test RSVP listed there along with the total guest count.
5. From the admin page, delete the test RSVP entry.
6. Go back to the Google Sheet and confirm the test row is gone.

If all of that worked, real guests can now RSVP and you can manage the list from the admin page.

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| Running `setup()` fails with a permissions error, or nothing seems to happen | The script has not been authorized yet, or authorization was cancelled | Re-run `setup()` from the dropdown and play button, and this time click through the full "Advanced > Go to project > Allow" flow described in Step 3 |
| Admin page says "unauthorized" even though you typed the token | The token you typed does not exactly match the `ADMIN_TOKEN` script property (check for extra spaces, wrong case, or a leftover old token), or `ADMIN_TOKEN` was never saved in Script Properties | Go to Project Settings > Script Properties in the Apps Script editor and confirm `ADMIN_TOKEN` exists and matches exactly what you are typing on the admin page |
| The website shows a login page or an HTML page instead of the expected data, or you see errors mentioning "Unexpected token <" | The deployment's "Who has access" was not set to **Anyone**, so Google is showing a sign-in page instead of running the script | Go to Deploy > Manage deployments, edit the deployment, and confirm "Who has access" is set to **Anyone**, then deploy a new version |
| RSVPs submitted on the site never show up in the sheet | `js/config.js` still has an empty `APPS_SCRIPT_URL` (site is in demo mode), or the URL was copied incorrectly | Check `js/config.js`, confirm the URL is filled in exactly as copied from the Deploy screen, ending in `/exec`, then save, commit, and push again |
| You updated the code but the website does not seem to reflect the change | You used "New deployment" instead of editing the existing one and creating a "New version", so the old URL is now serving old code, or the new URL was never copied into `js/config.js` | Follow Step 7: edit the existing deployment and choose "New version" rather than creating a brand new deployment |
