import fs from 'fs';
let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

content = content.replace(
  /<p className="text-sm font-medium text-indigo-600">\{job\.match\?\.matchScore\}% Match<\/p>/g,
  `{job.match?.matchScore != null ? <p className="text-sm font-medium text-indigo-600">{job.match.matchScore}% Match</p> : <p className="text-sm font-medium text-slate-400">Not Analyzed</p>}`
);

fs.writeFileSync('src/components/Dashboard.tsx', content);
