import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CampaignSignupPage() {
  const slug = window.location.pathname.split('/').pop();
  const navigate = useNavigate();
  
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: ''
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    const fetchCampaign = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/campaigns/${slug}`);
        if (!res.ok) {
          throw new Error('Campaign not found');
        }
        const data = await res.json();
        setCampaign(data);
        document.title = data.name;
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCampaign();
  }, [slug, apiUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    
    try {
      const res = await fetch(`${apiUrl}/api/campaigns/${slug}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: formData.email,
          first_name: formData.firstName,
          last_name: formData.lastName,
          company: formData.company || undefined
        })
      });
      
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.detail || 'Failed to sign up');
      }
      
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-gray-500 font-mono text-sm animate-pulse">Loading campaign...</div>
      </div>
    );
  }

  if (error && !campaign) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-md w-full">
          <h1 className="text-2xl font-serif text-gray-900 mb-2">Not Found</h1>
          <p className="text-gray-500 mb-6">This campaign does not exist or has been removed.</p>
          <button 
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col md:flex-row">
      {/* Left side - Dynamic HTML Content */}
      <div className="w-full md:w-1/2 lg:w-3/5 h-screen overflow-y-auto bg-white border-r border-gray-200">
        <iframe
          title={campaign.name}
          srcDoc={campaign.html_template}
          className="w-full h-full border-none"
        />
      </div>

      {/* Right side - Signup Form */}
      <div className="w-full md:w-1/2 lg:w-2/5 min-h-screen flex items-center justify-center p-6 lg:p-12 bg-white">
        <div className="w-full max-w-md">
          {success ? (
            <div className="text-center bg-green-50 rounded-2xl p-8 border border-green-100">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-serif text-gray-900 mb-3">Check your inbox</h2>
              <p className="text-gray-600 text-sm">
                We've sent a confirmation email to <strong>{formData.email}</strong>. 
                Please click the link inside to complete your subscription.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-3xl font-serif text-gray-900 mb-3">Join the waitlist</h2>
                <p className="text-gray-500">Subscribe to receive this campaign directly in your inbox.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-gray-500 mb-1 uppercase tracking-wider">First Name</label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                      placeholder="Jane"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-gray-500 mb-1 uppercase tracking-wider">Last Name</label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-gray-500 mb-1 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                    placeholder="jane@company.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-gray-500 mb-1 uppercase tracking-wider">Company (Optional)</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({...formData, company: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                    placeholder="Acme Corp"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3.5 rounded-xl transition-colors disabled:opacity-70 mt-4"
                >
                  {submitting ? 'Submitting...' : 'Subscribe Now'}
                </button>
                
                <p className="text-center text-xs text-gray-400 mt-4">
                  By subscribing, you agree to our privacy policy.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
