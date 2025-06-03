## Project Overview

This repository implements a Slack ↔ Google Sheets integration that converts starred or reacted‐to messages in a designated Slack channel into Tasks tracked in Google Sheets and Google Tasks ([lido.app][1]). Reacting to a message with a specific emoji automatically logs the message link, user, timestamp, and emoji into a “Task Message Tracker” sheet, flags it for processing, and then pushes the item to Google Tasks via Apps Script ([medium.com][2]). Once the task is completed in Google Tasks, its status is updated back in the “Completed Tasks” sheet, keeping a full audit trail with Slack and Google Task links ([reddit.com][3]). A separate “Config” sheet stores the Slack bot credentials, OAuth tokens, and Slack usernames needed to authenticate and authorize the script ([medium.com][4]).

---

## Prerequisites

* **Google Account** with edit access to the target Google Sheets file  ([lido.app][1]).
* **Slack Workspace Admin** or permission to create and manage Slack Apps and workflows  ([medium.com][2]).
* **Node.js and npm** to install and use `clasp` (if you prefer local development) ([lido.app][1]).
* **Google Apps Script API enabled** on the Google account (in *Apps Script → Settings → Google Apps Script API*) ([medium.com][4]).

---

## Google Sheet Structure

Your Google Sheets file must contain three tabs (sheets), each with the following columns exactly as listed. The order matters because Apps Script refers to these columns by index.

### 1. Task Message Tracker

Columns in order:

1. **Slack Message Link** – Full permalink to the Slack message (e.g., `https://workspace.slack.com/archives/C12345678/p1617623456789`) ([lido.app][1]).
2. **User** – Display name of the Slack user (e.g., `jane.doe`) ([lido.app][1]).
3. **Timestamp** – Epoch timestamp string (e.g., `1617623456.789`) to identify the Slack message ([stackoverflow.com][5]).
4. **Emoji** – Name of the emoji reaction without colons (e.g., `white_check_mark`) ([stackoverflow.com][5]).
5. **Processed Pointer** – A boolean or flag (`TRUE`/`FALSE`) to indicate whether the Apps Script has already consumed this row ([community.make.com][6]).
6. **Message ID** – The `ts` field Slack returns in API responses (same as “Timestamp”) ([stackoverflow.com][5]).
7. **Channel ID** – Slack channel ID (e.g., `C12345678`) where the message resides ([stackoverflow.com][5]).
8. **Task ID** – ID of the created Google Task for linking back (e.g., `MTg2MTY0ODI0MjQzNTY0NzcxNA`) ([medium.com][2]).
9. **Run Logs** – A text field where Apps Script logs success/failure messages for each row (e.g., `Task created: MTg2...`) ([community.make.com][6]).
10. **Slack Link** – Redundant copy of the Slack message link for easy click‐through (same as column 1) ([reddit.com][3]).
11. **Google Task Link** – The URL for the Google Task in the Google Tasks UI (e.g., `https://tasks.google.com/embed/?origin=https://tasks.googleapis.com/...`) ([medium.com][2]).
12. **State** – One of the following string values:

    * `INTAKE` – Newly ingested from Slack but not yet pushed
    * `PUSHED` – Google Task created successfully
    * `COMPLETED` – Marked done in Google Tasks and archived
      ([community.make.com][6]).
13. **Task Queue** – Optional priority or ordering field if you want a custom queue (e.g., `High`, `Low`) ([reddit.com][3]).

### 2. Completed Tasks

Columns in order:

1. **Task Queue** – Same queue or priority label from “Task Message Tracker” for grouping completed items ([reddit.com][3]).
2. **Title** – The human‐readable title of the completed task (extracted from the Slack message content) ([medium.com][2]).
3. **Slack Link** – Direct permalink to the original Slack message ([lido.app][1]).
4. **Google Task Link** – Direct link to the completed Google Task ([medium.com][2]).

### 3. Config

Columns in order (only one row is used):

