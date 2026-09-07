import { Router, Request, Response } from 'express';
import { createOAuthState, validateAndConsumeOAuthState, isValidInternalRedirectPath } from '../oauthState.js';
import { linkedinConnectionService } from '../services/linkedinConnectionService.js';
import { buildLinkedInJobsUrl, isValidLinkedInUrl, linkedinJobDiscoveryService } from '../../src/services/linkedinService.js';
import { LinkedInConnection, LinkedInStatusResponse } from '../../src/types.js';
import { requireAuth } from '../auth.js';

export const linkedinRouter = Router();

const DEFAULT_SCOPES = 'openid profile email';

/**
 * Sanitizes and trims any incoming parameter string to prevent excessively large inputs or HTML injection.
 */
function sanitizeInputString(val: any, maxLength: number, fieldName: string): string | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'string') {
    throw new Error(`Invalid ${fieldName}: must be a string`);
  }
  const trimmed = val.trim();
  if (trimmed.length > maxLength) {
    throw new Error(`Invalid ${fieldName}: length exceeds maximum of ${maxLength} characters`);
  }
  // Remove possible script or HTML tags
  return trimmed.replace(/[<>]/g, '');
}

/**
 * Performs strict structural and content validation on search filters.
 */
function validateAndSanitizeSearchCriteria(criteria: any): any {
  if (!criteria || typeof criteria !== 'object') {
    throw new Error('Invalid criteria payload: expected an object');
  }
  
  const sanitized: any = {};
  
  if (criteria.keywords !== undefined) sanitized.keywords = sanitizeInputString(criteria.keywords, 150, 'keywords');
  if (criteria.jobTitle !== undefined) sanitized.jobTitle = sanitizeInputString(criteria.jobTitle, 150, 'jobTitle');
  if (criteria.location !== undefined) sanitized.location = sanitizeInputString(criteria.location, 150, 'location');
  if (criteria.experience !== undefined) sanitized.experience = sanitizeInputString(criteria.experience, 100, 'experience');
  if (criteria.experienceLevel !== undefined) sanitized.experienceLevel = sanitizeInputString(criteria.experienceLevel, 100, 'experienceLevel');
  if (criteria.workMode !== undefined) sanitized.workMode = sanitizeInputString(criteria.workMode, 100, 'workMode');
  if (criteria.remote !== undefined) {
    if (typeof criteria.remote === 'boolean') {
      sanitized.remote = criteria.remote;
    } else {
      sanitized.remote = sanitizeInputString(criteria.remote, 50, 'remote');
    }
  }
  if (criteria.jobType !== undefined) sanitized.jobType = sanitizeInputString(criteria.jobType, 100, 'jobType');
  if (criteria.employmentType !== undefined) sanitized.employmentType = sanitizeInputString(criteria.employmentType, 100, 'employmentType');
  if (criteria.sortBy !== undefined) sanitized.sortBy = sanitizeInputString(criteria.sortBy, 50, 'sortBy');
  if (criteria.query !== undefined) sanitized.query = sanitizeInputString(criteria.query, 150, 'query');
  
  return sanitized;
}

/**
 * Derives the exact OAuth callback URI.
 * Matches the LinkedIn Developer Portal configured redirect URI.
 */
function getRedirectUri(req: Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:3000';
  const currentDomain = `${proto}://${host}`;

  if (process.env.LINKEDIN_REDIRECT_URI && process.env.LINKEDIN_REDIRECT_URI.trim()) {
    const configUri = process.env.LINKEDIN_REDIRECT_URI.trim();
    try {
      const configUrlObj = new URL(configUri);
      const currentHostOnly = host.split(':')[0];
      const configHostOnly = configUrlObj.hostname;
      
      if (configHostOnly !== currentHostOnly) {
        console.warn(`[OAuth Redirect URI Bypass] Configured redirect host (${configHostOnly}) does not match current host (${currentHostOnly}). Routing dynamically back to active app container.`);
        return `${currentDomain}/api/linkedin/auth/callback`;
      }
    } catch {
      // If config URI is malformed, fall through to default
    }
    return configUri;
  }

  if (process.env.APP_URL && process.env.APP_URL.trim()) {
    try {
      const appUrlHost = new URL(process.env.APP_URL).hostname;
      const currentHostOnly = host.split(':')[0];
      if (appUrlHost === currentHostOnly) {
        return `${process.env.APP_URL.replace(/\/+$/, '')}/api/linkedin/auth/callback`;
      }
    } catch {}
  }

  return `${currentDomain}/api/linkedin/auth/callback`;
}

/**
 * GET /api/linkedin/status
 * Returns current configuration and connection state for the user.
 * Validates only the required configuration:
 * LINKEDIN_ENABLED, LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI, LINKEDIN_SCOPES.
 */
