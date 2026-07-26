import React, { useState, useEffect } from 'react';
import { Users, Mail, BarChart2, Shield, LogOut, Menu, X, LayoutDashboard } from 'lucide-react';
import { getAuth, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';

import ContactManager from '../components/admin/ContactManager';
import AudienceManager from '../components/admin/AudienceManager';
import CampaignBuilder from '../components/admin/CampaignBuilder';
import AnalyticsDashboard from '../components/admin/AnalyticsDashboard';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const auth = getAuth();
  const [user, loading] = useAuthState(auth);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/login');
      } else {
        // Since the backend does the actual verification (user.email === talikotibasavaraj77@gmail.com)
        // We do a soft check here just for UX
        if (user.email === 'talikotibasavaraj77@gmail.com') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      }
    }
  }, [user, loading, navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const navItems = [
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'audiences', label: 'Audiences', icon: LayoutDashboard },
    { id: 'campaigns', label: 'Campaigns', icon: Mail },
  ];

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading Admin...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-red-500/10 border border-red-500/20 p-8 rounded-2xl text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h1 className="text-2xl font-serif text-white mb-4">Access Denied</h1>
          <p className="text-gray-400 mb-8">
            You do not have administrative privileges. This area is restricted to authorized personnel only.
          </p>
          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              Go to Dashboard
            </button>
            <button 
              onClick={handleLogout}
              className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-white/10 bg-black z-20">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-500" />
          <span className="font-serif text-lg">Resend Admin</span>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <div className={`
        fixed md:sticky top-0 left-0 h-screen w-64 bg-black/95 backdrop-blur-xl border-r border-white/10
        flex flex-col transition-transform duration-300 z-10
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 hidden md:flex items-center gap-3 border-b border-white/10">
          <Shield className="w-8 h-8 text-blue-500" />
          <span className="font-serif text-xl tracking-wide">Admin</span>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          <div className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-4 px-2">Resend Platform</div>
          
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : ''}`} />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user.email}</p>
              <p className="text-xs text-green-400">Super Admin</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 h-screen overflow-y-auto p-4 md:p-8 relative">
        {/* Decorative background blur */}
        <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-blue-900/10 blur-[150px] rounded-full mix-blend-screen pointer-events-none -z-10"></div>
        
        <header className="mb-8">
          <h1 className="text-3xl font-serif text-white mb-2">
            {navItems.find(i => i.id === activeTab)?.label}
          </h1>
          <p className="text-gray-400 font-light">Manage your email platform and audience engagement.</p>
        </header>

        <main className="max-w-6xl">
          {activeTab === 'analytics' && <AnalyticsDashboard />}
          {activeTab === 'contacts' && <ContactManager />}
          {activeTab === 'audiences' && <AudienceManager />}
          {activeTab === 'campaigns' && <CampaignBuilder />}
        </main>
      </div>
    </div>
  );
}
