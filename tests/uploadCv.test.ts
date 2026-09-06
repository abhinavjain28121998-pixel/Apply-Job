import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { createApiApp } from '../server.js';
import { _setFirebaseAuth } from '../server/firebaseAdmin.js';
import { getDemoAuthToken } from '../server/auth.js';

describe('CV Upload & Parser API Tests (/api/upload-cv)', () => {
  const originalEnv = process.env;
  let server: http.Server;
  let baseUrl: string;
  const validDemoToken = getDemoAuthToken();

  beforeEach(async () => {
    process.env = { ...originalEnv, NODE_ENV: 'test', ALLOW_DEMO_AUTH: 'true' };
    _setFirebaseAuth({
      verifyIdToken: vi.fn().mockResolvedValue({ uid: 'test-user-123' })
    } as any);

    const app = createApiApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as any;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    process.env = originalEnv;
    _setFirebaseAuth(null);
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('rejects unauthenticated upload requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/upload-cv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'test.pdf', base64Data: 'abc' })
    });

    expect(res.status).toBe(401);
  });

  it('rejects upload with missing base64Data with 400', async () => {
    const res = await fetch(`${baseUrl}/api/upload-cv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validDemoToken}`
      },
      body: JSON.stringify({ filename: 'test.pdf' })
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Missing or invalid base64Data');
  });

  it('rejects empty file content with 400', async () => {
    const res = await fetch(`${baseUrl}/api/upload-cv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validDemoToken}`
      },
      body: JSON.stringify({ filename: 'empty.txt', base64Data: '' })
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Missing or invalid base64Data');
  });

  it('successfully extracts plain text and markdown CV content', async () => {
    const cvContent = `John Doe\nSenior Frontend Engineer\nSkills: React, TypeScript, TailwindCSS\nExperience: 6 years building high performance web applications.`;
    const base64 = Buffer.from(cvContent, 'utf-8').toString('base64');

    const res = await fetch(`${baseUrl}/api/upload-cv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validDemoToken}`
      },
      body: JSON.stringify({
        filename: 'resume.txt',
        mimeType: 'text/plain',
        base64Data: `data:text/plain;base64,${base64}`
      })
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.text).toContain('John Doe');
    expect(data.text).toContain('Senior Frontend Engineer');
    expect(data.wordCount).toBeGreaterThan(5);
    expect(data.filename).toBe('resume.txt');
  });

  it('successfully handles base64 data without data-uri prefix', async () => {
    const cvContent = `Jane Smith\nStaff DevOps Engineer\nDocker, Kubernetes, Terraform, GCP`;
    const base64 = Buffer.from(cvContent, 'utf-8').toString('base64');

    const res = await fetch(`${baseUrl}/api/upload-cv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validDemoToken}`
      },
      body: JSON.stringify({
        filename: 'cv.md',
        mimeType: 'text/markdown',
        base64Data: base64
      })
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.text).toContain('Jane Smith');
    expect(data.text).toContain('Staff DevOps Engineer');
  });

  it('rejects files larger than 10MB limit with 400', async () => {
    // 11MB buffer base64 string
    const oversized = Buffer.alloc(11 * 1024 * 1024).toString('base64');

    const res = await fetch(`${baseUrl}/api/upload-cv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validDemoToken}`
      },
      body: JSON.stringify({
        filename: 'large.pdf',
        mimeType: 'application/pdf',
        base64Data: oversized
      })
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('10MB');
  });

  it('successfully extracts text from uploaded .docx Word document', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Sarah Connor - Cybernetic Security Lead. Experience with defense networks and Linux systems.</w:t></w:r></w:p></w:body></w:document>');
    
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const base64Data = buffer.toString('base64');

    const res = await fetch(`${baseUrl}/api/upload-cv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validDemoToken}`
      },
      body: JSON.stringify({
        filename: 'Sarah_Connor_Resume.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        base64Data
      })
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.text).toContain('Sarah Connor - Cybernetic Security Lead');
    expect(data.text).toContain('defense networks and Linux systems');
    expect(data.parseMethod).toBe('docx');
    expect(data.filename).toBe('Sarah_Connor_Resume.docx');
  });
});
