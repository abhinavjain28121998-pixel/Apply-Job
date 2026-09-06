const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

// Replace standard generation with a check for AI
content = content.replace(
  /const response = await ai\.models\.generateContent\(\{[\s\S]*?\}\);/g,
  `let response;
      if (ai) {
        response = await ai.models.generateContent({
          model: "gemini-2.5-pro",
          contents: prompt,
          config: { responseMimeType: "application/json", temperature: 0.1 }
        });
      } else {
        // Mock fallback when no API key
        response = { text: "{}" };
      }`
);

// Specifically for generate-cover-letter (no JSON mime type)
content = content.replace(
  /const response = await ai\.models\.generateContent\(\{\s*model: "gemini-2\.5-pro",\s*contents: prompt,\s*config: \{ temperature: 0\.3 \}\s*\}\);/g,
  `let response;
      if (ai) {
        response = await ai.models.generateContent({
          model: "gemini-2.5-pro",
          contents: prompt,
          config: { temperature: 0.3 }
        });
      } else {
        response = { text: "Mock Cover Letter. Set GEMINI_API_KEY to generate real cover letters." };
      }`
);

fs.writeFileSync('server.ts', content);
