import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';
import { getProvider, deduplicateJobs } from './server/providers.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  // Check Gemini API key
  const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

  
  // Basic authentication middleware
  const requireAuth = (req, res, next) => {
    // In demo mode, we might want to bypass or allow any token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Unauthorized. Missing or invalid Authorization header." });
    }
    next();
  };

  // Basic rate limiting middleware
  const rateLimitMap = new Map();
  const rateLimit = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const userLimits = rateLimitMap.get(ip) || [];
    
    // Clean up old requests (older than 1 minute)
    const recentRequests = userLimits.filter(time => now - time < 60000);
    
    if (recentRequests.length >= 10) { // 10 requests per minute
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }
    
    recentRequests.push(now);
    rateLimitMap.set(ip, recentRequests);
    next();
  };

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Jobs Provider Routes
  app.get("/api/provider/status", async (req, res) => {
    try {
      const provider = getProvider();
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

      res.json({
        jobs: paginatedJobs,
        status,
        hasMore,
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
      if (ai) {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: { responseMimeType: "application/json", temperature: 0.1 }
        });
        try {
          parsed = JSON.parse(response.text || "{}");
        } catch (e) {
          console.error("Failed to parse Gemini response for profile extraction", e);
          return res.status(500).json({ error: "Failed to parse structured profile from AI response" });
        }

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
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
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
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Analysis failed" });
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
      if (ai) {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.3
          }
        });
        try {
          const text = response.text || "{}";
          parsed = JSON.parse(text);
        } catch (e) {
          console.error("Failed to parse Gemini response for tailor-application", e);
          return res.status(500).json({ error: "Failed to parse tailored output from AI response" });
        }

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
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
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
      if (ai) {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: { temperature: 0.3 }
        });
        res.send(response.text || "");
      } else {
        res.send("[Demo Mode] Mock cover letter for " + company);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
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
      if (ai) {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: { responseMimeType: "application/json", temperature: 0.2 }
        });
        try {
          parsed = JSON.parse(response.text || "{}");
        } catch (e) {
          console.error("Failed to parse Gemini response for answers", e);
          return res.status(500).json({ error: "Failed to parse structured answers from AI response" });
        }

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
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

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

startServer();
