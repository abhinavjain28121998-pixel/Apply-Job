import fs from 'fs';
let content = fs.readFileSync('src/components/FindJobs.tsx', 'utf8');

// Replace the null fallback with a manual analyze button
content = content.replace(
  /\) : null\}\s*<\/div>/g,
  `) : (
                    <button 
                      onClick={() => analyzeJobsSequentially([job])}
                      className="flex items-center gap-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      Analyze Fit
                    </button>
                  )}
                </div>`
);

fs.writeFileSync('src/components/FindJobs.tsx', content);
