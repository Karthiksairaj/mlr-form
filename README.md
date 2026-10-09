# MLR Form Screenshot PoC

An asynchronous backend and a separate React application for approved form automation. Playwright performs the browser work, with selectable local, OpenAI, Claude, or Gemini test-data generation.

## Project layout

- `frontend/`: standalone React + TypeScript application, with its own package.json, lockfile, Vite configuration, and dependencies.
- `src/`: Fastify API and Playwright form runner.
- `public/demo-form.html`: local example form for testing.

React calls the existing API. AI keys and browser automation stay on the backend.

## Capabilities

- P1: load, extract, fill, optionally submit, and capture screenshots
- P2: detect next/continue controls, repeat extraction and filling across multi-step forms, and capture the final confirmation
- P3: detect reCAPTCHA, hCaptcha, and Turnstile; capture evidence and safely skip submission when a visible challenge requires a person
- P4: validate thank-you pages, inline success messages, configured selectors/text, and redirects after submission
- P5: generate schema-constrained data with OpenAI, Claude, or Gemini; validate every value and retry once before using the local fallback

## Quick start

Requirement: Node.js 20.19+ or 22.12+ (Node 24 is also supported). No AI API key is needed when using the default local generator.

```powershell
npm install
npm run install:ui
npx playwright install chromium
Copy-Item .env.example .env
```

Edit `.env`:

```dotenv
# Empty means any public HTTP(S) form URL.
ALLOWED_TARGET_HOSTS=
API_TOKEN=choose-a-long-random-token
# Leave AI settings empty to use the local deterministic generator.
AI_PROVIDER=
```

To use OpenAI:

```dotenv
AI_API_KEY=your-openai-api-key
AI_MODEL=gpt-5.4-mini
```

To switch to Claude, change the provider and configure its key/model; no code
change is required:

```dotenv
AI_API_KEY=your-anthropic-api-key
AI_MODEL=claude-sonnet-4-5
```

Gemini uses the same generic settings:

```dotenv
AI_API_KEY=your-gemini-api-key
AI_MODEL=gemini-3.6-flash
```

The provider is inferred from the `AI_MODEL` prefix. `AI_PROVIDER` remains
available as an explicit override when needed.

Then run:

```powershell
npm run dev
```

Open `http://127.0.0.1:5173`. This command starts the API on port 3000 and the
React development server on port 5173, with live reload. Vite forwards `/v1`,
`/api`, and `/demo-form.html` requests to the backend, so no CORS setup is needed.

To run them in separate terminals:

```powershell
# Terminal 1, from the repository root
npm run dev:api

# Terminal 2
cd frontend
npm run dev
```

If your API uses a different port, copy `frontend/.env.example` to `frontend/.env`
and update `API_PROXY_TARGET`. Keep AI API keys in the root `.env`; do not put
them in the React app or any `VITE_` variable. If `API_TOKEN` is configured, enter
it in the UI's API bearer token field.

For production or a single local server:

```powershell
npm run build
npm start
```

The backend then serves the built React app at `http://127.0.0.1:3000`.
The build produces `dist/` for the API and `frontend/dist/` for the UI.
Deploy both directories. The Dockerfile builds and copies both applications.

For Docker, supply an API token because the container listens on all interfaces:

```powershell
docker build -t mlr-form .
docker run --rm -p 3000:3000 -e API_TOKEN=your-test-api-token mlr-form
```

Enter that token in the UI when starting a run.

For the Linzess savings-card example, enter `https://www.linzess.com/savings-card`.
The UI uses backend defaults without requiring a scenario or page count. Leave
`Submit final form` unchecked when you only want filled screenshots without a
live enrollment submission.

For the included local two-step demo form, use this development-only configuration:

```dotenv
ALLOWED_TARGET_HOSTS=127.0.0.1
ALLOW_PRIVATE_NETWORKS=true
```

Then enter `http://127.0.0.1:3000/demo-form.html` in the UI. Never enable private-network access in a shared or production deployment.

## API

### AI with conditional inputs

