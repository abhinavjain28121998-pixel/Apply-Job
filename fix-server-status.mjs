import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  /      \}\);\n  app\.get\("\/api\/provider\/status", async \(req, res\) => \{\n    try \{\n      const provider = getProvider\(\);\n      const status = await provider\.healthCheck\(\);\n      res\.json\(status\);\n    \} catch \(e\) \{\n      res\.status\(500\)\.json\(\{ error: "Failed to check status" \}\);\n    \}\n  \}\);\n    \} catch \(error\) \{/g,
  `      });
    } catch (error) {`
);

content = content.replace(
  /  app\.post\("\/api\/jobs\/search"/g,
  `  app.get("/api/provider/status", async (req, res) => {
    try {
      const provider = getProvider();
      const status = await provider.healthCheck();
      res.json(status);
    } catch (e) {
      res.status(500).json({ error: "Failed to check status" });
    }
  });

  app.post("/api/jobs/search"`
);

fs.writeFileSync('server.ts', content);
