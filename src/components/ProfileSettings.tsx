import React, { useEffect, useState } from 'react';


import { useAuth } from '../AuthContext';
import { Save, AlertCircle, Upload, FileText, BrainCircuit, Database, Server, RefreshCw, Clock } from 'lucide-react';
import { UserProfile, ProviderStatus } from '../types';
import { resumeService } from '../services/resumeService';

export default function ProfileSettings() {
  const { user, getToken } = useAuth();
  const [profile, setProfile] = useState<Partial<UserProfile>>({ baseCvText: '' });
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'RAW' | 'STRUCTURED' | 'PROVIDER'>('RAW');
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [testingProvider, setTestingProvider] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const p = await resumeService.getProfile(user.uid);
      setProfile(p);
    };
    
    fetchProfile();
    checkProviderStatus();
  }, [user]);

  const checkProviderStatus = async () => {
    try {
      const res = await fetch('/api/provider/status');
      if (res.ok) {
        setProviderStatus(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTestConnection = async () => {
    setTestingProvider(true);
    await checkProviderStatus();
    setTestingProvider(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setMessage('');
    try {
      await resumeService.updateProfile(user.uid, profile);
      setMessage('Profile saved successfully!');
    } catch (error) {
      console.error(error);
      setMessage('Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleExtract = async () => {
    if (!profile.baseCvText) return;
    setExtracting(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/extract-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ baseCv: profile.baseCvText })
      });
      const data = await res.json();
      setProfile(prev => ({ ...prev, ...data }));
      setActiveTab('STRUCTURED');
      setMessage('Profile extracted successfully! Please review and save.');
    } catch (error) {
      console.error(error);
      setMessage('Failed to extract profile.');
    } finally {
      setExtracting(false);
    }
  };

  const loadSampleData = () => {
    setProfile({
      baseCvText: `Abhinav Jain\nSoftware Engineer\nExperience: 5 years\nSkills: React, Node.js, TypeScript, Next.js, Firebase, PostgreSQL\nCurrent Role: Frontend Tech Lead at ExampleCorp\nSummary: Passionate frontend engineer with 5 years building scalable web applications. Strong focus on design systems and performance.\nEducation: B.Tech in Computer Science, State University (2017-2021)\nCertifications: AWS Certified Developer`,
      summary: 'Passionate frontend engineer with 5 years building scalable web applications. Strong focus on design systems and performance.',
      totalExperience: 5,
      currentRole: 'Frontend Tech Lead at ExampleCorp',
      skills: ['React', 'Node.js', 'TypeScript', 'Next.js', 'Firebase', 'PostgreSQL'],
      tools: ['Git', 'VS Code', 'Figma'],
      industries: ['Tech', 'SaaS'],
      education: ['B.Tech in Computer Science, State University'],
      certifications: ['AWS Certified Developer'],
      achievements: ['Led migration from Vue to React', 'Improved web performance by 40%'],
      preferredLocations: ['Remote', 'San Francisco', 'New York'],
      workMode: 'Remote/Hybrid',
      expectedSalary: '$140,000'
    });
    setActiveTab('STRUCTURED');
  };

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col h-screen overflow-hidden">
      <div className="mb-6 shrink-0 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Settings</h1>
          <p className="text-slate-600">
            Manage your CV profile and application integrations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadSampleData} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
            Load Sample Profile
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>

      <div className="flex border-b border-slate-200 shrink-0 gap-6 mb-6">
        <button 
          onClick={() => setActiveTab('RAW')}
          className={`pb-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'RAW' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <div className="flex items-center gap-2"><FileText className="w-4 h-4" /> Raw CV Input</div>
        </button>
        <button 
          onClick={() => setActiveTab('STRUCTURED')}
          className={`pb-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'STRUCTURED' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <div className="flex items-center gap-2"><BrainCircuit className="w-4 h-4" /> Extracted Structured Profile</div>
        </button>
        <button 
          onClick={() => setActiveTab('PROVIDER')}
          className={`pb-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'PROVIDER' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <div className="flex items-center gap-2"><Server className="w-4 h-4" /> Job Data Provider</div>
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg shrink-0 text-sm font-medium ${message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'RAW' && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                  <Upload className="w-4 h-4" /> Upload PDF / DOCX
                </button>
                <span className="text-xs text-slate-400">or paste text below</span>
              </div>
              <button
                onClick={handleExtract}
                disabled={extracting || !profile.baseCvText}
                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                <BrainCircuit className="w-4 h-4" />
                {extracting ? 'Extracting...' : 'Auto-Extract Profile'}
              </button>
            </div>
            <textarea
              value={profile.baseCvText || ''}
              onChange={(e) => setProfile({ ...profile, baseCvText: e.target.value })}
              placeholder="Paste your full CV text here..."
              className="w-full flex-1 p-6 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono text-sm leading-relaxed min-h-[500px]"
            />
          </div>
        )}

        {activeTab === 'STRUCTURED' && (
          <div className="space-y-6 pb-8">
            <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Core Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Current Role</label>
                  <input type="text" value={profile.currentRole || ''} onChange={e => setProfile({...profile, currentRole: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Total Experience (Years)</label>
                  <input type="number" value={profile.totalExperience || 0} onChange={e => setProfile({...profile, totalExperience: parseInt(e.target.value) || 0})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Professional Summary</label>
                  <textarea value={profile.summary || ''} onChange={e => setProfile({...profile, summary: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[100px]" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Capabilities</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Skills (comma separated)</label>
                  <textarea value={profile.skills?.join(', ') || ''} onChange={e => setProfile({...profile, skills: e.target.value.split(',').map(s=>s.trim()).filter(s=>s)})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[80px]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tools & Tech (comma separated)</label>
                  <textarea value={profile.tools?.join(', ') || ''} onChange={e => setProfile({...profile, tools: e.target.value.split(',').map(s=>s.trim()).filter(s=>s)})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[80px]" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Preferences</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Work Mode</label>
                  <input type="text" value={profile.workMode || ''} onChange={e => setProfile({...profile, workMode: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="e.g. Remote, Hybrid" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expected Salary</label>
                  <input type="text" value={profile.expectedSalary || ''} onChange={e => setProfile({...profile, expectedSalary: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Locations</label>
                  <input type="text" value={profile.preferredLocations?.join(', ') || ''} onChange={e => setProfile({...profile, preferredLocations: e.target.value.split(',').map(s=>s.trim()).filter(s=>s)})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'PROVIDER' && (
          <div className="space-y-6 pb-8">
            <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-600" /> Server-side Integration Status
                </h3>
                <button 
                  onClick={handleTestConnection}
                  disabled={testingProvider}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${testingProvider ? 'animate-spin' : ''}`} />
                  Test Connection
                </button>
              </div>

              {!providerStatus ? (
                <div className="text-slate-500">Loading provider status...</div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 border rounded-lg bg-slate-50">
                    <div>
                      <div className="text-sm text-slate-500 font-medium">Configured Provider</div>
                      <div className="font-bold text-slate-800 text-lg">{providerStatus.provider}</div>
                    </div>
                    <div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider ${
                        providerStatus.status === 'CONNECTED' ? 'bg-green-100 text-green-700' :
                        providerStatus.status === 'DEMO' ? 'bg-blue-100 text-blue-700' :
                        providerStatus.status === 'NOT_CONFIGURED' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {providerStatus.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {providerStatus.status === 'DEMO' && (
                    <div className="text-sm text-slate-600">
                      You are currently using the Mock Provider. This mode returns simulated job data for UI testing and demonstration.
                      To connect to live Naukri data, update <code>JOB_PROVIDER=naukri</code> and provide API credentials in your server environment variables.
                    </div>
                  )}

                  {providerStatus.status === 'NOT_CONFIGURED' && (
                    <div className="text-sm text-amber-700 bg-amber-50 p-4 rounded-lg border border-amber-200">
                      <strong>Missing API Credentials.</strong> Your environment is set to use the Naukri provider, but the required secrets (<code>NAUKRI_API_KEY</code>, <code>NAUKRI_CLIENT_ID</code>) are missing.
                    </div>
                  )}

                  {providerStatus.status === 'ERROR' && (
                    <div className="text-sm text-red-700 bg-red-50 p-4 rounded-lg border border-red-200">
                      <strong>Provider Error:</strong> {providerStatus.lastError || 'Failed to establish live connection to provider.'}
                    </div>
                  )}

                  {providerStatus.lastSync && (
                    <div className="text-sm text-slate-500 flex items-center gap-1">
                      <Clock className="w-4 h-4" /> Last successful sync: {new Date(providerStatus.lastSync).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
