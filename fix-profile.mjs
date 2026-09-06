import fs from 'fs';
let content = fs.readFileSync('src/components/ApplicationWorkspace.tsx', 'utf8');

// Remove one of them (line 33)
content = content.replace(
  /const \[readiness, setReadiness\] = useState\(0\);\n  const \[reasons, setReasons\] = useState<string\[\]>\(\[\]\);\n  const \[profile, setProfile\] = useState<any>\(null\);/,
  `const [readiness, setReadiness] = useState(0);\n  const [reasons, setReasons] = useState<string[]>([]);`
);

// We should also replace the inner profile fetches to just use the state profile if it exists, but the user uid profile fetch is fine. Wait, the state `profile` might be shadowed. 
// Let's replace `const profile = await resumeService.getProfile(user.uid);` with nothing if we already have `profile` in state, OR just rename the state one to `userProfile`. Let's rename the state one to `userProfile`.

content = content.replace(/const \[profile, setProfile\] = useState<any>\(null\);/g, `const [userProfile, setUserProfile] = useState<any>(null);`);
content = content.replace(/setProfile\(/g, `setUserProfile(`);
content = content.replace(/profile\)/g, `userProfile)`);
content = content.replace(/profile;/g, `userProfile;`);
content = content.replace(/, profile/g, `, userProfile`);
// Let's be careful. Let's just do it manually.

fs.writeFileSync('src/components/ApplicationWorkspace.tsx', content);
