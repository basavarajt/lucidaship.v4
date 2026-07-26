import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';

export default function CampaignAnalytics({ campaignId, onBack }) {
  const [campaign, setCampaign] = useState(null);
  const [signups, setSignups] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const fetchAnalytics = async () => {
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const res = await fetch(`${apiUrl}/api/admin/campaigns/${campaignId}/analytics`, { headers });
      const data = await res.json();
      setCampaign(data);

      const signupsRes = await fetch(`${apiUrl}/api/admin/campaigns/${campaignId}/signups`, { headers });
      setSignups(await signupsRes.json());
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [campaignId]);

  const handleSendCampaign = async () => {
    const subject = window.prompt('Enter subject line for this broadcast:', `Update from ${campaign.campaign_name}`);
    if (!subject) return;

    if (!window.confirm(`Send campaign to all ${signups.confirmed} confirmed signups?`)) return;

    setSendingEmail(true);

    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      const res = await fetch(`${apiUrl}/api/admin/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subject: subject,
          send_to_all: true
        })
      });

      if (!res.ok) throw new Error('Failed to send campaign');
      const result = await res.json();
      alert(`Campaign sent to ${result.emails_sent} subscribers!`);
      fetchAnalytics();
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) return <div className="text-gray-400 py-10 text-center">Loading Analytics...</div>;
  if (!campaign) return <div className="text-gray-400 py-10 text-center">Campaign not found.</div>;

  const stats = campaign.statistics;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 border-b border-white/10 pb-4">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
          &larr; Back
        </button>
        <h2 className="text-xl text-white font-medium">{campaign.campaign_name}</h2>
        <span className={`px-3 py-1 rounded-full text-xs uppercase tracking-wider font-mono ${campaign.status === 'sent' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'}`}>
          {campaign.status}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <div className="text-gray-400 text-xs font-mono mb-2">Page Views</div>
          <div className="text-3xl text-white font-bold">{stats.views}</div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <div className="text-gray-400 text-xs font-mono mb-2">Total Signups</div>
          <div className="text-3xl text-white font-bold">{stats.signups}</div>
          <div className="text-green-400 text-xs mt-2">{stats.confirmed} confirmed</div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <div className="text-gray-400 text-xs font-mono mb-2">Emails Sent</div>
          <div className="text-3xl text-white font-bold">{stats.email_sent}</div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <div className="text-gray-400 text-xs font-mono mb-2">Open Rate</div>
          <div className="text-3xl text-white font-bold">{stats.email_open_rate}</div>
          <div className="text-gray-500 text-xs mt-2">{stats.email_opened} opens</div>
        </div>
      </div>

      {campaign.status !== 'sent' && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5 flex items-center justify-between">
          <div>
            <h3 className="text-blue-400 font-medium mb-1">Ready to Broadcast?</h3>
            <p className="text-gray-400 text-sm">Send this campaign to {signups?.confirmed || 0} confirmed subscribers via Resend.</p>
          </div>
          <button
            onClick={handleSendCampaign}
            disabled={sendingEmail || signups?.confirmed === 0}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {sendingEmail ? 'Broadcasting...' : 'Broadcast Campaign'}
          </button>
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h3 className="text-white font-medium">Subscribers</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-white/5 text-gray-400 font-mono text-xs uppercase">
              <tr>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Company</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {signups?.signups?.map(s => (
                <tr key={s.id} className="hover:bg-white/5">
                  <td className="px-5 py-4 font-mono text-xs">{s.email}</td>
                  <td className="px-5 py-4">{s.first_name} {s.last_name}</td>
                  <td className="px-5 py-4">{s.company || '—'}</td>
                  <td className="px-5 py-4">{new Date(s.signed_up_at).toLocaleDateString()}</td>
                  <td className="px-5 py-4">
                    {s.email_confirmed ? (
                      <span className="text-green-400">✓ Confirmed</span>
                    ) : (
                      <span className="text-yellow-500">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
              {!signups?.signups?.length && (
                <tr>
                  <td colSpan="5" className="px-5 py-8 text-center text-gray-500">
                    No signups yet. Share your campaign link!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
