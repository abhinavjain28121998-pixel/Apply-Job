import fs from 'fs';
let content = fs.readFileSync('src/AuthContext.tsx', 'utf8');

content = content.replace(
  /logOut: \(\) => Promise<void>;/,
  `logOut: () => Promise<void>;
  getToken: () => Promise<string>;`
);

content = content.replace(
  /const logOut = async \(\) => \{/,
  `const getToken = async () => {
    if (user?.isDemo) return 'demo-token';
    if (isFirebaseConfigured() && auth && auth.currentUser) {
      try { return await auth.currentUser.getIdToken(); } catch (e) { return ''; }
    }
    return '';
  };

  const logOut = async () => {`
);

content = content.replace(
  /<AuthContext\.Provider value=\{\{ user, loading, signIn, signInDemo, logOut \}\}>/,
  `<AuthContext.Provider value={{ user, loading, signIn, signInDemo, logOut, getToken }}>`
);

fs.writeFileSync('src/AuthContext.tsx', content);
