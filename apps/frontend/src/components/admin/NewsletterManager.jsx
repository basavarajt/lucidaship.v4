import React, { useState, useEffect } from 'react';
import { Plus, BarChart2 } from 'lucide-react';
import { getAuth } from 'firebase/auth';

import CampaignCodeEditor from './CampaignCodeEditor';
import CampaignAnalytics from './CampaignAnalytics';

export default function NewsletterManager() {
  const [view, setView] = useState('list'); // 'list', 'create', 'analytics'
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const fetchCampaigns = async () => {
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      // We don't have a GET /api/admin/campaigns list endpoint explicitly for code-campaigns in the new router,
      // but wait, we can reuse the existing `GET /api/admin/campaigns` from `resend_admin.py` if we save them there.
      // But we saved them in Firestore! So we need a way to list them.
      // I will add a `/api/admin/campaigns/list-firestore` or similar to the backend.
      const res = await fetch(`${apiUrl}/api/admin/campaigns/firestore`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setCampaigns(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch firestore campaigns", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'list') {
      fetchCampaigns();
    }
  }, [view]);

  if (view === 'create') {
    return (
      <div>
        <button 
          onClick={() => setView('list')}
          className="mb-4 text-gray-400 hover:text-white transition-colors flex items-center gap-2"
        >
          &larr; Back to Newsletters
        </button>
        <CampaignCodeEditor onCampaignCreated={() => setView('list')} />
      </div>
    );
  }

  if (view === 'analytics' && selectedCampaignId) {
    return (
      <CampaignAnalytics 
        campaignId={selectedCampaignId} 
        onBack={() => {
          setSelectedCampaignId(null);
          setView('list');
        }} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-medium text-white">Newsletter Links</h2>
        <button 
          onClick={() => setView('create')}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> New Newsletter
        </button>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="text-gray-400 text-center py-10">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center text-gray-400">
            No newsletters found. Create your first campaign!
          </div>
        ) : (
          campaigns.map(camp => (
            <div key={camp.id} className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/10 transition-colors">
              <div>
                <h3 className="text-white font-medium">{camp.name}</h3>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className={`px-2 py-0.5 rounded uppercase tracking-wider font-mono ${camp.status === 'sent' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-500'}`}>
                    {camp.status}
                  </span>
                  <span className="text-gray-500 font-mono">{new Date(camp.created_at).toLocaleDateString()}</span>
                  <span className="text-gray-400 font-mono">Signups: {camp.signups || 0}</span>
                </div>
              </div>
              <button 
                onClick={() => {
                  setSelectedCampaignId(camp.id);
                  setView('analytics');
                }}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors text-sm"
              >
                <BarChart2 className="w-4 h-4" /> View Analytics
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
