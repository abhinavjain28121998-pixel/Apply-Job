import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

// replace the matching logic inside /api/analyze-job
content = content.replace(
  /app\.post\("\/api\/analyze-job"[\s\S]*?res\.json\(parsed\);\n    \} catch \(error\) \{[\s\S]*?\}\n  \}\);/g,
  `app.post("/api/analyze-job", async (req, res) => {
    try {
      const { jobDescription, baseCv } = req.body;
      if (!jobDescription || !baseCv) {
        return res.status(400).json({ error: "Missing jobDescription or baseCv" });
      }

      const { MatchingService } = await import('./src/services/matchingService.js');
      const matchingService = new MatchingService();
      const analysis = await matchingService.evaluateMatch(jobDescription, baseCv);
      
      res.json(analysis);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Analysis failed" });
    }
  });`
);

fs.writeFileSync('server.ts', content);
