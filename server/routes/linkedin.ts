import { Router, Request, Response } from 'express';
import { createOAuthState, validateAndConsumeOAuthState } from '../oauthState.js';
import { linkedinConnectionService } from '../services/linkedinConnectionService.js';
import { buildLinkedInJobsUrl, isValidLinkedInUrl, linkedinJobDiscoveryService } from '../../src/services/linkedinService.js';
import { LinkedInConnection, LinkedInStatusResponse } from '../../src/types.js';

export const linkedinRouter = Router();

const DEFAULT_SCOPES = 'openid profile email';

/**
 * Derives the exact OAuth callback URI.
 * Matches the LinkedIn Developer Portal configured redirect URI.
 */
function getRedirectUri(req: Request): string {
  if (process.env.LINKEDIN_REDIRECT_URI && process.env.LINKEDIN_REDIRECT_URI.trim()) {
    return process.env.LINKEDIN_REDIRECT_URI.trim();
  }
  if (process.env.APP_URL && process.env.APP_URL.trim()) {
    return `${process.env.APP_URL.replace(/\/+$/, '')}/api/linkedin/auth/callback`;
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:3000';
  return `${proto}://${host}/api/linkedin/auth/callback`;
}

/**
 * GET /api/linkedin/status
 * Returns current configuration and connection state for the user.
 * Validates only the required configuration:
 * LINKEDIN_ENABLED, LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI, LINKEDIN_SCOPES.
 */
linkedinRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const isEnabled = process.env.LINKEDIN_ENABLED === 'true';
    const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
    const redirectUri = getRedirectUri(req);
    const scopes = (process.env.LINKEDIN_SCOPES || DEFAULT_SCOPES).trim();
    const userId = (req.query.userId as string) || (req as any).user?.uid || '';

    let connection: LinkedInConnection | null = null;
    if (userId) {
      connection = await linkedinConnectionService.getConnection(userId);
    }

    const isConnected = connection ? connection.status === 'CONNECTED' : false;

    let isConfigured = false;
    let configError: string | null = null;

    if (!isEnabled) {
      isConfigured = false;
    } else {
      const missing: string[] = [];
      if (!clientId) missing.push('LINKEDIN_CLIENT_ID');
      if (!clientSecret) missing.push('LINKEDIN_CLIENT_SECRET');

      if (missing.length > 0) {
        isConfigured = false;
        configError = `LinkedIn OAuth is enabled (LINKEDIN_ENABLED=true), but missing required credentials: ${missing.join(', ')}.`;
      } else {
        isConfigured = true;
      }
    }

    const response: LinkedInStatusResponse = {
      enabled: isEnabled,
      configured: isConfigured,
      connected: isConnected,
      jobSearchApiAvailable: false,
      scopes: scopes.split(/\s+/),
      redirectUri,
      configError,
      lastConnected: connection?.connectedAt,
      providerMode: 'SEARCH_DESTINATION_FALLBACK',
      message: !isEnabled
        ? 'LinkedIn OAuth sign-in is disabled (LINKEDIN_ENABLED=false). Job discovery is active via official "Search on LinkedIn" search URLs.'
        : !isConfigured
        ? (configError || 'LinkedIn OAuth credentials are not fully configured.')
        : isConnected
        ? 'LinkedIn OpenID Connect account is connected.'
        : 'LinkedIn OAuth is configured and ready to connect.',
      displayName: connection?.displayName,
      email: connection?.email,
      pictureUrl: connection?.pictureUrl,
      account: connection || undefined
    };

    res.json(response);
  } catch (error: any) {
    console.error('Failed to get LinkedIn status:', error);
    res.status(500).json({ error: 'Failed to retrieve LinkedIn integration status' });
  }
});

/**
 * GET /api/linkedin/auth/start
 * Generates OAuth state with CSRF protection and returns official LinkedIn authorization URL.
 */
