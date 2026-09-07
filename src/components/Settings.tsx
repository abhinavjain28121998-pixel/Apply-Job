import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { Sliders, Database, Server, RefreshCw, KeyRound, CheckCircle } from 'lucide-react';
import { isFirebaseConfigured } from '../firebase';
import { safeFetchJson } from '../lib/api';

export default function Settings() {
  const { user } = useAuth();
  const [dbStatus, setDbStatus] = useState<any>({ configured: false, type: 'Local Storage' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkDb = async () => {
      const hasFirebase = isFirebaseConfigured();
      setDbStatus({
        configured: hasFirebase,
        type: hasFirebase ? 'Firebase Firestore (Durable Cloud Database)' : 'Browser Local Storage (Transient Mock)'
      });
      setLoading(false);
    };
    checkDb();
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Settings</h1>
        <p className="text-slate-600">
          Configure application preferences and inspect data storage status.
        </p>
      </div>

      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
            <Database className="w-5 h-5 text-indigo-600" />
            Data Persistence Status
          </h3>
          <div className="space-y-4 text-sm text-slate-700">
            <div className="flex justify-between items-center p-4 border rounded-lg bg-slate-50">
              <div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Active Storage Engine</div>
                <div className="font-bold text-slate-800 mt-0.5">{dbStatus.type}</div>
              </div>
              <div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${dbStatus.configured ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {dbStatus.configured ? 'Durable Cloud' : 'Local Sandbox'}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              When configured with Firebase, all data including your profile history, resume text, matching score analytics, and application status states are persisted securely to your private database schema.
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
            <KeyRound className="w-5 h-5 text-indigo-600" />
            API & Privacy Guardrails
          </h3>
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span><strong>Gemini API Protection</strong>: API keys are strictly managed server-side and never exposed to the client interface.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span><strong>Zero Scrapers</strong>: No automated requests, Puppeteer nodes, or credential sniffers are deployed against LinkedIn hosts.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span><strong>Private Sandbox</strong>: All uploaded files and analyses are strictly bound to your private user authentication UID.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
