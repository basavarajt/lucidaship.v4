import React, { useState, useEffect } from 'react';
import { Users, Plus, AlertCircle } from 'lucide-react';
import { getAuth } from 'firebase/auth';

export default function AudienceManager() {
  const [audiences, setAudiences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchAudiences();
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
    setLoading(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiUrl}/api/admin/audiences`, { headers });
      if (!res.ok) throw new Error('Failed to fetch audiences');
      const data = await res.json();
      setAudiences(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createAudience = async () => {
    const name = prompt('Audience Name?');
    if (!name) return;

    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiUrl}/api/admin/audiences/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error('Failed to create audience');
      await fetchAudiences();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-serif text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" /> Audiences
        </h2>
        <button 
          onClick={createAudience}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Audience
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 mb-6 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && audiences.length === 0 ? (
          <div className="text-gray-400 py-4">Loading...</div>
        ) : audiences.length === 0 ? (
          <div className="text-gray-400 py-4 col-span-full">No audiences found. Create one to get started.</div>
        ) : (
          audiences.map(aud => (
            <div key={aud.id} className="bg-black border border-white/10 p-5 rounded-lg hover:border-white/20 transition-colors">
              <h3 className="font-medium text-white mb-2">{aud.name}</h3>
              <p className="text-xs text-gray-500 font-mono mb-4">ID: {aud.id}</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Created</span>
                <span className="text-gray-300 font-mono text-xs">{new Date(aud.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
