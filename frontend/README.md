# MLR form UI

Standalone React + TypeScript application using Vite. The Fastify API remains in
the repository's `src/` directory.

## Run locally

Start the backend from the repository root with `npm run dev:api`. Then, in this
directory:

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Alternatively, `npm run dev` from the repository root
starts both applications.

The development proxy defaults to http://127.0.0.1:3000. Copy `.env.example` to
`.env` and change `API_PROXY_TARGET` if needed. Keep AI credentials in the backend
configuration. An API bearer token, when required, is entered through the UI.

## Workflow

1. Enter the target URL. Excel for each page is selected by default.
2. Start the run and download the workbook for the current page.
3. Fill its Value cells and upload it to continue.
4. Repeat for each new page. Validation errors keep the current step open.

Automatic mode uses the backend's configured generator, with an optional initial
Excel file. Screenshots and the final PDF appear with the run status.

## Build

```powershell
npm run build
```

This type-checks the app and builds `dist/`. The repository backend serves this
directory in production. `npm run preview` starts a local build preview on port
4173 and proxies API requests to the same backend.
