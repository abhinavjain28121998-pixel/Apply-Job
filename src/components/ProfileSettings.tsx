import React, { useEffect, useState, useRef } from 'react';

import { useAuth } from '../AuthContext';
import { 
  Save, 
  AlertCircle, 
  Upload, 
  FileText, 
  BrainCircuit, 
  Database, 
  Server, 
  RefreshCw, 
  Clock,
  CheckCircle2,
  FileUp,
  X,
  Sparkles,
  Loader2,
  Trash2
} from 'lucide-react';
import { UserProfile, ProviderStatus } from '../types';
import { resumeService } from '../services/resumeService';
import { safeFetchJson } from '../lib/api';

export default function ProfileSettings() {
  const { user, getToken } = useAuth();
  const [profile, setProfile] = useState<Partial<UserProfile>>({ baseCvText: '' });
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'RAW' | 'STRUCTURED' | 'PROVIDER'>('RAW');
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [testingProvider, setTestingProvider] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const result = await safeFetchJson('/api/provider/status');
      if (result.ok && result.data) {
        setProviderStatus(result.data);
      }
    } catch (e) {
      console.warn('Could not check provider status:', e);
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
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const result = await safeFetchJson('/api/extract-profile', {
        method: 'POST',
        headers,
        body: JSON.stringify({ baseCv: profile.baseCvText })
      });
      if (!result.ok || !result.data) {
        throw new Error(result.error || 'Failed to extract profile.');
      }
      setProfile(prev => ({ ...prev, ...result.data }));
      setActiveTab('STRUCTURED');
      setMessage('Profile extracted successfully! Please review and save.');
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || 'Failed to extract profile.');
    } finally {
      setExtracting(false);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const processFile = async (file: File) => {
    if (!file) return;

    const validExtensions = ['pdf', 'docx', 'doc', 'txt', 'md', 'rtf'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (!validExtensions.includes(ext) && !file.type.includes('pdf') && !file.type.includes('text') && !file.type.includes('word')) {
      setMessage('Unsupported file format. Please upload a PDF (.pdf), Word document (.docx), or plain text file (.txt, .md).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage('File size exceeds 10MB limit. Please upload a smaller document or paste text directly.');
      return;
    }

    setUploading(true);
    setUploadProgress(`Reading ${file.name}...`);
    setMessage('');

    try {
      // 1. Read file as Base64 for the server parser
      const reader = new FileReader();
      const readPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file from disk.'));
        reader.readAsDataURL(file);
      });

      setUploadProgress(`Uploading and parsing ${ext.toUpperCase() || 'document'}...`);
      const base64Data = await readPromise;

      const token = await getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      setUploadProgress('Extracting document text...');
      const result = await safeFetchJson<{
        ok: boolean;
        text: string;
        filename: string;
        wordCount: number;
        characterCount: number;
      }>('/api/upload-cv', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          base64Data
        })
      });

      if (!result.ok || !result.data?.text) {
        // Fallback for plain text if network or server issue
        if (ext === 'txt' || ext === 'md' || file.type.startsWith('text/')) {
          const textContent = await file.text();
          if (textContent && textContent.trim()) {
            const words = textContent.split(/\s+/).filter(Boolean).length;
            setProfile(prev => ({
              ...prev,
              baseCvText: textContent,
              uploadedFileName: file.name,
              uploadedFileSize: file.size,
              uploadedFileDate: new Date().toISOString()
            }));
            setMessage(`Loaded "${file.name}" (${words.toLocaleString()} words).`);
            return;
          }
        }
        throw new Error(result.error || 'Failed to extract text from document.');
      }

      const extractedText = result.data.text;
      const wordCount = result.data.wordCount;

      setProfile(prev => ({
        ...prev,
        baseCvText: extractedText,
        uploadedFileName: file.name,
        uploadedFileSize: file.size,
        uploadedFileDate: new Date().toISOString()
      }));

      setMessage(`Successfully imported "${file.name}" (${wordCount.toLocaleString()} words extracted). You can review below or click Auto-Extract Profile.`);
    } catch (err: any) {
      console.error('File upload error:', err);
      // Fallback for text files
      if (ext === 'txt' || ext === 'md' || file.type.startsWith('text/')) {
        try {
          const textContent = await file.text();
          if (textContent && textContent.trim()) {
            const words = textContent.split(/\s+/).filter(Boolean).length;
            setProfile(prev => ({
              ...prev,
              baseCvText: textContent,
              uploadedFileName: file.name,
              uploadedFileSize: file.size,
              uploadedFileDate: new Date().toISOString()
            }));
            setMessage(`Loaded text from "${file.name}" (${words.toLocaleString()} words).`);
            return;
          }
        } catch {}
      }
      setMessage(err?.message || 'Failed to process and extract text from the uploaded CV.');
    } finally {
      setUploading(false);
      setUploadProgress('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleClearCv = () => {
    setProfile(prev => ({
      ...prev,
      baseCvText: '',
      uploadedFileName: undefined,
      uploadedFileSize: undefined,
      uploadedFileDate: undefined
    }));
    setMessage('Cleared CV text.');
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

  const currentWordCount = (profile.baseCvText || '').trim().split(/\s+/).filter(Boolean).length;
  const currentCharCount = (profile.baseCvText || '').length;

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col h-screen overflow-hidden">
      {/* Hidden native file input */}
      <input 
        ref={fileInputRef}
        type="file"
        id="cv-file-input"
        accept=".pdf,.docx,.doc,.txt,.md,.rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="mb-6 shrink-0 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Settings</h1>
          <p className="text-slate-600">
            Manage your CV profile, upload resumes, and configure job data providers.
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
        <div className={`mb-6 p-4 rounded-lg shrink-0 text-sm font-medium flex items-center justify-between ${message.includes('success') || message.includes('Loaded') || message.includes('Successfully') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <div className="flex items-center gap-2">
            {message.includes('success') || message.includes('Loaded') || message.includes('Successfully') ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage('')} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'RAW' && (
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[500px] transition-all ${
              isDragging ? 'border-indigo-500 ring-2 ring-indigo-500 bg-indigo-50/20' : 'border-slate-200'
            }`}
          >
            {/* Drag overlay state */}
            {isDragging && (
              <div className="absolute inset-0 bg-indigo-50/90 backdrop-blur-xs z-20 flex flex-col items-center justify-center border-2 border-dashed border-indigo-500 rounded-xl p-8 pointer-events-none">
                <FileUp className="w-16 h-16 text-indigo-600 mb-3 animate-bounce" />
                <h3 className="text-xl font-bold text-indigo-900 mb-1">Drop your CV here</h3>
                <p className="text-sm text-indigo-700">Supported formats: PDF, DOCX, TXT, MD (up to 10MB)</p>
              </div>
            )}

            {/* Upload Toolbar Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-4 justify-between items-center">
              <div className="flex items-center gap-3 flex-wrap">
                <button 
                  id="upload-cv-button"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>{uploading ? 'Processing File...' : 'Upload CV / Resume'}</span>
                </button>

                {profile.uploadedFileName && (
                  <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700">
                    <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="truncate max-w-[180px]" title={profile.uploadedFileName}>
                      {profile.uploadedFileName}
                    </span>
                    {profile.uploadedFileSize ? (
                      <span className="text-slate-400">({formatBytes(profile.uploadedFileSize)})</span>
                    ) : null}
                    <button 
                      type="button" 
                      onClick={handleClearCv}
                      title="Clear uploaded CV" 
                      className="text-slate-400 hover:text-red-600 ml-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <span className="text-xs text-slate-400 hidden sm:inline">
                  Drag & drop PDF, DOCX, or TXT (or paste text below)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {profile.baseCvText && (
                  <button
                    type="button"
                    onClick={handleClearCv}
                    className="text-xs text-slate-500 hover:text-red-600 px-2.5 py-1.5 rounded-md hover:bg-slate-100 transition-colors"
                  >
                    Clear Text
                  </button>
                )}
                <button
                  id="auto-extract-profile-button"
                  type="button"
                  onClick={handleExtract}
                  disabled={extracting || !profile.baseCvText || uploading}
                  className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {extracting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  )}
                  {extracting ? 'Extracting with AI...' : 'Auto-Extract Profile'}
                </button>
              </div>
            </div>

            {/* Uploading progress notification */}
            {uploading && (
              <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-3 flex items-center gap-3 text-sm text-indigo-800 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>{uploadProgress || 'Extracting CV text from uploaded document...'}</span>
              </div>
            )}

            {/* Empty state drag & drop zone banner if no CV text */}
            {!profile.baseCvText && !uploading && (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="m-6 p-8 border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl bg-slate-50/50 hover:bg-indigo-50/20 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group"
              >
                <div className="w-14 h-14 rounded-full bg-indigo-100 group-hover:bg-indigo-200 text-indigo-600 flex items-center justify-center mb-4 transition-colors">
                  <Upload className="w-7 h-7" />
                </div>
                <h4 className="text-base font-semibold text-slate-800 mb-1">
                  Upload your CV to get started
                </h4>
                <p className="text-sm text-slate-500 max-w-md mb-4">
                  Drag and drop your file here, or click to browse. We automatically extract and parse your experience, skills, and qualifications.
                </p>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-600">
                    PDF (.pdf)
                  </span>
                  <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-600">
                    Word (.docx)
                  </span>
                  <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-600">
                    Text (.txt, .md)
                  </span>
                  <span className="text-xs text-slate-400">Up to 10MB</span>
                </div>
              </div>
            )}

            {/* Editor Textarea */}
            <div className="flex-1 flex flex-col min-h-[350px]">
              <textarea
                id="raw-cv-textarea"
                value={profile.baseCvText || ''}
                onChange={(e) => setProfile({ ...profile, baseCvText: e.target.value })}
                placeholder="Or paste your raw CV text here directly..."
                className="w-full flex-1 p-6 text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none font-mono text-sm leading-relaxed min-h-[350px]"
              />

              {/* Status and count footer */}
              <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
                <div className="flex items-center gap-3">
                  <span>{currentCharCount.toLocaleString()} characters</span>
                  <span>•</span>
                  <span>{currentWordCount.toLocaleString()} words</span>
                  {profile.uploadedFileName && (
                    <>
                      <span>•</span>
                      <span className="text-indigo-600 font-medium truncate max-w-[200px]">
                        Imported from {profile.uploadedFileName}
                      </span>
                    </>
                  )}
                </div>
                <div>
                  {currentWordCount > 0 ? (
                    <span className="text-green-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> CV Ready for Analysis
                    </span>
                  ) : (
                    <span className="text-slate-400">Waiting for CV input</span>
                  )}
                </div>
              </div>
            </div>
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
                      You are currently using the Demo Provider for UI testing.
                      Job discovery is powered by the official LinkedIn Search Destination builder.
                    </div>
                  )}

                  {providerStatus.status === 'NOT_CONFIGURED' && (
                    <div className="text-sm text-slate-700 bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <strong>Official LinkedIn Job Search Destination:</strong> Job discovery uses verified, direct LinkedIn Search URLs based on your profile and search criteria. No third-party API credentials, browser automation, or scraping are required.
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

