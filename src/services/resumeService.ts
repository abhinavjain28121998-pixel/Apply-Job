import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { UserProfile } from '../types';

const defaultDemoProfile: Partial<UserProfile> = {
  baseCvText: `Alex Carter
Digital Marketing Manager
Bangalore, India | alex.carter@email.com | +91-9876543210

PROFESSIONAL SUMMARY
Results-driven Digital Marketing Professional with 5 years of experience in SEO, performance marketing, and content strategy. Proven track record of scaling organic traffic by 150% and improving ROAS by 30% for B2B and SaaS brands. Strong analytical skills with proficiency in Google Analytics, Ahrefs, and Meta Ads.

EXPERIENCE
Digital Marketing Lead
TechSaaS Solutions, Bangalore (2021 - Present)
- Lead a team of 2 to execute comprehensive digital campaigns across SEO, SEM, and social media.
- Scaled organic blog traffic from 10k to 25k monthly visitors through technical SEO and content clustering.
- Managed a monthly ad budget of $15,000 on Google Ads and LinkedIn, reducing CPA by 20%.
- Implemented marketing automation workflows using HubSpot, increasing lead-to-MQL conversion rate by 15%.

SEO & Content Specialist
GrowthGen Agency, Remote (2019 - 2021)
- Conducted comprehensive keyword research and on-page SEO audits for 10+ clients.
- Authored 50+ high-performing blog posts, landing pages, and case studies.
- Built a robust backlink profile, securing 100+ high-authority domains.

SKILLS
- Search Engine Optimization (SEO), Technical SEO, Ahrefs, SEMrush
- Performance Marketing, Google Ads, Meta Ads, LinkedIn Ads
- Content Strategy, Copywriting, Email Marketing (HubSpot, Mailchimp)
- Web Analytics, Google Analytics 4 (GA4), Looker Studio, Tag Manager

EDUCATION
Bachelor of Business Administration (Marketing)
Christ University, Bangalore (2015 - 2018)`,
  summary: "Results-driven Digital Marketing Professional with 5 years of experience in SEO, performance marketing, and content strategy.",
  skills: ["SEO", "Google Ads", "Content Strategy", "HubSpot", "Google Analytics 4"],
  currentRole: "Digital Marketing Lead",
  totalExperience: 5
};

export const resumeService = {
  getProfile: async (userId: string): Promise<Partial<UserProfile>> => {
    if (isFirebaseConfigured() && db) {
      const docRef = doc(db, 'users', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
      }
      return { baseCvText: '' };
    } else {
      try {
        const profiles = JSON.parse(localStorage.getItem('demo_profiles') || '{}');
        return profiles[userId] || defaultDemoProfile;
      } catch {
        return defaultDemoProfile;
      }
    }
  },

  updateProfile: async (userId: string, profile: Partial<UserProfile>): Promise<void> => {
    // Generate version hash if baseCvText exists
    if (profile.baseCvText) {
      const cvText = profile.baseCvText;
      let hash = 0;
      for (let i = 0; i < cvText.length; i++) {
        hash = Math.imul(31, hash) + cvText.charCodeAt(i) | 0;
      }
      profile.version = 'v' + cvText.length + '-' + Math.abs(hash);
    }
    if (isFirebaseConfigured() && db) {
      await setDoc(doc(db, 'users', userId), {
        userId,
        ...profile,
        updatedAt: Date.now()
      }, { merge: true });
    } else {
      const profiles = JSON.parse(localStorage.getItem('demo_profiles') || '{}');
      profiles[userId] = { ...profiles[userId], ...profile, userId, updatedAt: Date.now() };
      localStorage.setItem('demo_profiles', JSON.stringify(profiles));
    }
  }
};
