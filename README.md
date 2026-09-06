# LinkedIn AI Job Assistant

A production-ready LinkedIn AI job application assistant that helps candidates discover matching job opportunities, evaluate profile fit, optimize resumes, craft tailored cover letters and interview answers, and track applications across their lifecycle.

---

## Features

- **Resume Parsing & Profile Extraction**: AI extraction of core skills, tools, industries, work history, and achievements.
- **LinkedIn Job Discovery (Compliant Mode)**: Direct job discovery powered by the official LinkedIn Jobs Search Destination builder (`https://www.linkedin.com/jobs/search/`) using safely encoded query parameters via `URLSearchParams`.
- **7-Factor AI Fit Analysis**: Weighted evaluation across Core Skills, Tech Stack, Experience Depth, Industry Domain, Seniority, Education, and Responsibilities.
- **AI Resume Tailoring**: Instant resume bullet alignment and custom cover letter generation based on real job requirements.
- **Application Tracker**: Full pipeline management (Saved, Applied, Interviewing, Offer, Rejected) with secure user isolation.
- **LinkedIn OpenID Connect (Optional)**: Verified candidate profile sign-in using official OAuth 2.0 with standard OpenID Connect scopes.

---

## Configuration & Environment Variables

The LinkedIn integration requires **ONLY** the minimum configuration necessary for features that are actually implemented.

### Genuine LinkedIn Configuration Variables

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `LINKEDIN_ENABLED` | Yes | `true` | Enables or disables the LinkedIn OAuth integration (`true`/`false`). |
| `LINKEDIN_CLIENT_ID` | When `LINKEDIN_ENABLED=true` | — | Client ID from your LinkedIn Developer application. |
| `LINKEDIN_CLIENT_SECRET` | When `LINKEDIN_ENABLED=true` | — | Client Secret from your LinkedIn Developer application (server-side only; never exposed to browser). |
| `LINKEDIN_REDIRECT_URI` | No | `https://apply-jobs-brown.vercel.app/api/linkedin/auth/callback` | Exact OAuth callback URL registered in the LinkedIn Developer Portal. |
| `LINKEDIN_SCOPES` | No | `openid profile email` | Standard OpenID Connect permissions. Outdated or deprecated scopes are never requested. |

> **Note**: The application does **NOT** require `LINKEDIN_JOB_SEARCH_API` or `LINKEDIN_ENTERPRISE_API_...` credentials. LinkedIn job discovery operates through the official "Search on LinkedIn" destination URL builder.

### General App Configuration

| Variable | Required | Description |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for server-side AI resume tailoring and job matching. |
| `JOB_PROVIDER` | No | Default `linkedin`. |
| `ALLOW_DEMO_AUTH` | No | Local/demo testing flag (`false` by default in production). |

---

## Fallback Mode: Zero API Approval Required

The application is fully functional **without** LinkedIn API job-search approval:

1. **Upload Resume** → Extract profile details via AI.
2. **Set Job Preferences** → Select job title, location, work mode, and experience.
3. **Generate Search** → Generates an official LinkedIn Jobs search URL with `URLSearchParams`.
4. **Search on LinkedIn** → Click to browse matching live postings on LinkedIn.
5. **Return to Application** → Import job posting details.
6. **Tailor Resume & Analyze Fit** → Review 7-factor match score and generate targeted resume bullets.
7. **Track Application** → Manage pipeline status in your personal tracker.

This is a first-class supported workflow, not an error state.

---

## LinkedIn Compliance & Security Standards

1. **No Scraping**: No Puppeteer, Playwright, Selenium, or server-side HTML scraping.
2. **No Credential Harvesting**: Never asks for or stores LinkedIn passwords, session cookies (`li_at`), or private session tokens.
3. **OpenID Connect**: Uses standard `openid`, `profile`, and `email` scopes.
4. **CSRF Protection**: Cryptographically secure, single-use state tokens for OAuth flows.
5. **Secret Isolation**: `LINKEDIN_CLIENT_SECRET` is used exclusively on the server and is never exposed in client bundles.
