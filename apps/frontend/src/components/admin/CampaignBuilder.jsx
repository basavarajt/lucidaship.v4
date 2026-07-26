import React, { useState, useEffect } from 'react';
import { Send, FileEdit, AlertCircle } from 'lucide-react';
import { getAuth } from 'firebase/auth';

export default function CampaignBuilder() {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [audience, setAudience] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  
  const [campaigns, setCampaigns] = useState([]);
  const [audiences, setAudiences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchAudiences();
    fetchCampaigns();
  }, []);

  const getHeaders = async () => {
    const auth = getAuth();
    const token = await auth.currentUser?.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const fetchAudiences = async () => {
    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiUrl}/api/admin/audiences`, { headers });
      if (res.ok) {
        setAudiences(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiUrl}/api/admin/campaigns`, { headers });
      if (res.ok) {
        setCampaigns(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const headers = await getHeaders();
      const payload = {
        name, subject, html, audience_id: audience
      };
      if (scheduledAt) payload.scheduled_at = new Date(scheduledAt).toISOString();

      const res = await fetch(`${apiUrl}/api/admin/campaigns/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to create campaign');
      await fetchCampaigns();
      setName(''); setSubject(''); setHtml(''); setAudience(''); setScheduledAt('');
      alert('Campaign draft created successfully');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (campaignId) => {
    if (!window.confirm("Are you sure you want to send this campaign?")) return;
    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiUrl}/api/admin/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers
      });
      if (!res.ok) throw new Error('Failed to send campaign');
      await fetchCampaigns();
      alert('Campaign sent!');
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
          <FileEdit className="w-5 h-5 text-purple-400" /> Create Campaign
        </h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 mb-4 text-sm">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-gray-400 mb-2">Campaign Name</label>
            <input
              type="text" required
              value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white focus:border-purple-500/50"
              placeholder="e.g., q1_roadmap_update"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-gray-400 mb-2">Audience</label>
            <select 
              required
              value={audience} onChange={e => setAudience(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white focus:border-purple-500/50"
            >
              <option value="">Select Audience...</option>
              {audiences.map(aud => (
                <option key={aud.id} value={aud.id}>{aud.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono text-gray-400 mb-2">Email Subject</label>
            <input
              type="text" required
              value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white focus:border-purple-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-gray-400 mb-2">HTML Content (Use {'{{ first_name }}'})</label>
            <textarea
              required rows="8"
              value={html} onChange={e => setHtml(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-purple-500/50"
            ></textarea>
          </div>
          <div>
            <label className="block text-xs font-mono text-gray-400 mb-2">Schedule At (Optional)</label>
            <input
              type="datetime-local"
              value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white focus:border-purple-500/50"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Creating...' : 'Create Draft Campaign'}
          </button>
        </form>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
          <Send className="w-5 h-5 text-blue-400" /> Recent Campaigns
        </h2>
        
        <div className="space-y-4">
          {campaigns.length === 0 ? (
            <p className="text-gray-400 text-sm">No campaigns found.</p>
          ) : (
            campaigns.map(camp => (
              <div key={camp.id} className="p-4 border border-white/10 bg-black rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-medium text-white">{camp.name}</h3>
                    <p className="text-xs text-gray-500 font-mono mt-1">{camp.subject}</p>
                  </div>
                  <span className={`px-2 py-1 text-[10px] uppercase font-mono rounded ${camp.status === 'draft' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-400'}`}>
                    {camp.status}
                  </span>
                </div>
                
                <div className="mt-4 flex justify-between items-center border-t border-white/5 pt-3">
                  <span className="text-xs text-gray-400">
                    {new Date(camp.created_at).toLocaleDateString()}
                  </span>
                  
                  {camp.status === 'draft' && (
                    <button 
                      onClick={() => handleSend(camp.id)}
                      className="text-xs bg-white text-black px-3 py-1.5 rounded hover:bg-gray-200 transition-colors"
                    >
                      Send Now
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
