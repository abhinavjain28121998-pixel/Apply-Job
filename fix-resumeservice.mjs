import fs from 'fs';
let content = fs.readFileSync('src/services/resumeService.ts', 'utf8');

content = content.replace(
  /updateProfile: async \(userId: string, profile: Partial<UserProfile>\): Promise<void> => \{/,
  `updateProfile: async (userId: string, profile: Partial<UserProfile>): Promise<void> => {
    // Generate version hash if baseCvText exists
    if (profile.baseCvText) {
      const cvText = profile.baseCvText;
      let hash = 0;
      for (let i = 0; i < cvText.length; i++) {
        hash = Math.imul(31, hash) + cvText.charCodeAt(i) | 0;
      }
      profile.version = 'v' + cvText.length + '-' + Math.abs(hash);
    }`
);

fs.writeFileSync('src/services/resumeService.ts', content);
