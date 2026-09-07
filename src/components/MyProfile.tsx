import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { UserProfile } from '../types';
import { resumeService } from '../services/resumeService';
import { Save, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

export default function MyProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const p = await resumeService.getProfile(user.uid);
      setProfile(p);
    };
    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setMessage('');
    try {
      await resumeService.updateProfile(user.uid, profile);
      setMessage('Profile updated successfully!');
    } catch (error) {
      console.error(error);
      setMessage('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const loadSampleData = () => {
    setProfile({
      summary: 'Passionate frontend engineer with 5 years building scalable web applications. Strong focus on design systems and performance.',
      totalExperience: 5,
      currentRole: 'Frontend Tech Lead at ExampleCorp',
      skills: ['React', 'Node.js', 'TypeScript', 'Next.js', 'Firebase', 'PostgreSQL'],
      tools: ['Git', 'VS Code', 'Figma'],
      preferredLocations: ['Remote', 'San Francisco', 'New York'],
      workMode: 'Remote/Hybrid',
      expectedSalary: '$140,000'
    });
    setMessage('Sample profile details loaded. Click Save Profile to apply.');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">My Profile</h1>
          <p className="text-slate-600">
            Define your core qualifications and preferences used by Gemini to match against jobs.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            type="button" 
            onClick={loadSampleData} 
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            Load Sample Profile
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg text-sm font-medium flex items-center gap-2 border ${message.includes('success') || message.includes('loaded') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {message.includes('success') || message.includes('loaded') ? (
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600" />
          )}
          <span>{message}</span>
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Core Identity</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Current Role</label>
              <input 
                type="text" 
                value={profile.currentRole || ''} 
                onChange={e => setProfile({...profile, currentRole: e.target.value})} 
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm" 
                placeholder="e.g. Senior Software Engineer"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Total Experience (Years)</label>
              <input 
                type="number" 
                value={profile.totalExperience || 0} 
                onChange={e => setProfile({...profile, totalExperience: parseInt(e.target.value) || 0})} 
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm" 
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Professional Summary</label>
              <textarea 
                value={profile.summary || ''} 
                onChange={e => setProfile({...profile, summary: e.target.value})} 
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[120px] text-sm leading-relaxed" 
                placeholder="A high-level summary of your background, experience, and interests."
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Technical Alignment</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Skills (comma separated)</label>
              <textarea 
                value={profile.skills?.join(', ') || ''} 
                onChange={e => setProfile({...profile, skills: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} 
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[100px] text-sm" 
                placeholder="React, Node.js, TypeScript, Next.js..."
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Tools & Infrastructure (comma separated)</label>
              <textarea 
                value={profile.tools?.join(', ') || ''} 
                onChange={e => setProfile({...profile, tools: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} 
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[100px] text-sm" 
                placeholder="Git, Figma, AWS, Docker..."
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Preferences & Logistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Work Mode</label>
              <input 
                type="text" 
                value={profile.workMode || ''} 
                onChange={e => setProfile({...profile, workMode: e.target.value})} 
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm" 
                placeholder="e.g. Remote, Hybrid, On-site" 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Expected Salary</label>
              <input 
                type="text" 
                value={profile.expectedSalary || ''} 
                onChange={e => setProfile({...profile, expectedSalary: e.target.value})} 
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm" 
                placeholder="e.g. $140,000/yr"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Preferred Locations (comma separated)</label>
              <input 
                type="text" 
                value={profile.preferredLocations?.join(', ') || ''} 
                onChange={e => setProfile({...profile, preferredLocations: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} 
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm" 
                placeholder="e.g. Remote, San Francisco, New York"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
