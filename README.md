# MLR Form Screenshot PoC

An asynchronous backend and small browser UI for approved form automation. Playwright performs the browser work, with selectable local, OpenAI, Claude, or Gemini test-data generation.

## Capabilities

- P1: load, extract, fill, optionally submit, and capture screenshots
- P2: detect next/continue controls, repeat extraction and filling across multi-step forms, and capture the final confirmation
- P3: detect reCAPTCHA, hCaptcha, and Turnstile; capture evidence and safely skip submission when a visible challenge requires a person
- P4: validate thank-you pages, inline success messages, configured selectors/text, and redirects after submission
- P5: generate schema-constrained data with OpenAI, Claude, or Gemini; validate every value and retry once before using the local fallback

## Quick start

Requirement: Node.js 20 or newer. No AI API key is needed when using the default local generator.

```powershell
npm install
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

Open `http://127.0.0.1:3000`.

For the Linzess savings-card example, enter `https://www.linzess.com/savings-card`
and choose either `Savings Card — New` or `Savings Card — Existing`. Leave
`Submit final form` unchecked when you only want filled screenshots without a
live enrollment submission.

For the included local two-step demo form, use this development-only configuration:

```dotenv
ALLOWED_TARGET_HOSTS=127.0.0.1
ALLOW_PRIVATE_NETWORKS=true
```

Then enter `http://127.0.0.1:3000/demo-form.html` in the UI. Never enable private-network access in a shared or production deployment.

## API

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
npm test
```
# mlr-form