linkedinRouter.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
    const isExplicitlyDisabled = process.env.LINKEDIN_ENABLED === 'false';
    const isEnabled = !isExplicitlyDisabled && !!(clientId || clientSecret || process.env.LINKEDIN_ENABLED === 'true');
    const redirectUri = getRedirectUri(req);
    const scopes = (process.env.LINKEDIN_SCOPES || DEFAULT_SCOPES).trim();
    
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User session is missing' });
    }

    let connection: LinkedInConnection | null = null;
    connection = await linkedinConnectionService.getConnection(userId);

    const isConnected = connection ? connection.status === 'CONNECTED' : false;

    let isConfigured = false;
    let configError: string | null = null;
    let oauthStatus: 'DISABLED' | 'NOT_CONFIGURED' | 'READY' | 'CONNECTED' | 'ERROR';

    if (!isEnabled) {
      isConfigured = false;
      oauthStatus = 'DISABLED';
    } else {
      const missing: string[] = [];
      if (!clientId) missing.push('LINKEDIN_CLIENT_ID');
      if (!clientSecret) missing.push('LINKEDIN_CLIENT_SECRET');

      if (missing.length > 0) {
        isConfigured = false;
        oauthStatus = 'NOT_CONFIGURED';
        configError = `LinkedIn OAuth is enabled (LINKEDIN_ENABLED=true), but missing required credentials: ${missing.join(', ')}.`;
      } else {
        isConfigured = true;
        oauthStatus = isConnected ? 'CONNECTED' : 'READY';
      }
    }

    // Fallback/safety check
    if (oauthStatus !== 'DISABLED' && oauthStatus !== 'NOT_CONFIGURED' && oauthStatus !== 'CONNECTED' && oauthStatus !== 'READY') {
      oauthStatus = 'ERROR';
    }

    const jobDiscoveryStatus = 'EXTERNAL_SEARCH_AVAILABLE';

    const response: LinkedInStatusResponse & { oauthStatus: string; jobDiscoveryStatus: string } = {
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
      account: connection || undefined,
      oauthStatus,
      jobDiscoveryStatus
    };

    res.json(response);
  } catch (error: any) {
    console.error('Failed to get LinkedIn status:', error?.message);
    res.status(500).json({ error: 'Failed to retrieve LinkedIn integration status' });
  }
});

/**
 * GET /api/linkedin/auth/start
 * Generates OAuth state with CSRF protection and returns official LinkedIn authorization URL.
 */
linkedinRouter.get('/auth/start', requireAuth, async (req: Request, res: Response) => {
  try {
    const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
    const isExplicitlyDisabled = process.env.LINKEDIN_ENABLED === 'false';
    const isEnabled = !isExplicitlyDisabled && !!(clientId || clientSecret || process.env.LINKEDIN_ENABLED === 'true');

    if (!isEnabled) {
      return res.status(200).json({
        configured: false,
        error: 'LinkedIn OAuth integration is currently disabled (LINKEDIN_ENABLED=false). Set LINKEDIN_ENABLED=true in your environment to enable.',
        authUrl: null
      });
    }

    if (!clientId || !clientSecret) {
      const missing: string[] = [];
      if (!clientId) missing.push('LINKEDIN_CLIENT_ID');
      if (!clientSecret) missing.push('LINKEDIN_CLIENT_SECRET');
      return res.status(200).json({
        configured: false,
        error: `LinkedIn OAuth is enabled, but missing required credentials: ${missing.join(', ')}.`,
        authUrl: null
      });
    }

    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User session is missing' });
    }

    // Input validation for redirectPath
    const requestedRedirectPath = (req.query.redirectPath as string) || '/find-jobs';
    const sanitizedRedirectPath = sanitizeInputString(requestedRedirectPath, 250, 'redirectPath') || '/find-jobs';
    if (!isValidInternalRedirectPath(sanitizedRedirectPath)) {
      return res.status(400).json({ error: 'Invalid redirect path provided. Open redirects are strictly prohibited.' });
    }

    const redirectUri = getRedirectUri(req);
    const state = await createOAuthState(userId, sanitizedRedirectPath);
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
    console.error('Failed to start LinkedIn OAuth flow:', error?.message);
    res.status(500).json({ error: 'Failed to initiate LinkedIn authorization' });
  }
});

/**
 * Helper to determine the trusted origin for postMessage popup security.
 */
