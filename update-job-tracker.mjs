import fs from 'fs';
let content = fs.readFileSync('src/components/JobTracker.tsx', 'utf8');

// Replace seedSampleData
content = content.replace(
  /const seedSampleData = async \(\) => \{[\s\S]*?fetchJobs\(\);\n    \} catch \(err\) \{/g,
  `const seedSampleData = async () => {
    alert("Please go to Find Jobs to search and save realistic jobs. They will automatically be analyzed against your profile.");
  }
  
  try {`
);

// Fix matchScore display
content = content.replace(
  /<div className="flex items-center gap-2">\s*<div className="w-full bg-slate-200 rounded-full h-2 max-w-\[100px\]">[\s\S]*?<span className="text-sm font-medium">\{job\.matchScore \|\| 0\}%<\/span>\s*<\/div>/g,
  `<div className="flex items-center gap-2">
                      {job.matchScore !== undefined ? (
                        <>
                          <div className="w-full bg-slate-200 rounded-full h-2 max-w-[100px]">
                            <div 
                               className={\`h-2 rounded-full \${job.matchScore >= 80 ? 'bg-green-500' : job.matchScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}\`} 
                               style={{ width: \`\${job.matchScore}%\` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{job.matchScore}%</span>
                        </>
                      ) : (
                        <span className="text-sm font-medium text-slate-400">Not Analyzed</span>
                      )}
                    </div>`
);

fs.writeFileSync('src/components/JobTracker.tsx', content);
