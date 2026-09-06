import fs from 'fs';
let content = fs.readFileSync('src/components/FindJobs.tsx', 'utf8');

// Remove matchesMap
content = content.replace(/const \[matchesMap, setMatchesMap\] = useState<Map<string, any>>\(new Map\(\)\);\n/g, '');
// Consolidate matches
content = content.replace(/const \[matches, setMatches\] = useState<Map<string, any>>\(new Map\(\)\);/g, 'const [matches, setMatches] = useState<Map<string, import("../types").JobMatch>>(new Map());');

// Replace usages of matchesMap with matches
content = content.replace(/setMatchesMap/g, 'setMatches');
content = content.replace(/matchesMap/g, 'matches');

fs.writeFileSync('src/components/FindJobs.tsx', content);
