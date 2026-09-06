# LinkedIn Integration Architecture & Compliance Guide

## Overview

The LinkedIn integration in **Naukri AI Assistant / Apply Job** enables candidates to search for matching job opportunities on LinkedIn and track their applications without violating LinkedIn's Terms of Service or User Agreement.

## Core Architectural Invariants

### 1. Architectural Separation: Providers vs. Destinations

The codebase maintains a clear separation of concerns between internal job providers and external search destinations:

- **`JobProvider` Interface (`src/types.ts`)**:
  - Implemented by `MockJobProvider` and `NaukriJobProvider`.
  - Responsible for structured job searches returning normalized `Job` objects stored and indexed in our application.
  
- **`ExternalJobSearchDestination` Interface (`src/types.ts`)**:
  - Implemented by `linkedInDestination` (`src/services/linkedinService.ts`).
  - Responsible for generating official, pre-filtered LinkedIn Jobs URLs based on candidate filters or CV profile data.
  - Never parses, scrapes, or injects artificial LinkedIn records into the database.

### 2. Zero-Scraping & Credential Safety Guarantee

- **No Browser Automation**: Does not use Puppeteer, Playwright, Selenium, Chromium, headless browsers, or rotating proxies.
- **No Hidden Iframes or Screen Scrapers**: LinkedIn is never loaded in an iframe or fetched server-side.
- **No Credential or Cookie Collection**: The application never asks for or stores LinkedIn passwords, session tokens (`li_at`), or cookies.
- **No Unofficial APIs**: Relies strictly on standard, publicly supported LinkedIn URL search parameters.
- **Domain Verification**: All generated URLs are validated against trusted LinkedIn hostnames (`www.linkedin.com`, `linkedin.com`) using `isValidLinkedInUrl()`.

---

## Supported Search Parameters

The `buildLinkedInJobsUrl()` utility builds safely encoded URLs using standard `URLSearchParams`:

| Criteria | Parameter | Values / Mapping |
| :--- | :--- | :--- |
| Keywords | `keywords` | Safe UTF-8 encoded search string (e.g. `Full Stack Engineer`) |
| Location | `location` | City / State / Country string (e.g. `Bengaluru, India`) |
| Work Mode | `f_WT` | `1`: On-site, `2`: Remote, `3`: Hybrid |
| Experience Level | `f_E` | `1`: Internship, `2`: Entry level, `3`: Associate, `4`: Mid-Senior, `5`: Director, `6`: Executive |
| Job Type | `f_JT` | `F`: Full-time, `P`: Part-time, `C`: Contract, `T`: Temporary, `I`: Internship |
| Sort Order | `sortBy` | `DD`: Most Recent, `R`: Most Relevant |

---

## User Application Workflow

1. **Profile & CV**: Candidate uploads and verifies base CV in Profile.
2. **Search / AI Matching**: Candidate searches internal jobs or requests tailored LinkedIn queries.
3. **LinkedIn Launch**: Candidate clicks **Search on LinkedIn** or **Find on LinkedIn using CV**. The official LinkedIn search opens in a clean new browser tab (`target="_blank" rel="noopener noreferrer"`).
4. **Manual Submission**: The candidate reviews job details and applies directly on LinkedIn.
5. **Tracker Updates**: The candidate returns to Naukri AI Assistant and clicks **Mark as Applied** to maintain their application workspace and timeline.