1. **USERNAME** – Your Slack display name (e.g., `jane.doe`) ([reddit.com][3]).
2. **SLACK\_USERNAME** – Slack Backend ID (format: `UXXXXXXXX`) for your bot (e.g., `U123421234`) ([medium.com][2]).
3. **SLACK\_TOKEN** – OAuth Bot token from Slack (format: `xoxb-1234567890-...`) with scopes `channels:read`, `channels:join`, `chat:write`, `reactions:read`, `reactions:write`, and `users:read` ([stackoverflow.com][5]).

---

## Slack Configuration

This integration relies on Slack Workflows (or a custom Slack App) that, upon a reaction in a chosen channel, inserts a new row into the “Task Message Tracker” sheet with the first four fields populated. You can implement this with either:

1. **Slack Workflow Builder + Webhook**
2. **Custom Slack App + Event Subscription + Apps Script Webhook**

### 1. Using Slack Workflow Builder

1. **Create a New Workflow** in the desired Slack channel (e.g., `#tasks`) ([medium.com][2]).
2. **Trigger**: Select **“Add reaction”** (choose your task emoji, e.g., `:white_check_mark:`) ([medium.com][2]).
3. **Add Step**: Choose **“Send Data to Webhook”** and paste your Apps Script Web App URL (explained in the Apps Script README). Configure the JSON payload so it sends:

   ```json
   {
     "slack_message_link": "{{message_link}}",
     "user": "{{user_name}}",
     "timestamp": "{{message_ts}}",
     "emoji": "white_check_mark"
   }
   ```

   ([community.make.com][6]).
4. **Sheet Row Insertion**: In your Apps Script “Webhook Handler” function, pick up the POST body, parse `slack_message_link`, `user`, `timestamp`, and `emoji`, and write them to the next empty row in “Task Message Tracker” with:

   * **Processed Pointer** = `FALSE`
   * **State** = `INTAKE`
     ([community.make.com][6]).

### 2. Using a Custom Slack App

1. **Create a Slack App** at `api.slack.com/apps` and assign it to your workspace ([medium.com][2]).
2. **Enable Event Subscriptions**: Subscribe to `reaction_added` events under **Scopes → Event Subscriptions** ([stackoverflow.com][5]).
3. **Request Scopes** (OAuth & Permissions):

   * `channels:read` (to list channels) ([stackoverflow.com][5])
   * `chat:write` (to post messages, if needed) ([stackoverflow.com][5])
   * `reactions:read`, `reactions:write` (to detect and remove reactions) ([stackoverflow.com][5])
   * `users:read` (to get user display names) ([stackoverflow.com][5])
4. **Install the App** to your workspace → Copy the Bot User OAuth Token (`xoxb-…`) and paste it into the “Config” sheet under **SLACK\_TOKEN** ([medium.com][2]).
5. **Create an Apps Script Webhook Handler** (see “Apps Script Setup” below). Point the Slack **Request URL** for `reaction_added` events to the published Web App URL so that any `reaction_added` payload hits your Apps Script, which then writes the row.

---

## Apps Script Setup

Use Google Apps Script (GAS) to process incoming Slack webhooks, create Google Tasks, and update Sheets. Each of the key functions is described below.

### 1. Project Structure

* **Code.gs** – Main server script that contains:

  * `doPost(e)` – Webhook handler to ingest Slack event data and insert rows.
  * `processTaskQueue()` – Scheduled trigger that scans “Task Message Tracker” for rows with **State = INTAKE**, calls Slack API to fetch message text, then creates a Google Task and updates the row.
  * `onTaskCompleted(e)` – Webhook or manual trigger when a Google Task is marked completed, which moves the row to “Completed Tasks.”
* **appsscript.json** – Manifest file listing OAuth scopes:

  ```json
  {
    "timeZone": "America/New_York",
    "oauthScopes": [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/script.external_request",
      "https://www.googleapis.com/auth/tasks",
      "https://www.googleapis.com/auth/script.send_mail",
      "https://www.googleapis.com/auth/script.scriptapp"
    ]
  }
  ```

  ([medium.com][4]).

### 2. Webhook Handler (`doPost`)

Every time Slack fires a `reaction_added` event (either via Workflow or Custom App), Slack POSTs a JSON body. Your `doPost(e)` should:

