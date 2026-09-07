import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { LinkedInStatusResponse } from '../types';
import { linkedinAuthService } from '../services/linkedinAuthService';
import { Linkedin, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';

export default function LinkedInConnection() {
  const { user, getToken } = useAuth();
  const [linkedInStatus, setLinkedInStatus] = useState<LinkedInStatusResponse | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refreshStatus = async () => {
    if (!user) return;
    try {
      const token = await getToken();
      if (!token) return;
      const status = await linkedinAuthService.getStatus(token);
      setLinkedInStatus(status);
    } catch (e) {
      console.warn('Failed to retrieve LinkedIn status:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, [user]);

  const handleConnect = async () => {
    if (!user) return;
    setConnecting(true);
    setMessage(null);
    try {
      const token = await getToken();
      if (!token) {
        setMessage('Failed to authenticate. Please try again.');
        return;
      }
      const startRes = await linkedinAuthService.getAuthStart(token, '/profile');
      if (!startRes.configured || !startRes.authUrl) {
        setMessage(
          startRes.error ||
          'LinkedIn OAuth integration is currently not configured on this host. Direct, robust job discovery via pre-filtered URL generation is fully active and ready.'
        );
        return;
      }

      await linkedinAuthService.openAuthPopup(startRes.authUrl);
      setMessage('Successfully connected your LinkedIn profile via OpenID Connect!');
      await refreshStatus();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      const msg = err?.message || 'LinkedIn authorization was canceled or failed.';
      setMessage(msg);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;
    setMessage(null);
    try {
      const token = await getToken();
      if (!token) return;
      await safeFetchJson('/api/linkedin/disconnect', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setMessage('Successfully disconnected LinkedIn connection.');
      await refreshStatus();
    } catch (err) {
      console.error(err);
      setMessage('Failed to disconnect LinkedIn connection.');
    }
  };

  const safeFetchJson = async (url: string, init?: RequestInit) => {
    try {
      const res = await fetch(url, init);
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        return {
          ok: false,
          error: `Non-JSON response (HTTP ${res.status}): ${text.slice(0, 100) || 'Unknown gateway issue'}`
        };
      }
      const json = await res.json();
      return { ok: res.ok, data: json };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Network request failed' };
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  const isConnected = linkedInStatus?.connected && linkedInStatus?.account;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">LinkedIn Connection</h1>
        <p className="text-slate-600">
          Manage your secure LinkedIn OAuth OpenID Connect profile linkage.
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg text-sm font-medium border ${message.includes('Success') || message.includes('Successfully') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
          <div className="flex items-center gap-2">
            {message.includes('Success') || message.includes('Successfully') ? (
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span>{message}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Linkedin className="w-5 h-5 text-[#0A66C2]" />
                <h2 className="font-bold text-slate-800 text-lg">Connection Status</h2>
              </div>
              <button 
                onClick={refreshStatus} 
                className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-full transition-colors"
                title="Refresh Status"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6">
              {isConnected ? (
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    {linkedInStatus.account?.pictureUrl ? (
                      <img 
                        src={linkedInStatus.account.pictureUrl} 
                        alt="Profile" 
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-full border-2 border-indigo-100 object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-xl border-2 border-indigo-100">
                        {linkedInStatus.account?.displayName?.charAt(0) || 'L'}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-slate-950 text-lg">{linkedInStatus.account?.displayName}</h3>
                      <p className="text-sm text-slate-500">{linkedInStatus.account?.email}</p>
                      <div className="flex items-center gap-1.5 text-xs text-green-600 font-semibold mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Profile Connected
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleDisconnect}
                    className="px-4 py-2 border border-red-200 hover:bg-red-50 text-red-600 font-medium text-sm rounded-lg transition-colors"
                  >
                    Disconnect Profile
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-14 h-14 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Linkedin className="w-7 h-7 text-slate-400" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-base mb-1">LinkedIn Profile Not Linked</h3>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
                    Connect your LinkedIn profile securely using OpenID Connect to unlock verified profile-matching criteria.
                  </p>
                  <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="inline-flex items-center gap-2 bg-[#0A66C2] hover:bg-[#004182] text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
                  >
                    {connecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Linkedin className="w-4 h-4" />}
                    <span>{connecting ? 'Connecting...' : 'Connect LinkedIn Profile'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Security & Scope Integrity
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              We connect exclusively to the official LinkedIn identity endpoints. Your LinkedIn password is <strong>never</strong> processed, and the credentials remain safely bound to your Firebase authenticated user.
            </p>
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="bg-slate-50 p-3 rounded-lg text-center border border-slate-100">
                <div className="font-bold text-xs text-slate-700">openid</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Secure SSO</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg text-center border border-slate-100">
                <div className="font-bold text-xs text-slate-700">r_liteprofile</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Avatar & Name</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg text-center border border-slate-100">
                <div className="font-bold text-xs text-slate-700">r_emailaddress</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Primary Email</div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-6">
            <h4 className="font-bold text-indigo-950 text-sm mb-3 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              Frequently Asked Questions
            </h4>
            <div className="space-y-4 text-xs leading-relaxed">
              <div>
                <h5 className="font-bold text-indigo-900 mb-1">Do you scrape my job history?</h5>
                <p className="text-indigo-800/80">
                  No, we do not scrape LinkedIn profiles. Profile details are extracted purely from the resume upload or entered manually to respect terms of service.
                </p>
              </div>
              <div>
                <h5 className="font-bold text-indigo-900 mb-1">Why do I need a connection?</h5>
                <p className="text-indigo-800/80">
                  Linking your profile verifies ownership and secures application history scoped to your authenticated LinkedIn member ID.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
