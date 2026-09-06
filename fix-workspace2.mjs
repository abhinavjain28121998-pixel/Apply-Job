import fs from 'fs';
let content = fs.readFileSync('src/components/ApplicationWorkspace.tsx', 'utf8');

// Define tailoredCv
content = content.replace(
  /const \[coverLetter, setCoverLetter\] = useState\(''\);/,
  `const [coverLetter, setCoverLetter] = useState('');\n  const [tailoredCv, setTailoredCv] = useState('');`
);

// Fix Partial<Job> -> Partial<Application>
content = content.replace(
  /const updates: Partial<Job> = \{/g,
  `const updates: Partial<Application> = {`
);

fs.writeFileSync('src/components/ApplicationWorkspace.tsx', content);