1. **Parse the JSON**:

   ```javascript
   var payload = JSON.parse(e.postData.getDataAsString());
   var slackLink = payload.slack_message_link;
   var user = payload.user;
   var ts = payload.timestamp;
   var emoji = payload.emoji;
   ```

   ([community.make.com][6]).
2. **Append Row to “Task Message Tracker”**:

   ```javascript
   var sheet = SpreadsheetApp.getActiveSpreadsheet()
                   .getSheetByName("Task Message Tracker");
   sheet.appendRow([
     slackLink,
     user,
     ts,
     emoji,
     false,         // Processed Pointer
     ts,            // Message ID
     extractChannelId(slackLink),
     "",            // Task ID (to be filled later)
     "",            // Run Logs
     slackLink,     // Slack Link (redundant)
     "",            // Google Task Link
     "INTAKE",      // State
     ""             // Task Queue (<optional>)
   ]);
   ```

   * **`extractChannelId(...)`** is a helper that parses the channel ID from the permalink. ([stackoverflow.com][5]).
3. **Return 200** HTML to Slack to acknowledge receipt:

   ```javascript
   return ContentService
            .createTextOutput(JSON.stringify({ status: "success" }))
            .setMimeType(ContentService.MimeType.JSON);
   ```

   ([community.make.com][6]).

### 3. Processing “INTAKE” Rows (`processTaskQueue`)

Set up a **Time‐Driven Trigger** (e.g., every 5 minutes) in Apps Script:

1. **Fetch All Rows** with **State = INTAKE** (i.e., column 12) ([community.make.com][6]).
2. **For Each Row**:
   a. **Call Slack API** `conversations.history` or `conversations.replies` to retrieve the full message text by `channel` and `timestamp` ([stackoverflow.com][5]).
   b. **Construct Task Title/Notes** from the message text (e.g., `"TODO: " + messageText`) ([medium.com][2]).
   c. **Create a Google Task** under a preconfigured Task list via Google Tasks API:

   ```javascript
   var task = {
     title: taskTitle,
     notes: "From Slack message by " + user + " on " + new Date(parseFloat(ts) * 1000).toLocaleString(),
     due: null
   };
   var createdTask = Tasks.Tasks.insert(task, "@default"); // default Task list
   ```

   ([medium.com][2]).
   d. **Update Row**:
   ‑ Set **Task ID** (column 8) = `createdTask.id`
   ‑ Set **Google Task Link** (column 11) = `"https://tasks.google.com/embed?origin=https://tasks.googleapis.com&type=tasks&task=" + createdTask.id`
   ‑ Set **State** (column 12) = `PUSHED`
   ‑ Append log text to **Run Logs** (column 9), e.g., `"Task created: " + createdTask.id` ([community.make.com][6]).

### 4. Handling Task Completion (`onTaskCompleted`)

If you want to move items automatically when users check them off in Google Tasks:

