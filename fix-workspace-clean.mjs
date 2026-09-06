import fs from 'fs';

let content = fs.readFileSync('src/components/ApplicationWorkspace.tsx', 'utf8');

// Remove ALL `const [profile, setProfile] = useState<any>(null);`
content = content.replace(/const \[profile, setProfile\] = useState<any>\(null\);/g, '');
content = content.replace(/const \[loading, setLoading\] = useState\(true\);/g, 'const [profile, setProfile] = useState<any>(null);\n  const [loading, setLoading] = useState(true);');

// Remove ALL `useEffect` for fetching profile separately
content = content.replace(/useEffect\(\(\) => \{\s*if \(user\) \{\s*resumeService\.getProfile\(user\.uid\)\.then\(setProfile\)\.catch\(console\.error\);\s*\}\s*\}, \[user\]\);/g, '');

fs.writeFileSync('src/components/ApplicationWorkspace.tsx', content);
