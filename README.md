# Demand Site

A demand management application built with React, Vite, and an Express API with PostgreSQL persistence.

## Features

- Role-based login and account creation.
- Demand creation flow that ends after Project Details.
- Hiring Manager / Administrator functional supply completion after creation.
- Manual bulk creation and CSV bulk import.
- Demand detail modal with full record visibility.
- Timestamped comment timeline with edit/delete permissions.
- Backend email notifications to the functional organization and creator.
- PostgreSQL persistence for demands with local cache fallback.
- Local persistence for users, sessions, and drafts.

## Tech Stack

- React 18
- Vite 5
- Express 5
- PostgreSQL
- Nodemailer
- Papa Parse

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local env file:

```bash
cp .env.example .env
```

3. Start PostgreSQL (recommended):

```bash
npm run db:up
```

4. Set values in `.env`.

Required for database persistence:

- `DATABASE_URL=postgres://postgres:postgres@localhost:5432/demand_site`

Optional for managed PostgreSQL with SSL:

- `PGSSL=true`

Optional for email notifications:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `SMTP_SECURE`

Optional per-org recipient emails (demand-created notifications):

- `ORG_EMAIL_ENG_SW`
- `ORG_EMAIL_ENG_SEIT`
- `ORG_EMAIL_PNL`
- `ORG_EMAIL_CIDO`

5. Start the frontend and backend together:

```bash
npm run dev
```

6. Build the frontend:

```bash
npm run build
```

7. Run only the backend API if needed:

```bash
npm run server
```

8. Stop PostgreSQL when done:

```bash
npm run db:down
```

## Quick Deploy (Railway)

Use this when you need a shareable demo URL quickly.

1. Push this repo to GitHub.
2. In Railway, create a new project from this GitHub repo.
3. Add a PostgreSQL service in the same Railway project.
4. In your app service variables, set:

- `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
- `PGSSL=true`

5. Optional email settings (only if you want notifications enabled):

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `SMTP_SECURE`

   Per-org recipient emails for demand-created notifications:

- `ORG_EMAIL_ENG_SW`
- `ORG_EMAIL_ENG_SEIT`
- `ORG_EMAIL_PNL`
- `ORG_EMAIL_CIDO`

6. Deploy. Railway will run the Node app and use `npm run build` + `npm start`.

After deploy:

- App UI is at your Railway URL `/`
- API health is at `/api/health`

## CSV Import

CSV import supports up to 10 rows per upload. Required column:

- `demandId`

Optional columns:

- `demandTitle`
- `programPoc`
- `needDate`
- `project`
- `positionTitle`
- `funcOrg`
- `priority`
- `state`

Rows use the current form values as defaults for any omitted columns.

## Email Notifications

The backend sends:

- One notification email to the routed functional organization mailbox.
- One confirmation email to the user who created the demand.

Functional routing:

- `ENG_SW` -> `foster.chandler.m@gmail.com`
- `ENG_SEIT` -> `foster.chandler.m@gmail.com`

## Project Structure

```text
.
├── server.js
├── index.html
├── package.json
├── src
│   ├── App.jsx
│   ├── data
│   │   └── sampleDemands.js
│   ├── main.jsx
│   ├── styles.css
│   └── utils
│       └── storage.js
└── vite.config.js
```
