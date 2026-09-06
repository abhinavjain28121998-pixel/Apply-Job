import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

if (!content.includes('/api/provider/status')) {
  content = content.replace(
    /app\.post\("\/api\/jobs\/search"[\s\S]*?\}\);/g,
    `$&
  app.get("/api/provider/status", async (req, res) => {
    try {
      const provider = getProvider();
      const status = await provider.healthCheck();
      res.json(status);
    } catch (e) {
      res.status(500).json({ error: "Failed to check status" });
    }
  });`
  );
  fs.writeFileSync('server.ts', content);
}