Choose **AI with conditional inputs (no Excel)** in the UI, or create a run
with `"inputMode": "ai-guided"`. The runner fills general text fields with the
configured generator. It pauses for routing and conditional choices, NPI and
card numbers, verification codes, and contact details used for code delivery.
Ordinary choices such as State and Gender, and ordinary email and phone fields,
are filled by AI.
For example, it asks for a real email, submits the form, then asks for the OTP
when the site shows that field. Newly revealed fields on the same page appear
as another direct input request. Multiple form buttons are presented as a
choice. The same browser session remains open throughout.
When a choice is not clearly conditional from its question, the runner briefly
tries its options and checks whether visible fields change. If they do, it
waits for your answer before following that branch. After your choice, it
triggers the site's change event and scans again for newly revealed controls.
Paired Email Address and Verify Email Address fields are both requested and
must match before the runner continues.

API clients poll until `status` is `awaiting_input`. For
`inputRequest.kind === "human-fields"`, render `inputRequest.fields` and POST
`{ "values": { "<field id>": "<value>" } }` to
`/v1/form-runs/:runId/input/:token`. Send checkbox and radio values as
`"true"` or `"false"`, including one true option per radio group. Values such
as card numbers and OTPs remain text so leading zeros are preserved. Choice and
action requests use `inputRequest.actions` and the same endpoint with an
`actionId`, as described below. No workbook is generated in this mode.

Field routing also uses input types and labels/names, so verify that a site's
unusual validation field is presented before submitting it. If the site rejects
a submission, its validation message and the fields are shown for correction.

### Excel form data

The UI defaults to **Excel for each page**:

1. Enter the form URL and click **Open form and prepare Excel**.
2. If the page first asks you to choose a condition or route, select it in the
   UI. The runner waits for the corresponding form before offering Excel.
3. Click **Download Excel for page 1**. The workbook lists the fields detected
   on that page, with labels, types, required flags, and available choices.
4. Fill the blue `Value` cells, save the workbook, then select it and click
   **Upload and continue**. Keep the `Field` identifiers and workbook sheets unchanged.
5. If a checkbox or select reveals more fields on the same page, fill a
   supplemental workbook containing only those new fields. Earlier answers stay
   filled and the page number stays the same.
6. When several form buttons are available, choose the button to follow in the
   UI (for example, **Get New Card** or **Activate Existing Card**). No Excel
   upload is needed for this choice. A new form after that action gets its own
   workbook, including when it opens at the same URL.
7. Repeat until a confirmation is detected or the filled form is captured.

The same browser session stays open across uploads, preserving cookies and form
progress. Refreshing the runner UI resumes its active run in the same browser tab.
Blank required values are rejected before filling; AI fills blanks only when you
explicitly select **Use AI / configured generator for blank values** on upload.
If the target backend rejects the data and stays on the page, the runner shows a
fresh screenshot and provides a correction workbook with your earlier answers
already filled. Each workbook is tied to its run and the requested fields;
download the currently offered workbook when the field set changes.
**Cancel run** releases a
waiting session. Sessions expire at `RUN_TIMEOUT_MS` (30 minutes by default),
including time spent editing Excel; a server restart requires a new run.
Waiting sessions occupy a worker slot under `MAX_CONCURRENT_RUNS`.
The first form has up to `INITIAL_FORM_READY_TIMEOUT_MS` (three minutes by
default) to render after the page loads; later step changes use
`FORM_READY_TIMEOUT_MS` (30 seconds by default). Increase the initial value
in `.env` for sites with slower embedded forms.

Submission requires explicit authorization, including buttons that submit data
before opening another form. You can enable it when starting the run, or approve
the selected button when it appears. An approval at the button choice applies
to that submission; a later submission asks again. Guided mode follows
your selected choices instead of traversing every possible branch.

For API use, create a run with `"inputMode": "excel-steps"` and no initial file.
Poll its status until `status` is `awaiting_input`. `inputRequest.downloadUrl`
downloads the workbook; then POST `{ "payloadExcel": { "filename": "step.xlsx",
"base64": "..." }, "useAI": false }` to
`/v1/form-runs/:runId/input/:token`, using `inputRequest.token`. Invalid workbooks
return 400 while keeping the step open. Stale/duplicate uploads return 409.
When `inputRequest.kind` is `action`, display `inputRequest.actions` and POST
`{ "actionId": "<selected action id>" }` to the same input endpoint. There is no
workbook for an action request. If the run started with `submit: false`, a submit
action also requires `"authorizeSubmit": true`; otherwise the choice stays open.
Invalid action IDs leave the choice open.
To cancel a waiting run, POST `{}` to `/v1/form-runs/:runId/cancel-input`.

