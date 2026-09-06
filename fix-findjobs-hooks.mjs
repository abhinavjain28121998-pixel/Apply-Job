import fs from 'fs';
let content = fs.readFileSync('src/components/FindJobs.tsx', 'utf8');

content = content.replace(
  /  useEffect\(\) => \{\n    if \(!user\) return;\n      const \[savedJobs, setSavedJobs\] = useState<Map<string, Partial<Job>>>\(new Map\(\)\);\n\n  useEffect\(\) => \{/g,
  `  const [savedJobs, setSavedJobs] = useState<Map<string, Partial<Job>>>(new Map());\n\n  useEffect(() => {`
);

fs.writeFileSync('src/components/FindJobs.tsx', content);
