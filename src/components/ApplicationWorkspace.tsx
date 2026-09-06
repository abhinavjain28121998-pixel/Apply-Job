import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Job } from '../types';
import { resumeService } from '../services/resumeService';
import { jobService } from '../services/jobService';
import { applicationService } from '../services/applicationService';
import { jobMatchService } from '../services/jobMatchService';
import { SavedJob, JobMatch, Application } from '../types';
import { calculateApplicationReadiness } from '../services/applicationReadinessService';
import { CheckCircle2, ChevronLeft, AlertTriangle, ExternalLink, RefreshCw, FileText, FileSignature, Save, MessageSquare, Briefcase, Loader2, Info } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function ApplicationWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [savedJob, setSavedJob] = useState<SavedJob | null>(null);
  const [match, setMatch] = useState<JobMatch | null>(null);
  const [app, setApp] = useState<Application | null>(null);
  
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [coverLetter, setCoverLetter] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [improvements, setImprovements] = useState<any[]>([]);
  const [generating, setGenerating] = useState<'coverLetter' | 'answers' | 'tailor' | 'analysis' | null>(null);

  useEffect(() => {
    const fetchJob = async () => {
      setLoading(true);
      try {
        if (!id || !user) return;
        
        const savedJobData = await jobService.getSavedJob(user.uid, id);
        if (savedJobData) {
          const matchData = await jobMatchService.getMatch(user.uid, id);
          const appData = await applicationService.getApplication(user.uid, id);
          
          // Construct a UI friendly job object
          setSavedJob(savedJobData);
          setMatch(matchData);
          setApp(appData);
          
          if (appData?.coverLetter) setCoverLetter(appData.coverLetter);
          if (appData?.applicationAnswers) setAnswers(appData.applicationAnswers);
          if (appData?.bulletImprovements) setImprovements(appData.bulletImprovements);
          if (appData?.tailoredCv) setTailoredCv(appData.tailoredCv);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [id, user]);

  const saveAppState = async (updates: Partial<Application>) => {
    if (!id || !user) return;
        
    try {
      const updatedApp = await applicationService.createOrUpdateApplication(user.uid, id, updates);
      setApp(updatedApp);
    } catch (e) {
      console.error(e);
      alert('Failed to save changes.');
    }
  };

  const handleAnalyzeJob = async () => {
    if (!savedJob?.job || !user) return;
    setGenerating('analysis');
    try {
      const profile = await resumeService.getProfile(user.uid);
      const res = await fetch('/api/analyze-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription: savedJob?.job?.description,
          baseCv: profile.baseCvText
        })
      });
      if (res.ok) {
        const analysis = await res.json();
        await saveJobState(analysis);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!savedJob?.job || !user) return;
    setGenerating('coverLetter');
    try {
      const profile = await resumeService.getProfile(user.uid);
      const res = await fetch('/api/generate-cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription: savedJob?.job?.description,
          baseCv: profile.baseCvText,
          company: savedJob?.job?.company,
          title: savedJob?.job?.title
        })
      });
      if (res.ok) {
        const text = await res.text();
        setCoverLetter(text);
        await saveJobState({ coverLetter: text });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateAnswers = async () => {
    if (!savedJob?.job || !user) return;
    setGenerating('answers');
    try {
      const profile = await resumeService.getProfile(user.uid);
      const res = await fetch('/api/generate-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription: savedJob?.job?.description,
          baseCv: profile.baseCvText,
          company: savedJob?.job?.company,
          title: savedJob?.job?.title
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAnswers(data);
        await saveJobState({ applicationAnswers: data });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(null);
    }
  };

  const handleTailorResume = async () => {
    if (!savedJob?.job || !user) return;
    setGenerating('tailor');
    try {
      const profile = await resumeService.getProfile(user.uid);
      const res = await fetch('/api/tailor-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription: savedJob?.job?.description,
          baseCv: profile.baseCvText,
          company: savedJob?.job?.company,
          title: savedJob?.job?.title
        })
      });
      if (res.ok) {
        const data = await res.json();
        const updates: Partial<Job> = {
          bulletImprovements: data.bulletImprovements,
          tailoredCv: data.tailoredCv,
          updatedSummary: data.updatedSummary,
          emphasizedSkills: data.emphasizedSkills
        };
        await saveJobState(updates);
        if (data.bulletImprovements) {
          setImprovements(data.bulletImprovements.map((b: any) => ({ ...b, status: 'PENDING' })));
        }
        if (!coverLetter && data.coverLetter) {
          setCoverLetter(data.coverLetter);
          await saveJobState({ ...updates, coverLetter: data.coverLetter });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(null);
    }
  };

  const markAsApplied = async () => {
    await saveJobState({
      status: 'APPLIED',
      dateApplied: Date.now()
    });
    alert('Application marked as applied!');
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  if (!savedJob?.job) return <div className="p-8 text-center text-slate-500">Job not found</div>;


  // We need to parse out the individual pieces that were merged into "job".
  // Actually, job currently is merged. Let's unmerge or pass it.
  // Wait, applicationService.getApplication(user.uid, id) returns the app state.
  // jobMatchService.getMatch(user.uid, id) returns the match state.
  // The `job` state is a combined object but we can reconstruct or fetch them separately.
  // Or better yet, we just refactor the state to hold them separately.
  

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="mb-6">
        <button onClick={() => navigate('/tracker')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 font-medium transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to Tracker
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{savedJob?.job?.title}</h1>
                <div className="flex items-center gap-2 text-slate-600 mt-1 text-sm font-medium">
                  <span>{savedJob?.job?.company}</span>
                  {savedJob?.job?.location && <><span className="text-slate-300">•</span><span>{savedJob?.job?.location}</span></>}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Match Score */}
            <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-xl p-3 min-w-[100px]">
              {match?.matchScore !== undefined ? (
                <>
                  <span className={`text-3xl font-bold ${match?.matchScore >= 80 ? 'text-green-600' : match?.matchScore >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                    {match?.matchScore}%
                  </span>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Match</div>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-slate-500 mb-1 px-2">Not Analyzed</span>
                  <button 
                    onClick={handleAnalyzeJob}
                    disabled={generating === 'analysis'}
                    className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded font-semibold hover:bg-indigo-200 flex items-center gap-1"
                  >
                    {generating === 'analysis' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    Analyze Now
                  </button>
                </>
              )}
            </div>
            
            {/* Readiness */}
            <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-xl p-3 min-w-[100px]">
              <span className="text-3xl font-bold text-indigo-600">{readiness}%</span>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Readiness</div>
            </div>

            {/* Apply Action */}
            <div className="flex flex-col gap-2">
              <a 
                href={savedJob?.job?.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2 justify-center"
              >
                Apply Externally <ExternalLink className="w-4 h-4" />
              </a>
              {app?.status !== 'APPLIED' && (
                <button 
                  onClick={markAsApplied}
                  className="px-6 py-2 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 font-medium rounded-lg transition-colors flex items-center gap-2 justify-center text-sm"
                >
                  <CheckCircle2 className="w-4 h-4" /> Mark as Applied
                </button>
              )}
            </div>
          </div>
        </div>
        
        {reasons.length > 0 && (
          <div className="bg-amber-50 border-t border-amber-100 p-4 px-8 flex items-start gap-3 text-sm text-amber-800">
            <Info className="w-5 h-5 shrink-0 text-amber-600" />
            <div>
              <span className="font-semibold">To improve readiness: </span>
              {reasons.join(', ')}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Requirements & Job Desc */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" /> Fit Analysis
            </h2>
            {match?.matchScore === undefined ? (
              <p className="text-sm text-slate-500 italic">Analyze the job to see requirements fit.</p>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-700 leading-relaxed font-medium">{match?.matchExplanation}</p>
                <div>
                  <h4 className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">Matched</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {match?.matchedSkills?.map(s => <span key={s} className="px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded border border-green-100">{s}</span>)}
                  </div>
                </div>
                {match?.missingRequiredSkills && match?.missingRequiredSkills.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">Missing Requirements</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {match?.missingRequiredSkills.map(s => <span key={s} className="px-2 py-1 bg-red-50 text-red-700 text-xs font-medium rounded border border-red-100">{s}</span>)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-500" /> Job Description
            </h2>
            <div className="prose prose-sm max-w-none text-slate-600 whitespace-pre-wrap line-clamp-[20] overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
              {savedJob?.job?.description}
            </div>
          </div>
        </div>

        {/* Right Column: Generation Tools */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Custom Answers Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-indigo-600" /> Application Questions</h2>
              <button 
                onClick={handleGenerateAnswers}
                disabled={generating === 'answers'}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <RefreshCw className={`w-4 h-4 ${generating === 'answers' ? 'animate-spin' : ''}`} /> 
                {Object.keys(answers).length > 0 ? 'Regenerate Answers' : 'Generate Answers'}
              </button>
            </div>
            
            {Object.keys(answers).length === 0 && generating !== 'answers' ? (
              <div className="text-center p-8 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                Click generate to automatically create tailored answers to common application questions based on your profile.
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(answers).map(([key, val]) => (
                  <div key={key}>
                    <label className="block text-sm font-semibold text-slate-700 mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                    <textarea 
                      value={val}
                      onChange={(e) => setAnswers({...answers, [key]: e.target.value})}
                      className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[80px]"
                    />
                  </div>
                ))}
                {Object.keys(answers).length > 0 && (
                  <div className="flex justify-end mt-4">
                    <button onClick={() => saveJobState({ applicationAnswers: answers })} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded-lg flex items-center gap-2 text-sm">
                      <Save className="w-4 h-4" /> Save Edits
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Resume Tailoring Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-600" /> Resume Optimization</h2>
              <button 
                onClick={handleTailorResume}
                disabled={generating === 'tailor'}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <RefreshCw className={`w-4 h-4 ${generating === 'tailor' ? 'animate-spin' : ''}`} /> 
                {improvements.length > 0 ? 'Regenerate Suggestions' : 'Tailor Resume'}
              </button>
            </div>
            
            {improvements.length === 0 && generating !== 'tailor' ? (
              <div className="text-center p-8 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                Generate suggestions to optimize your resume bullets for this specific role.
              </div>
            ) : (
              <div className="space-y-6">
                {improvements.map((imp, idx) => (
                  <div key={idx} className={`p-4 border rounded-xl ${imp.status === 'ACCEPTED' ? 'bg-green-50 border-green-200' : imp.status === 'REJECTED' ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-2">
                        Targeting Keyword: {imp.keywordTarget || 'General Fit'}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => {
                          const next = [...improvements];
                          next[idx].status = 'ACCEPTED';
                          setImprovements(next);
                        }} className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded hover:bg-green-200">Accept</button>
                        <button onClick={() => {
                          const next = [...improvements];
                          next[idx].status = 'REJECTED';
                          setImprovements(next);
                        }} className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded hover:bg-slate-200">Reject</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Original</div>
                        <div className="text-sm text-slate-700 line-through opacity-70">{imp.original}</div>
                      </div>
                      <div>
                        <div className="text-xs text-green-600 font-semibold mb-1">Suggested</div>
                        <div className="text-sm text-slate-900 font-medium">{imp.suggested}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-slate-600 bg-slate-100 p-2 rounded">
                      <span className="font-semibold">Reason:</span> {imp.reason}
                    </div>
                  </div>
                ))}
                {improvements.length > 0 && (
                  <button onClick={() => {
                    const next = improvements.map(i => ({...i, status: 'ACCEPTED' as const}));
                    setImprovements(next);
                  }} className="w-full py-2 bg-indigo-50 text-indigo-700 rounded-lg font-medium hover:bg-indigo-100 text-sm mt-4">
                    Accept All Suggestions
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Cover Letter Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><FileSignature className="w-5 h-5 text-indigo-600" /> Cover Letter</h2>
              <div className="flex gap-4">
                {coverLetter && (
                  <button onClick={() => navigator.clipboard.writeText(coverLetter)} className="text-sm font-medium text-slate-600 hover:text-slate-800">
                    Copy Text
                  </button>
                )}
                <button 
                  onClick={handleGenerateCoverLetter}
                  disabled={generating === 'coverLetter'}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <RefreshCw className={`w-4 h-4 ${generating === 'coverLetter' ? 'animate-spin' : ''}`} /> 
                  {coverLetter ? 'Regenerate' : 'Generate Cover Letter'}
                </button>
              </div>
            </div>
            
            {!coverLetter && generating !== 'coverLetter' ? (
              <div className="text-center p-8 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                Generate a concise, job-specific cover letter using your profile information.
              </div>
            ) : (
              <div>
                <textarea 
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  className="w-full p-4 border border-slate-300 rounded-lg text-sm text-slate-700 min-h-[300px] focus:ring-2 focus:ring-indigo-500 focus:outline-none mb-4 font-mono leading-relaxed"
                />
                {coverLetter && (
                  <div className="flex justify-end">
                    <button onClick={() => saveJobState({ coverLetter })} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded-lg flex items-center gap-2 text-sm">
                      <Save className="w-4 h-4" /> Save Edits
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