1. **Use** the [Tasks.watch](https://developers.google.com/tasks/reference/rest/v1/tasks/watch) push notification feature to route completion events to your Apps Script Webhook (optional; advanced). ([medium.com][2]).
2. **Simpler Approach**: Periodically scan “Task Message Tracker” for **State = PUSHED** and use `Tasks.Tasks.get(...).status` to see if it’s `completed`. If so:
   a. Move that row’s data into the “Completed Tasks” sheet with **Task Queue**, **Title**, **Slack Link**, **Google Task Link** ([reddit.com][3]).
   b. Set the original row’s **State** to `COMPLETED` ([community.make.com][6]).

---

## Local Development & Version Control (Optional)

For teams or advanced workflows, you can develop on your local machine using `clasp` and push changes via GitHub. This section is optional if you code directly in the Apps Script online editor.

### 1. Install `clasp`

```bash
npm install -g @google/clasp
```

([lido.app][1]).

### 2. Clone or Initialize the Apps Script Project

* **Clone Existing (Container‐Bound)**:

  1. Copy **Script ID** from **Extensions → Apps Script → Project Settings** in Google Sheets ([lido.app][1]).
  2. Run:

     ```bash
     clasp clone <SCRIPT_ID> --rootDir src
     ```

     ([lido.app][1]).
* **Initialize New** (Standalone):

  ```bash
  mkdir src && cd src
  clasp create --title "Slack-GSheet Todo Integration" --type sheets
  ```

  ([lido.app][1], [medium.com][4]).

### 3. Git Repository Setup

1. In your project root (parent of `src/`), initialize Git:

   ```bash
   git init
   git add .
   git commit -m "Initial commit: Apps Script Slack‐Sheets TODO integration"
   ```

   ([reddit.com][3]).
2. Add a `.gitignore` to exclude:

   ```
   node_modules/
   .clasprc.json
   ```

   ([reddit.com][3]).
3. Push to your GitHub repo:

   ```bash
   git remote add origin https://github.com/yourusername/your-repo.git
   git push -u origin main
   ```

   ([reddit.com][3]).

### 4. Deploying Changes

* **Push to Apps Script**:	From project root:

  ```bash
  clasp push
  ```

  ([lido.app][1]).
* **Version & Deploy** (for executable webhooks):

  ```bash
  clasp version "Update webhook handler"
  clasp deploy --deploymentId <DEPLOYMENT_ID>
  ```

  .

---

## Slack Bot Creation Instructions

Follow these generic steps to create and install the Slack App (bot user) that raises `reaction_added` events:

1. **Navigate to [https://api.slack.com/apps](https://api.slack.com/apps)** and click **“Create New App”** ([medium.com][2]).
2. **Name the App** (e.g., “TaskBot”) and choose your Slack workspace ([medium.com][2]).
3. **Under “Bot Token Scopes,” add**: 

   * `channels:read` – to list channels and verify channel IDs ([stackoverflow.com][5]).
   * `chat:write` – in case you want the bot to post messages (e.g., confirmation replies) ([stackoverflow.com][5]).
   * `reactions:read` and `reactions:write` – to detect added reactions and optionally remove them after ingestion ([stackoverflow.com][5]).
   * `users:read` – to look up user display names from IDs ([stackoverflow.com][5]).
4. **Install App to Workspace** and copy the **Bot User OAuth Token** (`xoxb-…`) from the “OAuth & Permissions” page ([medium.com][2]). Paste this token into the “Config” sheet under **SLACK\_TOKEN**.
5. **Turn on “Event Subscriptions”** and set the **Request URL** to your Apps Script Web App endpoint (you must deploy the script as a Web App first). ([stackoverflow.com][5]).
6. **Under “Subscribe to bot events,” add**: `reaction_added` ([stackoverflow.com][5]).
7. **Save Changes** and ensure your Webhook returns a valid `200 OK` JSON (Slack expects a 3 second acknowledgment). ([community.make.com][6]).

---

## Deployment Steps

1. **Publish Apps Script as Web App**:

   * In the Apps Script editor, go to **Deploy → New deployment** ([medium.com][4]).
   * Select **“Web App”**, set \*\*Execute as \*\*= “Me (your email)”, and **Who has access** = “Anyone”—so that Slack can post to it ([stackoverflow.com][7]).
   * Copy the **Web App URL** and paste into Slack’s **Event Subscriptions → Request URL** ([stackoverflow.com][7]).
2. **Enable Triggers**:

   * In Apps Script editor, open **Triggers** (clock icon) and add:

     * **processTaskQueue** → Time‐Driven → Every 5 minutes (or desired interval) ([community.make.com][6]).
     * **onTaskCompleted** → Time‐Driven → Every 10 minutes (if using pull method) ([community.make.com][6]).
3. **Test End‐to‐End Flow**:

   1. React to a message in the configured Slack channel with `:white_check_mark:` ([medium.com][2]).
   2. Confirm a new row appears in **Task Message Tracker** with **State = INTAKE** ([community.make.com][6]).
   3. Wait \~5 minutes, then verify the row updates to **State = PUSHED** and a **Task ID** and **Google Task Link** are populated ([community.make.com][6]).
   4. Mark the Google Task as complete ✩ confirm the item moves to **Completed Tasks** sheet and its **State** changes to `COMPLETED` in the tracker ([reddit.com][3]).

---

## Folder Structure

```
/ (repo root)
├── .clasp.json                  # clasp configuration (scriptId + rootDir)
├── .gitignore                   # excludes node_modules, .clasprc.json, etc.
├── README.md                    # this file
└── src/                         # Root directory for Apps Script files
    ├── Code.gs                  # Main Apps Script logic (doPost, processTaskQueue, onTaskCompleted)
    ├── appsscript.json          # Manifest with OAuth scopes
    └── Utils.gs                 # Helper functions (e.g., extractChannelId, logError)
```

([lido.app][1]).

---

## Troubleshooting & FAQs

* **Webhook Not Firing / 410 Errors** – Ensure your Web App is deployed to “Anyone”—otherwise Slack cannot access it ([stackoverflow.com][7]).
* **Sluggish Queue Processing** – Confirm the Time‐Driven trigger schedule for `processTaskQueue` (Apps Script triggers sometimes run a few minutes late) ([community.make.com][6]).
* **Slack Token Errors** – Double‐check `SLACK_TOKEN` in the “Config” sheet. If you see `invalid_auth`, reinstall the Slack App with correct scopes ([stackoverflow.com][5]).
* **“Missing\_scope” or “Not\_allowed\_token\_type”** – Verify the Bot token was granted `reactions:read` and `reactions:write`, not a User token or legacy token ([stackoverflow.com][5]).
* **Google Task API Quotas** – If you exceed the free tier of Google Tasks writes, you may see quota errors. Throttle your `processTaskQueue` frequency or request higher quotas ([medium.com][2]).

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details. .

---

## Acknowledgments

* Inspired by various **Google Apps Script + Slack** tutorials and Medium articles ([medium.com][2]).
* Thanks to Stack Overflow answers on **writing to Sheets from Slack App** and **Apps Script triggers** ([stackoverflow.com][5], [community.make.com][6]).
* Maintained by *Your Name*. Contributions and feedback welcome! ([reddit.com][3]).

---

> **Note:** Replace placeholder `<SCRIPT_ID>`, Slack channel IDs, and OAuth tokens with your own workspace values. Always secure your `SLACK_TOKEN` and treat it like a secret. ([reddit.com][3]).

[1]: https://www.lido.app/tutorials/slack-to-google-sheets?utm_source=chatgpt.com "Connect Slack to Google Sheets (Easiest Way in 2025) - Lido"
[2]: https://medium.com/maverislabs/build-a-free-slack-app-using-google-apps-scripts-and-some-fun-features-to-make-you-look-cool-to-6afb1b91a1c7?utm_source=chatgpt.com "Build a free Slack App using Google Apps Scripts and some fun ..."
[3]: https://www.reddit.com/r/GoogleAppsScript/comments/126m1bw/a_way_to_update_a_row_on_google_sheet_from_your/?utm_source=chatgpt.com "A way to update a row on google sheet from your custom slack app?"
[4]: https://medium.com/maverislabs/google-apps-scripts-libraries-how-to-set-them-up-and-turn-slack-into-a-real-time-logging-platform-86b7bd6978c1?utm_source=chatgpt.com "Google Apps Scripts Libraries — How to set them up and turn Slack ..."
[5]: https://stackoverflow.com/questions/58550007/im-trying-to-post-a-slack-message-for-each-new-row-of-a-spreadsheet-using-googl?utm_source=chatgpt.com "I'm trying to post a Slack message for each new row ... - Stack Overflow"
[6]: https://community.make.com/t/using-google-app-scripts-to-send-a-webhook-for-new-or-updated-rows-in-google-sheets/6788?utm_source=chatgpt.com "Using Google App Scripts to send a webhook for new or updated ..."
[7]: https://stackoverflow.com/questions/73218375/how-to-send-hyperlinked-text-from-google-sheet-to-slack?utm_source=chatgpt.com "How to Send Hyperlinked text from Google sheet to Slack?"