linkedinRouter.get('/auth/start', async (req: Request, res: Response) => {
  try {
    const isEnabled = process.env.LINKEDIN_ENABLED === 'true';
    if (!isEnabled) {
      return res.status(200).json({
        configured: false,
        error: 'LinkedIn OAuth integration is currently disabled (LINKEDIN_ENABLED=false). Set LINKEDIN_ENABLED=true in your environment to enable.',
        authUrl: null
      });
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
      const missing: string[] = [];
      if (!clientId) missing.push('LINKEDIN_CLIENT_ID');
      if (!clientSecret) missing.push('LINKEDIN_CLIENT_SECRET');
      return res.status(200).json({
        configured: false,
        error: `LinkedIn OAuth is enabled (LINKEDIN_ENABLED=true), but missing required credentials: ${missing.join(', ')}.`,
        authUrl: null
      });
    }

    const userId = (req.query.userId as string) || (req as any).user?.uid || '';
    const redirectPath = (req.query.redirectPath as string) || '/find-jobs';
    const redirectUri = getRedirectUri(req);
    const state = createOAuthState(userId, redirectPath);
    const scopes = process.env.LINKEDIN_SCOPES || DEFAULT_SCOPES;

    const authUrlObj = new URL('https://www.linkedin.com/oauth/v2/authorization');
    authUrlObj.searchParams.set('response_type', 'code');
    authUrlObj.searchParams.set('client_id', clientId);
    authUrlObj.searchParams.set('redirect_uri', redirectUri);
    authUrlObj.searchParams.set('state', state);
    authUrlObj.searchParams.set('scope', scopes);

    res.json({
      configured: true,
      authUrl: authUrlObj.toString(),
      state,
      scopes: scopes.split(/\s+/),
      redirectUri
    });
  } catch (error: any) {
    console.error('Failed to start LinkedIn OAuth flow:', error);
    res.status(500).json({ error: 'Failed to initiate LinkedIn authorization' });
  }
});

/**
 * GET /api/linkedin/auth/callback & /api/linkedin/auth/callback/
 * Server-side authorization code exchange with CSRF protection and popup postMessage handler.
 */
const callbackHandler = async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const error = req.query.error as string | undefined;
  const errorDescription = req.query.error_description as string | undefined;

  const renderPopupScript = (payload: { type: string; error?: string; connection?: any }) => {
    const jsonString = JSON.stringify(payload).replace(/</g, '\\u003c');
    return `<!DOCTYPE html>
<html>
  <head>
    <title>LinkedIn Authentication</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
      .card { background: #ffffff; padding: 24px 32px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
      .spinner { border: 3px solid #e2e8f0; border-top: 3px solid #0a66c2; border-radius: 50%; width: 28px; height: 28px; animation: spin 1s linear infinite; margin: 0 auto 16px; }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="spinner"></div>
      <p id="msg">Processing authentication...</p>
    </div>
    <script>
      (function() {
        var payload = ${jsonString};
        var targetMsg = payload.error ? 'Authentication failed: ' + payload.error : 'Authentication completed!';
        document.getElementById('msg').textContent = targetMsg;
        
        if (window.opener) {
          window.opener.postMessage(payload, '*');
          setTimeout(function() { window.close(); }, 500);
        } else {
          setTimeout(function() { window.location.href = '/find-jobs'; }, 1500);
        }
      })();
    </script>
  </body>
</html>`;
  };

  if (error || errorDescription) {
    const errMsg = errorDescription || error || 'Authorization was cancelled or denied by user.';
    return res.status(200).send(renderPopupScript({ type: 'LINKEDIN_AUTH_ERROR', error: errMsg }));
  }

  if (!code || !state) {
    return res.status(400).send(renderPopupScript({ 
      type: 'LINKEDIN_AUTH_ERROR', 
      error: 'Missing required code or state parameter.' 
    }));
  }

  const validation = validateAndConsumeOAuthState(state);
  if (!validation.valid) {
    return res.status(400).send(renderPopupScript({ 
      type: 'LINKEDIN_AUTH_ERROR', 
      error: validation.reason || 'Invalid or expired state parameter (CSRF validation failed).' 
    }));
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return res.status(500).send(renderPopupScript({ 
      type: 'LINKEDIN_AUTH_ERROR', 
      error: 'LinkedIn OAuth credentials (LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET) are not configured on server.' 
    }));
  }

  try {
    const redirectUri = getRedirectUri(req);
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret
    });

    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: tokenParams.toString()
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error('LinkedIn token exchange failed:', tokenRes.status, errorText);
      return res.status(200).send(renderPopupScript({
        type: 'LINKEDIN_AUTH_ERROR',
        error: `LinkedIn rejected code exchange: ${tokenRes.status}`
      }));
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Fetch user info via OpenID Connect endpoint
    let profileData: any = {};
    try {
      const userinfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      if (userinfoRes.ok) {
        profileData = await userinfoRes.json();
      }
    } catch (profileErr) {
      console.warn('Could not fetch LinkedIn profile details:', profileErr);
    }

    const userId = validation.userId || `user_${Date.now()}`;
    const connection: LinkedInConnection = {
      userId,
      provider: 'linkedin',
      connectedAt: Date.now(),
      scopes: (process.env.LINKEDIN_SCOPES || DEFAULT_SCOPES).split(/\s+/),
      status: 'CONNECTED',
      linkedInMemberId: profileData.sub || profileData.id,
      displayName: profileData.name || [profileData.given_name, profileData.family_name].filter(Boolean).join(' ') || 'LinkedIn User',
      email: profileData.email,
      pictureUrl: profileData.picture
    };

    await linkedinConnectionService.saveConnection(connection);

    return res.status(200).send(renderPopupScript({
      type: 'LINKEDIN_AUTH_SUCCESS',
      connection
    }));
  } catch (err: any) {
    console.error('LinkedIn OAuth callback handling exception:', err);
    return res.status(500).send(renderPopupScript({
      type: 'LINKEDIN_AUTH_ERROR',
      error: err?.message || 'Unexpected failure during OAuth callback processing.'
    }));
  }
};

