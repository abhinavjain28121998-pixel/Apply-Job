import { LinkedInStatusResponse, LinkedInConnection, LinkedInSearchCriteria } from '../types';
import { buildLinkedInJobsUrl } from './linkedinService';

export const linkedinAuthService = {
  /**
   * Fetches LinkedIn integration status and connection details.
   */
  async getStatus(userId?: string): Promise<LinkedInStatusResponse> {
    try {
      const url = userId ? `/api/linkedin/status?userId=${encodeURIComponent(userId)}` : '/api/linkedin/status';
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Status check failed: ${res.status}`);
      }
      return await res.json();
    } catch (e: any) {
      return {
        configured: false,
        connected: false,
        jobSearchApiAvailable: false,
        scopes: ['openid', 'profile', 'email'],
        providerMode: 'SEARCH_DESTINATION_FALLBACK',
        message: 'Could not connect to LinkedIn integration service.'
      };
    }
  },

  /**
   * Requests authorization URL from server.
   */
  async getAuthStart(userId?: string): Promise<{ configured: boolean; authUrl?: string; state?: string; error?: string }> {
    const url = userId ? `/api/linkedin/auth/start?userId=${encodeURIComponent(userId)}` : '/api/linkedin/auth/start';
    const res = await fetch(url);
    return await res.json();
  },

  /**
   * Opens popup window for LinkedIn OAuth and waits for completion postMessage.
   */
  openAuthPopup(authUrl: string): Promise<LinkedInConnection> {
    return new Promise((resolve, reject) => {
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'linkedin_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},status=0,menubar=0,toolbar=0`
      );

      if (!popup) {
        reject(new Error('Popup blocked. Please allow popups for this site to sign in with LinkedIn.'));
        return;
      }

      let timeoutTimer: any;
      let checkTimer: any;

      const cleanup = () => {
        window.removeEventListener('message', handleMessage);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (checkTimer) clearInterval(checkTimer);
      };

      const handleMessage = (event: MessageEvent) => {
        if (!event.data || typeof event.data !== 'object') return;

        if (event.data.type === 'LINKEDIN_AUTH_SUCCESS') {
          cleanup();
          resolve(event.data.connection);
        } else if (event.data.type === 'LINKEDIN_AUTH_ERROR') {
          cleanup();
          reject(new Error(event.data.error || 'LinkedIn authentication failed.'));
        }
      };

      window.addEventListener('message', handleMessage);

      // Handle user manually closing popup
      checkTimer = setInterval(() => {
        if (popup.closed) {
          cleanup();
          reject(new Error('Authentication window closed before completion.'));
        }
      }, 1000);

      // 5-minute timeout
      timeoutTimer = setTimeout(() => {
        cleanup();
        if (!popup.closed) popup.close();
        reject(new Error('LinkedIn authentication timed out.'));
      }, 5 * 60 * 1000);
    });
  },

  /**
   * Revokes LinkedIn connection for user.
   */
  async disconnect(userId: string): Promise<void> {
    await fetch('/api/linkedin/auth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
  },

  /**
   * Generates official LinkedIn Jobs search URL with verified parameters.
   */
  generateSearchUrl(criteria: LinkedInSearchCriteria): string {
    return buildLinkedInJobsUrl(criteria);
  }
};
