'use client';

import { useState } from 'react';

type SentEmail = {
  trackId: string;
  to: string;
  subject: string;
  status?: string;
  opened?: boolean;
  openCount?: number;
  clicked?: boolean;
  clickCount?: number;
  error?: string;
};

export default function Dashboard() {
  const [apiKey, setApiKey] = useState('job-founder-hunter-dev-key');
  const [baseUrl, setBaseUrl] = useState('https://job-found-exapi.vercel.app');
  const [to, setTo] = useState('gaurav07c@gmail.com');
  const [subject, setSubject] = useState('[TEST] Full Stack Engineer for Acme Startup');
  const [body, setBody] = useState('Hi Alex,\n\nI\'m Gaurav, a Full Stack Engineer currently building production applications with Node.js, TypeScript, React, Next.js, PostgreSQL, and Redis.\n\nI\'m exploring my next opportunity and wanted to reach out directly. If Acme Startup is hiring now—or expects to hire in the coming months—I would love to be considered.\n\nResume: https://resume-lemon-rho.vercel.app/\n\nThanks for your time.\n\nBest,\nGaurav Kumar\ngaurav07c@gmail.com');
  const [sent, setSent] = useState<SentEmail[]>([]);
  const [queueCounts, setQueueCounts] = useState({ waiting: 0, active: 0, completed: 0, failed: 0 });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function headers() {
    return { 'x-api-key': apiKey, 'Content-Type': 'application/json' };
  }

  async function loadSent() {
    setStatus('Loading sent emails...');
    try {
      const res = await fetch(`${baseUrl}/api/sent`, { headers: await headers() });
      const data = await res.json();
      if (data.success) setSent(data.sent || []);
      else setStatus('Failed to load sent: ' + (data.message || ''));
    } catch (e: any) {
      setStatus('Error: ' + e.message);
    }
  }

  async function loadQueue() {
    try {
      const res = await fetch(`${baseUrl}/api/queue`, { headers: await headers() });
      const data = await res.json();
      if (data.success) setQueueCounts(data.counts || { waiting: 0, active: 0, completed: 0, failed: 0 });
    } catch {}
  }

  async function sendTest() {
    setLoading(true);
    setStatus('Sending test mail...');
    try {
      const res = await fetch(`${baseUrl}/api/send`, {
        method: 'POST',
        headers: await headers(),
        body: JSON.stringify({ to, subject, body }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus(`✅ Sent ${data.queued} email(s). Tracking active.`);
        await loadSent();
        await loadQueue();
      } else {
        setStatus('❌ ' + (data.message || 'Failed'));
      }
    } catch (e: any) {
      setStatus('❌ ' + e.message);
    }
    setLoading(false);
  }

  async function testPixel(trackId: string) {
    try {
      await fetch(`${baseUrl}/api/track/open?id=${trackId}`);
      setStatus('✅ Pixel hit recorded. Refresh sent list to see open count.');
      await loadSent();
    } catch (e: any) {
      setStatus('❌ ' + e.message);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-gray-200 p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold mb-6 text-white">📊 Vercel Backend Dashboard</h1>

        <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg shadow p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3 text-white">Backend Config</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-300">Backend URL</label>
              <input
                className="w-full border border-[#2a2a3e] rounded px-3 py-2 bg-[#0f0f1a] text-gray-200"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-300">API Key</label>
              <input
                className="w-full border border-[#2a2a3e] rounded px-3 py-2 bg-[#0f0f1a] text-gray-200"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={loadSent} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Refresh Sent</button>
            <button onClick={loadQueue} className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800">Refresh Queue</button>
          </div>
        </div>

        <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg shadow p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3 text-white">Send Test Mail</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-300">To</label>
              <input className="w-full border border-[#2a2a3e] rounded px-3 py-2 bg-[#0f0f1a] text-gray-200" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-300">Subject</label>
              <input className="w-full border border-[#2a2a3e] rounded px-3 py-2 bg-[#0f0f1a] text-gray-200" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium mb-1 text-gray-300">Body</label>
            <textarea className="w-full border border-[#2a2a3e] rounded px-3 py-2 h-40 bg-[#0f0f1a] text-gray-200" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <button
            onClick={sendTest}
            disabled={loading}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700"
          >
            {loading ? 'Sending...' : 'Send Test Mail'}
          </button>
        </div>

        <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg shadow p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3 text-white">Queue Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(queueCounts).map(([key, val]) => (
              <div key={key} className="border border-[#2a2a3e] rounded p-3 text-center bg-[#0f0f1a]">
                <div className="text-2xl font-bold text-white">{val}</div>
                <div className="text-sm text-gray-400 capitalize">{key}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-3 text-white">Sent & Tracking</h2>
          {status && <div className="mb-3 text-sm text-gray-400">{status}</div>}
          {sent.length === 0 ? (
            <div className="text-gray-400">No emails sent yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2a3e]">
                    <th className="text-left py-2 text-gray-300">To</th>
                    <th className="text-left py-2 text-gray-300">Subject</th>
                    <th className="text-left py-2 text-gray-300">Status</th>
                    <th className="text-left py-2 text-gray-300">Opens</th>
                    <th className="text-left py-2 text-gray-300">Clicks</th>
                    <th className="text-left py-2 text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sent.map((s) => (
                    <tr key={s.trackId} className="border-b border-[#2a2a3e]">
                      <td className="py-2 text-gray-200">{s.to}</td>
                      <td className="py-2 text-gray-200">{s.subject}</td>
                      <td className="py-2">
                        {s.status === 'sent' && '✅ Sent'}
                        {s.status === 'failed' && '❌ Failed'}
                        {!s.status && '⏳ Queued'}
                      </td>
                      <td className="py-2">
                        {s.opened ? `📖 ${s.openCount}` : '📭 Not opened'}
                      </td>
                      <td className="py-2">
                        {s.clicked ? `🔗 ${s.clickCount}` : '—'}
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => testPixel(s.trackId)}
                          className="px-2 py-1 bg-gray-700 rounded text-xs text-white hover:bg-gray-600"
                        >
                          🔍 Test Pixel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