linkedinRouter.get('/auth/callback', callbackHandler);
linkedinRouter.get('/auth/callback/', callbackHandler);

/**
 * POST /api/linkedin/auth/revoke
 * Revokes LinkedIn OAuth session.
 */
linkedinRouter.post('/auth/revoke', async (req: Request, res: Response) => {
  try {
    const userId = req.body?.userId || (req as any).user?.uid;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    await linkedinConnectionService.revokeConnection(userId);
    res.json({ success: true, message: 'LinkedIn connection revoked successfully' });
  } catch (error: any) {
    console.error('Failed to revoke LinkedIn connection:', error);
    res.status(500).json({ error: 'Failed to revoke LinkedIn connection' });
  }
});

/**
 * POST /api/linkedin/disconnect
 * Alias for disconnect.
 */
linkedinRouter.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const userId = req.body?.userId || (req as any).user?.uid;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    await linkedinConnectionService.revokeConnection(userId);
    res.json({ success: true, message: 'LinkedIn connection revoked successfully' });
  } catch (error: any) {
    console.error('Failed to disconnect LinkedIn:', error);
    res.status(500).json({ error: 'Failed to disconnect LinkedIn' });
  }
});

/**
 * POST /api/linkedin/search
 * Generates official LinkedIn Search Destination URL based on user criteria.
 * Uses URLSearchParams, zero scraping, and zero third-party API credentials.
 */
linkedinRouter.post('/search', async (req: Request, res: Response) => {
  try {
    const criteria = req.body || {};
    const discoveryResult = await linkedinJobDiscoveryService.discoverJobs(criteria);

    return res.json({
      ...discoveryResult,
      provider: 'linkedin',
    });
  } catch (error: any) {
    console.error('LinkedIn search error:', error);
    res.status(400).json({ error: error?.message || 'Failed to process LinkedIn search' });
  }
});

/**
 * GET /api/linkedin/jobs/:id
 * Generates direct view link to the official LinkedIn job posting.
 */
linkedinRouter.get('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const cleanId = req.params.id.replace(/^li_/, '');
    const officialUrl = `https://www.linkedin.com/jobs/view/${encodeURIComponent(cleanId)}`;

    return res.json({
      id: req.params.id,
      url: officialUrl,
      source: 'LinkedIn',
      message: 'Job details are viewed directly on the official LinkedIn job posting page.'
    });
  } catch (error: any) {
    console.error('LinkedIn get job details error:', error);
    res.status(500).json({ error: error?.message || 'Failed to retrieve job details' });
  }
});

/**
 * POST /api/linkedin/search-url
 * Validates criteria and returns official LinkedIn Jobs URL.
 */
linkedinRouter.post('/search-url', (req: Request, res: Response) => {
  try {
    const criteria = req.body || {};
    const url = buildLinkedInJobsUrl(criteria);
    if (!isValidLinkedInUrl(url)) {
      return res.status(400).json({ error: 'Invalid LinkedIn URL generated' });
    }
    res.json({ url, criteria });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to generate LinkedIn search URL' });
  }
});