Select **Automatic (AI / configured generator)** to use the original continuous
runner with an optional initial Excel payload, described below. Existing API
requests default to automatic mode for compatibility.

Upload an optional `.xlsx` file using **Excel payload** in the UI. Use a sheet
named `Payload` (or the first worksheet), with exactly these two columns:

| Field | Value |
| --- | --- |
| firstName | Jamie |
| email | form.test@abbvie.com |
| npi | |
| cardActivationNumber | |

Use the form's authored field name or visible label in `Field`. Names take
priority over labels; matching ignores case, surrounding/repeated spaces and
a trailing required-field asterisk. Use unique names when labels repeat.
Format `Value` cells as **Text before entering values**, especially identifiers
with leading zeros or more than 15 digits. Formula and numeric cells are rejected
so Excel cannot silently change an identifier. Blank values use the configured
AI/local generator. The blank NPI/card rows above are placeholders, not valid test
identifiers; backend acceptance still requires values supplied by your test-data owner.

Excel values override generated data on every step and conditional branch.
Only remaining fields are sent to the generator. Supplied values are validated
against form constraints and never padded, truncated, regenerated or replaced by
fallback. A fully covered step needs no AI call. For a select, use its option value
or label. For a radio/checkbox group, use its name and one option value or label;
for an individual checkbox, use text `true` or `false`. A supplied branch selection
limits traversal to that choice. Entries for fields not encountered in a run are
unused. Maximum upload: 1 MB and 500 data rows.

API callers send the file as `payloadExcel` alongside the usual run settings:

```json
{
  "url": "https://test.example.com/register",
  "scenario": "hcp-registration",
  "submit": false,
  "payloadExcel": {
    "filename": "form-data.xlsx",
    "base64": "<base64-encoded file bytes>"
  }
}
```

The workbook is parsed before the run is queued. Invalid workbooks return HTTP
400 with a row-specific message where possible. Payload values remain in memory
for execution and are omitted from run JSON files and status responses. Filled
screenshots and PDFs can contain the entered values.

Create a run:

```http
POST /v1/form-runs
Authorization: Bearer <API_TOKEN>
Content-Type: application/json

{
  "url": "https://test.example.com/register",
  "scenario": "hcp-registration",
  "submit": true,
  "maxSteps": 10,
  "expectedOutcome": {
    "urlContains": "/thank-you",
    "textContains": "Thank you",
    "selector": "[data-testid='confirmation']"
  }
}
```

The API returns `202` with a run ID. Poll `GET /v1/form-runs/:runId`; list artifacts at `GET /v1/form-runs/:runId/artifacts`. Each run with screenshots also produces a PDF artifact for the MLR backend. Run metadata includes CAPTCHA handling, per-branch confirmation outcomes, and AI request/retry/fallback counters without storing generated values.

## Architecture and boundaries

The frontend calls only this backend. A bounded in-memory queue runs isolated Playwright browser contexts and persists run metadata plus PNG evidence under `ARTIFACT_DIR`.

`ALLOWED_TARGET_HOSTS` is optional. Leave it empty to accept any public HTTP(S)
form URL, or set a comma-separated list to restrict a deployment. Private and
loopback targets remain blocked unless `ALLOW_PRIVATE_NETWORKS=true`.

The PoC intentionally does not:

- solve or bypass CAPTCHA
- send actual entered values back to the frontend or write them to logs
- require AI for P1/P2; the deterministic local provider remains available
- visit private/internal network targets unless local development explicitly enables them
- submit unless the request explicitly sets `submit: true`

For production, replace the in-memory queue and run map with a durable queue/database, move Playwright workers into an isolated deployment, store artifacts in encrypted object storage, add retention controls, and integrate MLR authentication/authorization.

## Verification

```powershell
npm run check
```

Run the optional real-browser smoke test after installing Chromium:

```powershell
$Env:RUN_BROWSER_TESTS='true'
npm run build
npm test
```
# mlr-form
