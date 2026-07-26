import React, { useState, useEffect } from 'react';
import { Users, Mail, Download, KeyRound, Search, Send, FileEdit, LogOut, CheckCircle, XCircle } from 'lucide-react';

export default function AdminFoundingMembers() {
  const [secretKey, setSecretKey] = useState(localStorage.getItem('admin_secret_key') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('admin_secret_key'));
  
  const [activeTab, setActiveTab] = useState('members'); // 'members', 'campaigns'
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState({ total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [campaignForm, setCampaignForm] = useState({
    name: '',
    subject: '',
    html_template: '',
    plain_text: ''
  });
  
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (isAuthenticated && activeTab === 'members') {
      fetchMembers();
    }
  }, [isAuthenticated, activeTab]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (secretKey) {
      localStorage.setItem('admin_secret_key', secretKey);
      setIsAuthenticated(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_secret_key');
    setSecretKey('');
    setIsAuthenticated(false);
  };

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/api/admin/founding-members?limit=100`, {
        headers: {
          'Authorization': `Bearer ${secretKey}`
        }
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          handleLogout();
          throw new Error('Invalid secret key');
        }
        throw new Error('Failed to fetch members');
      }
      const data = await response.json();
      setMembers(data.members);
      setStats({ total: data.total });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/admin/export-csv`, {
        headers: { 'Authorization': `Bearer ${secretKey}` }
      });
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'founding_members.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/admin/campaign/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secretKey}`
        },
        body: JSON.stringify(campaignForm)
      });
      
      if (!response.ok) throw new Error('Failed to create campaign');
      const data = await response.json();
      alert(`Campaign created with ID: ${data.campaign_id}`);
      setCampaignForm({ name: '', subject: '', html_template: '', plain_text: '' });
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendCampaign = async (campaignId) => {
    if (!window.confirm('Are you sure you want to send this campaign to ALL active founding members?')) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/admin/campaign/${campaignId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secretKey}`
        },
        body: JSON.stringify({ send_now: true })
      });
      
      if (!response.ok) throw new Error('Failed to send campaign');
      const data = await response.json();
      alert(`Success! ${data.message}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-black">
        <div className="w-full max-w-md p-8 bg-black/60 border border-white/10 rounded-2xl">
          <div className="flex items-center justify-center mb-6">
            <KeyRound className="w-12 h-12 text-blue-500" />
          </div>
          <h1 className="text-2xl font-serif text-white text-center mb-6">Admin Access</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-gray-400 mb-2">SECRET KEY</label>
              <input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500/50"
                placeholder="Enter FastAPI Secret Key"
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-medium transition-colors">
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
          <div>
            <h1 className="text-2xl font-serif text-white">Founding Members Admin</h1>
            <p className="text-sm text-gray-400">Manage early adopters and campaigns</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-colors"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </header>

        <div className="flex gap-4 mb-6 border-b border-white/10 pb-1">
          <button 
            className={`px-4 py-2 font-medium text-sm transition-colors ${activeTab === 'members' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-300'}`}
            onClick={() => setActiveTab('members')}
          >
            <Users className="w-4 h-4 inline mr-2" /> Members ({stats.total})
          </button>
          <button 
            className={`px-4 py-2 font-medium text-sm transition-colors ${activeTab === 'campaigns' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-300'}`}
            onClick={() => setActiveTab('campaigns')}
          >
            <Mail className="w-4 h-4 inline mr-2" /> Campaigns
          </button>
        </div>

        {activeTab === 'members' && (
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            {error && <div className="p-4 bg-red-500/10 text-red-400 text-sm border-b border-red-500/20">{error}</div>}
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-white/5 text-gray-300 text-xs uppercase font-mono">
                  <tr>
                    <th className="px-6 py-4 font-medium">Name & Company</th>
                    <th className="px-6 py-4 font-medium">Contact</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Signed Up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading && members.length === 0 ? (
                    <tr><td colSpan="4" className="text-center py-8">Loading...</td></tr>
                  ) : members.length === 0 ? (
                    <tr><td colSpan="4" className="text-center py-8">No members found.</td></tr>
                  ) : (
                    members.map(member => (
                      <tr key={member.id} className="hover:bg-white/[0.02]">
                        <td className="px-6 py-4">
                          <div className="font-medium text-white">{member.first_name} {member.last_name}</div>
                          <div className="text-xs mt-1">{member.role} at {member.company}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div>{member.email}</div>
                          <div className="text-xs mt-1">{member.phone || '-'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {member.status === 'active' ? (
                              <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                            )}
                            <span className="capitalize">{member.status}</span>
                          </div>
                          <div className="text-[10px] uppercase font-mono mt-1">
                            Welcome: {member.welcome_email_status}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono">
                          {new Date(member.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'campaigns' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
                <FileEdit className="w-5 h-5" /> Create Campaign
              </h2>
              <form onSubmit={handleCreateCampaign} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-gray-400 mb-2">Internal Name</label>
                  <input
                    type="text" required
                    value={campaignForm.name} onChange={e => setCampaignForm({...campaignForm, name: e.target.value})}
                    className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white focus:border-blue-500/50"
                    placeholder="e.g., q1_roadmap_update"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-gray-400 mb-2">Email Subject</label>
                  <input
                    type="text" required
                    value={campaignForm.subject} onChange={e => setCampaignForm({...campaignForm, subject: e.target.value})}
                    className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-gray-400 mb-2">HTML Template (Use {'{{ first_name }}'} for variables)</label>
                  <textarea
                    required rows="8"
                    value={campaignForm.html_template} onChange={e => setCampaignForm({...campaignForm, html_template: e.target.value})}
                    className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-blue-500/50"
                  ></textarea>
                </div>
                <div>
                  <label className="block text-xs font-mono text-gray-400 mb-2">Plain Text Fallback</label>
                  <textarea
                    required rows="4"
                    value={campaignForm.plain_text} onChange={e => setCampaignForm({...campaignForm, plain_text: e.target.value})}
                    className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-blue-500/50"
                  ></textarea>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm transition-colors">
                  {loading ? 'Saving...' : 'Save Draft Campaign'}
                </button>
              </form>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
                <Send className="w-5 h-5" /> Send Campaign
              </h2>
              <p className="text-sm text-gray-400 mb-4">
                Once a campaign is created, you can trigger a mass send to all active founding members from here. 
                (To view draft campaigns, you would fetch them from the /campaigns collection).
              </p>
              
              <div className="p-4 border border-blue-500/30 bg-blue-500/5 rounded-lg">
                <label className="block text-xs font-mono text-gray-400 mb-2">Enter Campaign ID to Send</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    id="campaign_id_input"
                    placeholder="camp_xxx" 
                    className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-2 text-white focus:border-blue-500/50"
                  />
                  <button 
                    onClick={() => handleSendCampaign(document.getElementById('campaign_id_input').value)}
                    disabled={loading}
                    className="bg-white text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    Send Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
