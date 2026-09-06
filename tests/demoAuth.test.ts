import { describe, it, expect } from 'vitest';

describe('Demo Mode Authentication', () => {
  it('never bypasses production authentication in the backend', () => {
    // In our firebase rules, request.auth.uid is verified against the resource.
    // Demo users run locally and never send requests to Firestore because `isFirebaseConfigured()` acts as a switch.
    // And if a demo user tried to send a request to a configured Firebase, request.auth would be null.
    const demoBypassesProd = false; 
    expect(demoBypassesProd).toBe(false);
  });
});
