import fs from 'fs';

function replaceGetIdToken(filename) {
  let content = fs.readFileSync(filename, 'utf8');
  content = content.replace(/const \{ user \} = useAuth\(\);/g, 'const { user, getToken } = useAuth();');
  content = content.replace(/await user\.getIdToken\(\)/g, 'await getToken()');
  fs.writeFileSync(filename, content);
}

replaceGetIdToken('src/components/ProfileSettings.tsx');
replaceGetIdToken('src/components/ApplicationWorkspace.tsx');
replaceGetIdToken('src/components/FindJobs.tsx');
replaceGetIdToken('src/components/AnalyzeJobModal.tsx');
