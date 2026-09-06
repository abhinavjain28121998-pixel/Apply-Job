import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { getProvider, deduplicateJobs } from './server/providers.js';
import { requireAuth, isDemoAuthAllowed, getDemoAuthToken } from './server/auth.js';
import { rateLimit } from './server/rateLimit.js';
import { generateWithGeminiCascade, parseGeminiJson, isGeminiAvailable } from './server/geminiService.js';
import { linkedinRouter } from './server/routes/linkedin.js';
import { buildLinkedInJobsUrl } from './src/services/linkedinService.js';
import './server/types.js';

export function createApiApp() {
  const app = express();

  app.use(express.json({ limit: '15mb' }));

  // LinkedIn Integration Routes
  app.use('/api/linkedin', linkedinRouter);

  // Check Gemini API key
  const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Jobs Provider Routes
  app.get("/api/provider/status", async (req, res) => {
    try {
      const providerParam = req.query.provider as string | undefined;
      const provider = getProvider(providerParam);
      const status = await provider.healthCheck();
      res.json(status);
    } catch (e) {
      res.status(500).json({ error: "Failed to check status" });
    }
  });

  app.post("/api/jobs/search", async (req, res) => {
    try {
      const provider = getProvider();
      const status = await provider.healthCheck();
      
      const rawJobs = await provider.searchJobs(req.body);
      const normalizedJobs = rawJobs.map(job => provider.normalizeJob(job));
      
      const { unique, duplicates } = deduplicateJobs(normalizedJobs);

      // Pagination slice
      const page = req.body.page || 1;
      const limit = req.body.limit || 20;
      const start = (page - 1) * limit;
      const paginatedJobs = unique.slice(start, start + limit);
      const hasMore = start + limit < unique.length;

      const searchUrl = buildLinkedInJobsUrl({
        keywords: [req.body.jobTitle, req.body.keywords, req.body.query].filter(Boolean).join(' '),
        location: req.body.location,
        workMode: req.body.workMode,
        experience: req.body.experienceLevel || req.body.experience,
        jobType: req.body.employmentType || req.body.jobType
      });

      res.json({
        jobs: paginatedJobs,
        status,
        hasMore,
        searchUrl,
        mode: (status.status === 'CONNECTED' && paginatedJobs.length > 0) ? 'API' : 'EXTERNAL_SEARCH',
        diagnostics: {
          totalReturned: rawJobs.length,
          normalized: normalizedJobs.length,
          deduplicated: unique.length,
          duplicatesRemoved: duplicates
        }
      });
    } catch (error) {
      console.error('Job search error:', error);
      res.status(500).json({ error: "Failed to search jobs" });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const provider = getProvider();
      const rawJob = await provider.getJobDetails(req.params.id);
      res.json(provider.normalizeJob(rawJob));
    } catch (error) {
      console.error('Job details error:', error);
      res.status(404).json({ error: "Job not found or provider error" });
    }
  });

  // Helper to extract text from PDF
  async function extractPdfText(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText({ pageJoiner: '\n\n' });
      return result?.text ? result.text.trim() : '';
    } finally {
      try {
        await parser.destroy();
      } catch {}
    }
  }

  // Helper to extract text from DOCX
  async function extractDocxText(buffer: Buffer): Promise<string> {
    const mammothLib: any = mammoth;
    const extractFn = mammothLib.extractRawText || mammothLib.default?.extractRawText;
    if (!extractFn) {
      throw new Error("DOCX parser not available");
    }
    const result = await extractFn({ buffer });
    return result?.value ? result.value.trim() : '';
  }

  // Helper to extract text from legacy MS Word .doc binary files (OLE2 / CFBF format)
  function extractLegacyDocText(buffer: Buffer): string {
    // 1. Try extracting UTF-16LE text sequences (standard in Word 97-2004 binary docs)
    const utf16Matches: string[] = [];
    let currentUtf16: string[] = [];
    for (let i = 0; i < buffer.length - 1; i += 2) {
      const low = buffer[i];
      const high = buffer[i + 1];
      if (high === 0 && ((low >= 0x20 && low <= 0x7E) || low === 0x0A || low === 0x0D || low === 0x09)) {
        currentUtf16.push(String.fromCharCode(low));
      } else {
        if (currentUtf16.length >= 4) {
          utf16Matches.push(currentUtf16.join(''));
        }
        currentUtf16 = [];
      }
    }
    if (currentUtf16.length >= 4) {
      utf16Matches.push(currentUtf16.join(''));
    }

    // 2. Try extracting 8-bit ASCII sequences
    const asciiMatches: string[] = [];
    let currentAscii: string[] = [];
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      if ((byte >= 0x20 && byte <= 0x7E) || byte === 0x0A || byte === 0x0D || byte === 0x09) {
        currentAscii.push(String.fromCharCode(byte));
      } else {
        if (currentAscii.length >= 4) {
          asciiMatches.push(currentAscii.join(''));
        }
        currentAscii = [];
      }
    }
    if (currentAscii.length >= 4) {
      asciiMatches.push(currentAscii.join(''));
    }

    const oleWords = new Set([
      'Root Entry', 'WordDocument', 'SummaryInformation', 'DocumentSummaryInformation',
      'Table', 'Data', 'CompObj', 'ObjectPool', 'Microsoft Word Document'
    ]);

    const cleanUtf16 = utf16Matches.filter(t => !oleWords.has(t.trim()) && t.trim().length > 3);
    const cleanAscii = asciiMatches.filter(t => !oleWords.has(t.trim()) && t.trim().length > 3);

    const utf16Words = cleanUtf16.join(' ').split(/\s+/).filter(w => w.length > 2);
    const asciiWords = cleanAscii.join(' ').split(/\s+/).filter(w => w.length > 2);

    const chosen = utf16Words.length > asciiWords.length ? cleanUtf16 : cleanAscii;
    return chosen.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // Upload and parse CV file (PDF, DOCX, DOC, TXT, MD)
  app.post("/api/upload-cv", requireAuth, rateLimit, async (req, res) => {
    try {
      const { filename, mimeType, base64Data, autoExtract } = req.body;
      if (!base64Data || typeof base64Data !== 'string') {
        return res.status(400).json({ error: "Missing or invalid base64Data in request" });
      }

      // Strip data URI scheme prefix if included (e.g. data:application/pdf;base64,...)
      const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      const buffer = Buffer.from(cleanBase64, 'base64');

      if (buffer.length === 0) {
        return res.status(400).json({ error: "Uploaded file is empty" });
      }

      if (buffer.length > 10 * 1024 * 1024) {
        return res.status(400).json({ error: "File exceeds 10MB size limit" });
      }

      const safeFilename = typeof filename === 'string' ? filename : 'uploaded_cv';
      const ext = safeFilename.toLowerCase().split('.').pop() || '';
      let extractedText = '';
      let parseMethod = 'unknown';

      const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4B; // PK magic bytes (docx)
      const isOle = buffer.length > 4 && buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0; // OLE2 (doc)

      // 1. Determine format and parse
      if (ext === 'pdf' || mimeType === 'application/pdf') {
        try {
          extractedText = await extractPdfText(buffer);
          parseMethod = 'pdf';
        } catch (pdfErr) {
          console.warn('PDF parsing error, attempting text fallback:', pdfErr);
        }
      } else if (ext === 'docx' || (isZip && mimeType?.includes('wordprocessingml'))) {
        try {
          extractedText = await extractDocxText(buffer);
          parseMethod = 'docx';
        } catch (docxErr) {
          console.warn('DOCX parsing error, attempting text fallback:', docxErr);
        }
      } else if (ext === 'doc' || isOle || mimeType === 'application/msword') {
        try {
          if (isZip) {
            extractedText = await extractDocxText(buffer);
            parseMethod = 'docx';
          } else {
            extractedText = extractLegacyDocText(buffer);
            parseMethod = 'doc';
          }
        } catch (docErr) {
          console.warn('DOC parsing error, attempting text fallback:', docErr);
        }
      } else if (ext === 'txt' || ext === 'md' || ext === 'rtf' || mimeType?.startsWith('text/')) {
        extractedText = buffer.toString('utf-8').trim();
        parseMethod = 'text';
      }

      // 2. Resilience fallbacks if format was not recognized or initial method failed
      if (!extractedText && isZip) {
        try {
          extractedText = await extractDocxText(buffer);
          if (extractedText) parseMethod = 'docx';
        } catch {}
      }

      if (!extractedText && isOle) {
        try {
          extractedText = extractLegacyDocText(buffer);
          if (extractedText) parseMethod = 'doc';
        } catch {}
      }

      if (!extractedText) {
        // Try PDF
        try {
          extractedText = await extractPdfText(buffer);
          if (extractedText) parseMethod = 'pdf';
        } catch {}
      }

      if (!extractedText) {
        // Try UTF-8 string
        const utf8 = buffer.toString('utf-8').trim();
        if (utf8 && !/[\x00-\x08\x0E-\x1F]/.test(utf8.slice(0, 200))) {
          extractedText = utf8;
          parseMethod = 'text';
        }
      }

      if (!extractedText || extractedText.trim().length === 0) {
        return res.status(422).json({
          error: "No readable text could be extracted from this document. If your file is a scanned image, please copy and paste your CV text directly."
        });
      }

      const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
      const characterCount = extractedText.length;

      let extractedProfile: any = null;
      if (autoExtract === true) {
        const prompt = `You are an expert technical recruiter. Parse the provided CV text into a structured JSON profile.
Extract the following fields accurately. If a field is not present, omit it or leave it empty.
Schema:
{
  "summary": "string",
  "totalExperience": number,
  "currentRole": "string",
  "skills": ["array of strings"],
  "tools": ["array of strings"],
  "industries": ["array of strings"],
  "education": ["array of strings"],
  "certifications": ["array of strings"],
  "achievements": ["array of strings"],
  "preferredLocations": ["array of strings"],
  "workMode": "string",
  "expectedSalary": "string"
}

CV Text:
${extractedText}`;

        if (isGeminiAvailable()) {
          try {
            const raw = await generateWithGeminiCascade({
              prompt,
              responseMimeType: "application/json",
              temperature: 0.1
            });
            extractedProfile = parseGeminiJson(raw, null);
          } catch (e) {
            console.warn("Auto-extract profile failed during CV upload:", e);
          }
        }
      }

      res.json({
        ok: true,
        text: extractedText,
        filename: safeFilename,
        fileSize: buffer.length,
        parseMethod,
        wordCount,
        characterCount,
        extractedProfile
      });
    } catch (error: any) {
      console.error('CV upload error:', error);
      res.status(500).json({ error: error?.message || "Internal server error while processing CV upload" });
    }
  });

  // Extract structured profile
  app.post("/api/extract-profile", requireAuth, rateLimit, async (req, res) => {
    try {
      const { baseCv } = req.body;
      if (!baseCv || typeof baseCv !== 'string' || !baseCv.trim()) {
        return res.status(400).json({ error: "Missing or invalid baseCv in request body" });
      }

      const prompt = `You are an expert technical recruiter. Parse the provided CV text into a structured JSON profile.
Extract the following fields accurately. If a field is not present, omit it or leave it empty.
Schema:
{
  "summary": "string",
  "totalExperience": number,
  "currentRole": "string",
  "skills": ["array of strings"],
  "tools": ["array of strings"],
  "industries": ["array of strings"],
  "education": ["array of strings"],
  "certifications": ["array of strings"],
  "achievements": ["array of strings"],
  "preferredLocations": ["array of strings"],
  "workMode": "string",
  "expectedSalary": "string"
}

CV Text:
${baseCv}`;

      let parsed: any = {};
      if (isGeminiAvailable()) {
        const raw = await generateWithGeminiCascade({
          prompt,
          responseMimeType: "application/json",
          temperature: 0.1
        });
        parsed = parseGeminiJson(raw, null);

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return res.status(500).json({ error: "Invalid profile structure returned by AI" });
        }
      } else {
        parsed = {
          summary: "Demo Profile Extracted",
          skills: ["Demo Skill 1", "Demo Skill 2"]
        };
      }
      res.json(parsed);
    } catch (error: any) {
      console.error('Extract profile error:', error);
      res.status(500).json({ error: error?.message || "Failed to extract profile from CV" });
    }
  });

  // Analyze job
  app.post("/api/analyze-job", requireAuth, rateLimit, async (req, res) => {
    try {
      const { jobDescription, baseCv } = req.body;
      if (!jobDescription || typeof jobDescription !== 'string' || !jobDescription.trim() ||
          !baseCv || typeof baseCv !== 'string' || !baseCv.trim()) {
        return res.status(400).json({ error: "Missing or invalid jobDescription or baseCv" });
      }

      const { MatchingService } = await import('./src/services/matchingService.js');
      const matchingService = new MatchingService();
      const analysis = await matchingService.evaluateMatch(jobDescription, baseCv);
      
      if (!analysis || typeof analysis !== 'object') {
        return res.status(500).json({ error: "Failed to generate valid analysis" });
      }

      res.json(analysis);
    } catch (error: any) {
      console.error('Analyze job error:', error);
      res.status(500).json({ error: error?.message || "Analysis failed" });
    }
  });

  // Tailor application
  app.post("/api/tailor-application", requireAuth, rateLimit, async (req, res) => {
    try {
      const { jobDescription, baseCv, company, title } = req.body;

      if (!jobDescription || typeof jobDescription !== 'string' || !jobDescription.trim() ||
          !baseCv || typeof baseCv !== 'string' || !baseCv.trim()) {
        return res.status(400).json({ error: "Missing or invalid inputs (jobDescription and baseCv are required)" });
      }

      const prompt = `You are an expert career coach helping a candidate apply for a job.
You need to tailor their CV and write a personalized cover letter based on their actual experience.

CRITICAL INSTRUCTION: You MUST NEVER invent qualifications, experience, skills, companies, achievements, or certifications. Rely EXCLUSIVELY on the provided CV. 
Do not exaggerate. Only highlight and restructure the existing truthful information to better match the job description.

Job Title: ${title || 'Not specified'}
Company: ${company || 'Not specified'}

Job Description:
${jobDescription}

My Base CV:
${baseCv}

Return a JSON object with this schema:
{
  "updatedSummary": "string (The newly suggested professional summary for the tailored CV)",
  "emphasizedSkills": ["array of existing skills from CV that are highly relevant to this job"],
  "bulletImprovements": [
    { 
      "original": "string (the original bullet from the CV)", 
      "suggested": "string (the improved, tailored bullet using ONLY truthful data from CV)", 
      "reason": "string (why this change helps for this specific job)",
      "keywordTarget": "string (the job keyword being targeted by this change)"
    }
  ],
  "matchedKeywords": ["array of exact keywords from the job description that truthfully match the CV"],
  "unchangedSections": ["array of sections (e.g. Education, Hobbies) that remain exactly as in the original CV"],
  "tailoredCv": "string (Markdown format) representing the complete tailored CV based ONLY on my real experience",
  "coverLetter": "string (Markdown format) representing a personalized cover letter. Keep it concise, compelling, and truthful."
}`;

      let parsed: any = {};
      if (isGeminiAvailable()) {
        const raw = await generateWithGeminiCascade({
          prompt,
          responseMimeType: "application/json",
          temperature: 0.3
        });
        parsed = parseGeminiJson(raw, null);

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return res.status(500).json({ error: "Invalid tailored application structure returned by AI" });
        }
      } else {
         parsed = {
          updatedSummary: "[Demo Mode] Mock updated summary...",
          emphasizedSkills: ["React"],
          bulletImprovements: [],
          matchedKeywords: [],
          unchangedSections: [],
          tailoredCv: "# Tailored CV\n[Demo Mode] Tailoring preview",
          coverLetter: "Dear Hiring Manager,\n\n[Demo Mode] Mock Cover Letter."
        };
      }

      res.json(parsed);
    } catch (error: any) {
      console.error('Tailor application error:', error);
      res.status(500).json({ error: error?.message || "Failed to tailor application" });
    }
  });

  // Generate Cover Letter
  app.post("/api/generate-cover-letter", requireAuth, rateLimit, async (req, res) => {
    try {
      const { jobDescription, baseCv, company, title } = req.body;
      if (!jobDescription || typeof jobDescription !== 'string' || !jobDescription.trim() ||
          !baseCv || typeof baseCv !== 'string' || !baseCv.trim()) {
        return res.status(400).json({ error: "Missing or invalid inputs (jobDescription and baseCv are required)" });
      }
      const prompt = `You are an expert career coach writing a concise, job-specific cover letter.
CRITICAL INSTRUCTION: You MUST NEVER invent qualifications, experience, skills, companies, achievements, or certifications. Rely EXCLUSIVELY on the provided CV.
Job Title: ${title || 'Not specified'}
Company: ${company || 'Not specified'}

Job Description:
${jobDescription}

My Base CV:
${baseCv}

Write a professional, compelling, and truthful cover letter in Markdown format. Return ONLY the markdown text, no JSON.`;
      if (isGeminiAvailable()) {
        const text = await generateWithGeminiCascade({
          prompt,
          temperature: 0.3
        });
        res.send(text || "");
      } else {
        res.send("[Demo Mode] Mock cover letter for " + company);
      }
    } catch (error: any) {
      console.error('Generate cover letter error:', error);
      res.status(500).json({ error: error?.message || "Failed to generate cover letter" });
    }
  });

  // Generate Answers
  app.post("/api/generate-answers", requireAuth, rateLimit, async (req, res) => {
    try {
      const { jobDescription, baseCv, company, title } = req.body;
      if (!jobDescription || typeof jobDescription !== 'string' || !jobDescription.trim() ||
          !baseCv || typeof baseCv !== 'string' || !baseCv.trim()) {
        return res.status(400).json({ error: "Missing or invalid inputs (jobDescription and baseCv are required)" });
      }
      const prompt = `You are assisting a candidate with their job application. Generate answers for common application questions based strictly on the provided CV and job description.
CRITICAL: NEVER invent experience, projects, employers, skills, achievements, salary information, or qualifications. If the CV lacks information (like current/expected salary or notice period), state a placeholder or say 'Not specified in profile, please update manually'.

Job Title: ${title || 'Not specified'}
Company: ${company || 'Not specified'}
Job Description:
${jobDescription}
My CV:
${baseCv}

Return a JSON object where keys are standard question identifiers and values are the generated text:
{
  "tellUsAboutYourself": "string",
  "whyThisRole": "string",
  "whyThisCompany": "string",
  "whatMakesYouFit": "string",
  "relevantExperience": "string",
  "noticePeriod": "string (Infer or placeholder)",
  "currentCompensation": "string (Infer or placeholder)",
  "expectedCompensation": "string (Infer or placeholder)",
  "locationPreference": "string (Infer or placeholder)"
}`;
      let parsed: any = {};
      if (isGeminiAvailable()) {
        const raw = await generateWithGeminiCascade({
          prompt,
          responseMimeType: "application/json",
          temperature: 0.2
        });
        parsed = parseGeminiJson(raw, null);

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return res.status(500).json({ error: "Invalid answers structure returned by AI" });
        }
      } else {
        parsed = {
          tellUsAboutYourself: "[Demo Mode] Mock answer",
          whyThisRole: "[Demo Mode] Mock answer",
        };
      }
      res.json(parsed);
    } catch (error: any) {
      console.error('Generate answers error:', error);
      res.status(500).json({ error: error?.message || "Failed to generate answers" });
    }
  });

  // Expose demo auth config for client authentication when ALLOW_DEMO_AUTH=true
  app.get("/api/auth/demo-token", (req, res) => {
    if (isDemoAuthAllowed()) {
      res.json({ token: getDemoAuthToken(), allowed: true });
    } else {
      res.status(403).json({ error: "Demo authentication is disabled", allowed: false });
    }
  });

  // 404 handler for all unmatched API routes - guarantees JSON response instead of HTML SPA fallback
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
  });

  // Global error handler for API routes - guarantees JSON response
  app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('API Error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

export async function startServer() {
  const app = createApiApp();
  const PORT = 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  startServer();
}
