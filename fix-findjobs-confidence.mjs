import fs from 'fs';
let content = fs.readFileSync('src/components/FindJobs.tsx', 'utf8');

content = content.replace(
  /\{match\?\.matchScore \!= null \? \(\n\s*<div className="flex flex-col items-end">/,
  `{match ? (
                     <div className="flex flex-col items-end">`
);

content = content.replace(
  /<div className=\{\`text-2xl font-bold \$\{match\?\.matchScore >= 80 \? 'text-green-600' : match\?\.matchScore >= 50 \? 'text-amber-500' : 'text-red-500'\}\`\}>\n\s*\{match\?\.matchScore\}%\n\s*<\/div>/,
  `{match.matchScore != null ? (
                           <div className={\`text-2xl font-bold \${match.matchScore >= 80 ? 'text-green-600' : match.matchScore >= 50 ? 'text-amber-500' : 'text-red-500'}\`}>
                             {match.matchScore}%
                           </div>
                         ) : (
                           <div className="text-sm font-medium text-slate-500">Analysis Unavailable</div>
                         )}`
);

content = content.replace(
  /<span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Match Score<\/span>\n\s*<\/div>\n\s*<\/div>\n\s*\) : /,
  `<span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                           {match.matchScore != null ? \`\${match.confidenceLevel || 'HIGH'} Confidence\` : 'Status'}
                         </span>
                       </div>
                     </div>
                   ) : `
);

fs.writeFileSync('src/components/FindJobs.tsx', content);
