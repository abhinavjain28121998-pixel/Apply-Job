import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { UserProfile } from '../types';
import { resumeService } from '../services/resumeService';
import { safeFetchJson } from '../lib/api';
import { 
  Upload, 
  FileText, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  FileUp, 
  X,
  Save
} from 'lucide-react';

export default function MyResume() {
  const { user, getToken } = useAuth();
  const [profile, setProfile] = useState<Partial<UserProfile>>({ baseCvText: '' });
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setMessage('Resume saved successfully!');
    } catch (error) {
      console.error(error);
      setMessage('Failed to save resume.');
    } finally {
      setSaving(false);
    }
  };

  const handleExtract = async () => {
    if (!profile.baseCvText) return;
    setExtracting(true);
    setMessage('');
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
      await resumeService.updateProfile(user!.uid, { ...profile, ...result.data });
      setMessage('AI has successfully parsed and populated your Profile details! Please check the My Profile tab.');
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
      setMessage('Unsupported file format. Please upload a PDF, Word document, or plain text file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage('File size exceeds 10MB limit. Please upload a smaller document.');
      return;
    }

    setUploading(true);
    setUploadProgress(`Reading ${file.name}...`);
    setMessage('');

    try {
      const reader = new FileReader();
      const readPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file from disk.'));
        reader.readAsDataURL(file);
      });

      setUploadProgress(`Uploading and parsing ${ext.toUpperCase()}...`);
      const base64Data = await readPromise;

      const token = await getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      setUploadProgress('Extracting document text with secure server parser...');
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
            setMessage(`Loaded text from "${file.name}" locally (${words.toLocaleString()} words).`);
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

      setMessage(`Successfully imported "${file.name}" (${wordCount.toLocaleString()} words extracted). Review below and click "Auto-Extract Profile".`);
    } catch (err: any) {
      console.error(err);
      setMessage(err?.message || 'Failed to parse file.');
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

  const handleClear = () => {
    setProfile(prev => ({
      ...prev,
      baseCvText: '',
      uploadedFileName: undefined,
      uploadedFileSize: undefined,
      uploadedFileDate: undefined
    }));
    setMessage('Cleared CV text.');
  };

  const currentWordCount = (profile.baseCvText || '').trim().split(/\s+/).filter(Boolean).length;
  const currentCharCount = (profile.baseCvText || '').length;

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      <input 
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt,.md,.rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="mb-6 shrink-0 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">My Resume</h1>
          <p className="text-slate-600">
            Upload your master CV or resume. We will keep it safe and use it as your baseline profile.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Resume'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-lg shrink-0 text-sm font-medium flex items-center justify-between border ${message.includes('success') || message.includes('Successfully') || message.includes('Loaded') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          <div className="flex items-center gap-2">
            {message.includes('success') || message.includes('Successfully') || message.includes('Loaded') ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            )}
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage('')} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files?.length) processFile(e.dataTransfer.files[0]); }}
        className={`flex-1 min-h-0 bg-white border rounded-xl shadow-sm flex flex-col relative overflow-hidden ${isDragging ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/10' : 'border-slate-200'}`}
      >
        {isDragging && (
          <div className="absolute inset-0 bg-indigo-50/95 backdrop-blur-xs z-20 flex flex-col items-center justify-center border-2 border-dashed border-indigo-500 rounded-xl p-8 pointer-events-none">
            <FileUp className="w-16 h-16 text-indigo-600 mb-3 animate-bounce" />
            <h3 className="text-xl font-bold text-indigo-900 mb-1">Drop your CV here</h3>
            <p className="text-sm text-indigo-700">PDF, DOCX, TXT, or MD (up to 10MB)</p>
          </div>
        )}

        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-4 justify-between items-center shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>{uploading ? 'Processing File...' : 'Upload Resume / CV File'}</span>
            </button>

            {profile.uploadedFileName && (
              <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span className="truncate max-w-[150px]">{profile.uploadedFileName}</span>
                <span className="text-slate-400">({formatBytes(profile.uploadedFileSize)})</span>
                <button type="button" onClick={handleClear} className="text-slate-400 hover:text-red-600 ml-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {profile.baseCvText && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-slate-500 hover:text-red-600 px-2.5 py-1.5 rounded-md hover:bg-slate-100"
              >
                Clear Text
              </button>
            )}
            <button
              type="button"
              onClick={handleExtract}
              disabled={extracting || !profile.baseCvText || uploading}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-400" />}
              <span>{extracting ? 'Extracting with AI...' : 'Auto-Extract Profile'}</span>
            </button>
          </div>
        </div>

        {uploading && (
          <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-3 flex items-center gap-3 text-sm text-indigo-800 animate-pulse shrink-0">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <span>{uploadProgress || 'Parsing CV text from document...'}</span>
          </div>
        )}

        {!profile.baseCvText && !uploading && (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="m-6 p-8 border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl bg-slate-50/50 hover:bg-indigo-50/20 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group flex-1"
          >
            <div className="w-14 h-14 rounded-full bg-indigo-100 group-hover:bg-indigo-200 text-indigo-600 flex items-center justify-center mb-4">
              <Upload className="w-7 h-7" />
            </div>
            <h4 className="text-base font-semibold text-slate-800 mb-1">Upload your resume to get started</h4>
            <p className="text-sm text-slate-500 max-w-md mb-4">
              Drag and drop your document file here, or click to browse. We support PDF, DOCX, and TXT files.
            </p>
          </div>
        )}

        {profile.baseCvText && (
          <div className="flex-1 flex flex-col min-h-0">
            <textarea
              value={profile.baseCvText}
              onChange={(e) => setProfile({ ...profile, baseCvText: e.target.value })}
              placeholder="Or paste your raw CV text here directly..."
              className="w-full flex-1 p-6 text-slate-800 focus:outline-none resize-none font-mono text-sm leading-relaxed overflow-y-auto"
            />
            <div className="px-6 py-2 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 shrink-0">
              <div className="flex items-center gap-3">
                <span>{currentCharCount.toLocaleString()} characters</span>
                <span>•</span>
                <span>{currentWordCount.toLocaleString()} words</span>
              </div>
              <span className="text-green-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Baseline Resume Ready
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
