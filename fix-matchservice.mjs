import fs from 'fs';
let content = fs.readFileSync('src/services/jobMatchService.ts', 'utf8');

content = content.replace(
  /saveMatch: async/,
  `getMatchesForUser: async (userId: string): Promise<JobMatch[]> => {
    if (isFirebaseConfigured() && db) {
      const q = query(collection(db, 'job_matches'), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as JobMatch);
    } else {
      return getLocalMatches().filter(m => m.userId === userId);
    }
  },
  
  saveMatch: async`
);

fs.writeFileSync('src/services/jobMatchService.ts', content);
