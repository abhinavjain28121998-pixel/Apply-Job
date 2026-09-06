# LinkedIn Integration Architecture & Compliance Guide

## Overview

**LinkedIn AI Job Assistant** is an intelligent career assistant designed to help candidates discover matching job opportunities, evaluate alignment against their CV, optimize resumes, craft tailored application materials, and track applications across their lifecycle.

The application adheres strictly to official LinkedIn Developer Platform terms, privacy standards, and API policies.

---

## Core Architectural Separation

The platform establishes a clean separation between four distinct domains:

```
[ Candidate CV / Profile ]
          │
          ▼
[ LinkedIn Job Discovery ] ──► Mode A: Official LinkedIn Search Destination (Default & Compliant)
          │               ──► Mode B: Candidate-Imported / Selected LinkedIn Job Postings
          ▼
[ AI Matching Engine ] ──► 7-Factor Weighted Fit Analysis & Keyword Gap Detection
          │
          ▼
[ Resume Optimization & Workspace ] ──► Tailored Cover Letters & Custom Interview Answers
          │
          ▼
[ Application Tracker ] ──► Pipeline Management (Saved, Applied, Interview, Offer, Rejected)
```

### 1. LinkedIn Job Provider vs. External Search Destination

- **`LinkedInJobProvider` (`server/providers/linkedin.ts`)**:
  - Implements the `JobProvider` and `LinkedInJobProvider` interfaces.
  - Requires only standard LinkedIn OpenID Connect configuration (`LINKEDIN_ENABLED`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI`, `LINKEDIN_SCOPES`).
  - Does NOT require nonexistent or unauthorized job search API or enterprise API credentials.
  - Job discovery is routed cleanly to the official LinkedIn Search Destination URL builder.
  - Zero mock jobs, zero fabricated salaries, and zero invented company data.

- **`LinkedInSearchDestination` (`src/services/linkedinService.ts`)**:
  - Implemented by `buildLinkedInJobsUrl()` and `linkedInDestination`.
  - Builds valid, safely encoded URLs targeting `https://www.linkedin.com/jobs/search/`.
  - Maps user search criteria (keywords, location, work mode, experience level, job type) to official LinkedIn query parameters (`f_WT`, `f_E`, `f_JT`, `sortBy`).
  - Validates generated URLs against trusted LinkedIn hostnames (`www.linkedin.com`, `linkedin.com`).

- **`AI Matching System` (`src/services/jobMatchService.ts`, `/api/analyze-job`)**:
  - Scores candidate fit against real job requirements across 7 weighted dimensions (Core Skills, Tech Stack, Experience, Domain, Seniority, Education, Responsibilities).
  - Generates actionable keyword gaps and resume optimization recommendations.

- **`Application Tracker` (`src/services/applicationService.ts`, `JobTracker.tsx`)**:
  - Tracks application stages, submission notes, follow-up dates, and versions in Firestore with strict per-user data isolation.

---

## Zero-Scraping & Credential Safety Guarantees

1. **No Scraping or Headless Browsers**: Puppeteer, Playwright, Selenium, and server-side HTML scraping of linkedin.com are strictly forbidden and not present in this codebase.
2. **No Credential Access**: The application never solicits, stores, or handles LinkedIn passwords, session cookies (`li_at`), or private session tokens.
3. **No Unofficial Reverse-Engineered Endpoints**: All API interactions use official LinkedIn Developer Platform endpoints or official search URLs.
4. **Data Minimization**: Only candidate-authorized data is accessed or stored.

---

## LinkedIn OAuth 2.0 (OpenID Connect)

The application supports official LinkedIn OAuth 2.0 using the standard OpenID Connect flow:

### Permissions & Scopes
- `openid`: Standard OpenID Connect user identifier (`sub`).
- `profile`: Candidate's public display name and avatar picture.
- `email`: Verified email address associated with the LinkedIn account.

*Legacy scopes (such as `r_basicprofile`, `r_emailaddress`, and `r_jobs`) are deprecated by LinkedIn and are NOT requested.*

### OAuth Security Model
1. **CSRF & Replay Protection**: Each authorization request generates a cryptographically secure random state parameter stored with timestamp expiry and candidate UID binding (`server/oauthState.ts`).
2. **Server-Side Token Exchange**: The authorization code is exchanged for an access token exclusively on the server (`server/routes/linkedin.ts`). The `LINKEDIN_CLIENT_SECRET` is NEVER exposed to the frontend or included in `VITE_` variables.
3. **Safe Popup Communication**: Authentication completes via a secure browser popup that transmits completion status to the parent window via `postMessage` and closes immediately.
4. **Revocation & Disconnection**: Candidates can disconnect their LinkedIn profile at any time with a single click via `POST /api/linkedin/disconnect`.

---

## Supported Search Parameters (URL Destination)

The `buildLinkedInJobsUrl()` builder encodes standard LinkedIn search parameters:

| Criteria | Parameter | Values / Filter Mapping |
| :--- | :--- | :--- |
| Keywords / Job Title | `keywords` | UTF-8 encoded terms (e.g., `Staff React Engineer`) |
| Location | `location` | City / State / Country string (e.g., `San Francisco, CA`) |
| Work Mode | `f_WT` | `1`: On-site, `2`: Remote, `3`: Hybrid |
| Experience Level | `f_E` | `1`: Internship, `2`: Entry level, `3`: Associate, `4`: Mid-Senior, `5`: Director, `6`: Executive |
| Employment Type | `f_JT` | `F`: Full-time, `P`: Part-time, `C`: Contract, `T`: Temporary, `I`: Internship |
| Sort Order | `sortBy` | `DD`: Most Recent, `R`: Most Relevant |

*Note: Filters not supported directly by LinkedIn URLs (e.g., salary min/max, company size) are preserved for internal AI ranking and recommendations rather than appended as invalid URL parameters.*

---

## API Endpoints

- `GET /api/linkedin/status`: Returns provider configuration, connection state, active scopes, and provider mode.
- `GET /api/linkedin/auth/start`: Generates secure CSRF state and returns official LinkedIn authorization URL.
- `GET /api/linkedin/auth/callback`: Server-side authorization code exchange and OpenID Connect profile sync.
- `POST /api/linkedin/disconnect`: Revokes candidate LinkedIn connection and clears stored authorization metadata.
- `POST /api/linkedin/search`: Generates official "Search on LinkedIn" destination URL based on user search parameters.
- `POST /api/linkedin/search-url`: Validates criteria and produces official LinkedIn Jobs search URL with URLSearchParams.
- `GET /api/linkedin/jobs/:id`: Provides direct view link to the official LinkedIn job posting.