function getAppOrigin(req: Request): string {
  if (process.env.APP_URL && process.env.APP_URL.trim()) {
    return process.env.APP_URL.trim().replace(/\/+$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

/**
 * GET /api/linkedin/auth/callback
 * Server-side authorization code exchange with CSRF protection and popup postMessage handler.
 */
const callbackHandler = async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const error = req.query.error as string | undefined;
  const errorDescription = req.query.error_description as string | undefined;

  const targetOrigin = getAppOrigin(req);

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
          window.opener.postMessage(payload, ${JSON.stringify(targetOrigin)});
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

  // Atomically validate and consume the state token
  const validation = await validateAndConsumeOAuthState(state);
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
      console.error('LinkedIn token exchange failed with status:', tokenRes.status);
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
    } catch (profileErr: any) {
      console.warn('Could not fetch LinkedIn profile details:', profileErr?.message);
    }

    const userId = validation.userId;
    if (!userId) {
      return res.status(400).send(renderPopupScript({
        type: 'LINKEDIN_AUTH_ERROR',
        error: 'Security validation failed: State token is not bound to a valid user session.'
      }));
    }

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
    console.error('LinkedIn OAuth callback handling exception:', err?.message);
    return res.status(500).send(renderPopupScript({
      type: 'LINKEDIN_AUTH_ERROR',
      error: 'Unexpected failure during OAuth callback processing.'
    }));
  }
};

linkedinRouter.get('/auth/callback', callbackHandler);
linkedinRouter.get('/auth/callback/', callbackHandler);

/**
 * POST /api/linkedin/auth/revoke
 * Revokes LinkedIn OAuth session.
 */
linkedinRouter.post('/auth/revoke', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User session is missing' });
    }

    await linkedinConnectionService.revokeConnection(userId);
    res.json({ success: true, message: 'LinkedIn connection revoked successfully' });
  } catch (error: any) {
    console.error('Failed to revoke LinkedIn connection:', error?.message);
    res.status(500).json({ error: 'Failed to revoke LinkedIn connection' });
  }
});

/**
 * POST /api/linkedin/disconnect
 * Alias for disconnect.
 */
linkedinRouter.post('/disconnect', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User session is missing' });
    }

    await linkedinConnectionService.revokeConnection(userId);
    res.json({ success: true, message: 'LinkedIn connection revoked successfully' });
  } catch (error: any) {
    console.error('Failed to disconnect LinkedIn:', error?.message);
    res.status(500).json({ error: 'Failed to disconnect LinkedIn' });
  }
});

/**
 * POST /api/linkedin/search
 * Generates official LinkedIn Search Destination URL based on user criteria.
 * Uses URLSearchParams, zero scraping, and zero third-party API credentials.
 */
linkedinRouter.post('/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const rawCriteria = req.body || {};
    const criteria = validateAndSanitizeSearchCriteria(rawCriteria);
    const discoveryResult = await linkedinJobDiscoveryService.discoverJobs(criteria);

    return res.json({
      ...discoveryResult,
      provider: 'linkedin',
    });
  } catch (error: any) {
    console.error('LinkedIn search error:', error?.message);
    res.status(400).json({ error: error?.message || 'Failed to process LinkedIn search' });
  }
});

/**
 * GET /api/linkedin/jobs/:id
 * Generates direct view link to the official LinkedIn job posting.
 */
linkedinRouter.get('/jobs/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    if (!idParam || typeof idParam !== 'string' || idParam.length > 50 || !/^[a-zA-Z0-9_\-]+$/.test(idParam)) {
      return res.status(400).json({ error: 'Invalid Job ID format' });
    }
    const cleanId = idParam.replace(/^li_/, '');
    const officialUrl = `https://www.linkedin.com/jobs/view/${encodeURIComponent(cleanId)}`;

    return res.json({
      id: idParam,
      url: officialUrl,
      source: 'LinkedIn',
      message: 'Job details are viewed directly on the official LinkedIn job posting page.'
    });
  } catch (error: any) {
    console.error('LinkedIn get job details error:', error?.message);
    res.status(500).json({ error: 'Failed to retrieve job details' });
  }
});

/**
 * POST /api/linkedin/search-url
 * Validates criteria and returns official LinkedIn Jobs URL.
 */
linkedinRouter.post('/search-url', requireAuth, (req: Request, res: Response) => {
  try {
    const rawCriteria = req.body || {};
    const criteria = validateAndSanitizeSearchCriteria(rawCriteria);
    const url = buildLinkedInJobsUrl(criteria);
    if (!isValidLinkedInUrl(url)) {
      return res.status(400).json({ error: 'Invalid LinkedIn URL generated' });
    }
    res.json({ url, criteria });
  } catch (error: any) {
    console.error('LinkedIn search URL generation error:', error?.message);
    res.status(400).json({ error: error?.message || 'Failed to generate LinkedIn search URL' });
  }
});

