import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Activity, Mail, Users, AlertTriangle, AlertOctagon, MousePointerClick } from 'lucide-react';
import { getAuth } from 'firebase/auth';

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState(null);
  const [engagement, setEngagement] = useState([]);
  const [loading, setLoading] = useState(true);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const headers = { 'Authorization': `Bearer ${token}` };

      const res = await fetch(`${apiUrl}/api/admin/analytics/summary`, { headers });
      if (res.ok) setStats(await res.json());

      const engRes = await fetch(`${apiUrl}/api/admin/analytics/engagement-timeline`, { headers });
      if (engRes.ok) setEngagement(await engRes.json());
    } catch (err) {
      console.error("Failed to fetch analytics", err);
    } finally {
      setLoading(false);
    }
  };

  const MetricCard = ({ title, value, subtitle, icon: Icon, colorClass }) => (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-400 font-medium text-sm">{title}</h3>
        <div className={`p-2 rounded-lg ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-3xl font-serif text-white mb-1">{value}</div>
      {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
    </div>
  );

  if (loading) {
    return <div className="text-gray-400 py-10 text-center">Loading Analytics...</div>;
  }

  if (!stats) {
    return <div className="text-red-400 py-10 text-center">Failed to load analytics.</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-serif text-white flex items-center gap-2 mb-6">
        <Activity className="w-5 h-5 text-green-400" /> Platform Overview
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Total Sent" 
          value={stats.total_sent} 
          icon={Mail} 
          colorClass="bg-blue-500/10 text-blue-400"
        />
        <MetricCard 
          title="Open Rate" 
          value={stats.open_rate} 
          subtitle={`${stats.total_opened} total opens`}
          icon={Activity} 
          colorClass="bg-green-500/10 text-green-400"
        />
        <MetricCard 
          title="Click Rate" 
          value={stats.click_rate} 
          subtitle={`${stats.total_clicked} total clicks`}
          icon={MousePointerClick} 
          colorClass="bg-purple-500/10 text-purple-400"
        />
        <MetricCard 
          title="Unsubscribed" 
          value={stats.total_unsubscribed} 
          icon={Users} 
          colorClass="bg-gray-500/10 text-gray-400"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <MetricCard 
          title="Bounce Rate" 
          value={stats.bounce_rate} 
          subtitle={`${stats.total_bounced} bounced`}
          icon={AlertTriangle} 
          colorClass="bg-orange-500/10 text-orange-400"
        />
        <MetricCard 
          title="Spam Complaints" 
          value={stats.complaint_rate || "0%"} 
          icon={AlertOctagon} 
          colorClass="bg-red-500/10 text-red-400"
        />
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-6 mt-8">
        <h3 className="text-lg font-medium text-white mb-6">Engagement Over Time</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={engagement} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="date" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} />
              <YAxis stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#000', border: '1px solid #ffffff20', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Line type="monotone" dataKey="opened" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4 }} />
              <Line type="monotone" dataKey="clicked" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
