import React, { useState } from 'react';
import { ArrowRight, AlertCircle, CheckCircle, Briefcase, User, Mail, Globe, Phone, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function FoundingMembersSignup() {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    company: '',
    role: '',
    phone: '',
    website: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to sign up');
      }
      
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center relative bg-black">
        <div className="w-full max-w-lg p-8 relative z-10">
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-12 shadow-2xl text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-6" />
            <h2 className="text-3xl font-serif font-light text-white mb-4">Welcome to Lucida!</h2>
            <p className="text-gray-400 text-sm mb-6">
              We've sent a welcome email to <strong className="text-white">{formData.email}</strong>.<br/>
              As a founding member, you'll get early access to new features.
            </p>
            <div className="mt-8 p-4 bg-white/5 border border-white/10 rounded-lg text-left">
              <p className="text-sm text-gray-300 mb-2">Want to refer a friend?</p>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value="https://lucidaanalytics.tech/founding-members" 
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-400 focus:outline-none"
                />
                <button 
                  onClick={() => navigator.clipboard.writeText("https://lucidaanalytics.tech/founding-members")}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs transition-colors whitespace-nowrap"
                >
                  Copy
                </button>
              </div>
            </div>
            <Link to="/" className="inline-block mt-8 text-blue-400 hover:text-white text-sm transition-colors">
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative bg-black py-12">
      <div className="absolute top-[10%] left-[20%] w-[40%] h-[40%] bg-blue-900/20 blur-[150px] rounded-full mix-blend-screen pointer-events-none"></div>

      <div className="w-full max-w-2xl p-8 relative z-10">
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-10 shadow-2xl overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-500 to-indigo-500 scale-x-0 origin-left group-hover:scale-x-100 transition-transform duration-500"></div>

          <div className="flex flex-col items-center mb-10 border-b border-white/10 pb-8">
            <h1 className="text-4xl font-serif font-light text-white mb-3">
              Founding Member
            </h1>
            <p className="text-gray-400 text-sm font-sans font-light text-center max-w-md">
              Join the exclusive founding group and help shape the future of universal lead scoring.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 text-sm font-sans flex items-center gap-3 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="form-group mb-0 relative">
                <label className="block font-mono text-[0.65rem] tracking-[0.2em] uppercase text-gray-400 mb-2">
                  <User className="w-3 h-3 inline mr-2" />
                  First Name *
                </label>
                <input
                  type="text"
                  name="first_name"
                  required
                  value={formData.first_name}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  placeholder="Sarah"
                />
              </div>

              <div className="form-group mb-0 relative">
                <label className="block font-mono text-[0.65rem] tracking-[0.2em] uppercase text-gray-400 mb-2">
                  <User className="w-3 h-3 inline mr-2" />
                  Last Name *
                </label>
                <input
                  type="text"
                  name="last_name"
                  required
                  value={formData.last_name}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  placeholder="Chen"
                />
              </div>
            </div>

            <div className="form-group mb-0 relative">
              <label className="block font-mono text-[0.65rem] tracking-[0.2em] uppercase text-gray-400 mb-2">
                <Mail className="w-3 h-3 inline mr-2" />
                Work Email *
              </label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                placeholder="founder@company.com"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="form-group mb-0 relative">
                <label className="block font-mono text-[0.65rem] tracking-[0.2em] uppercase text-gray-400 mb-2">
                  <Briefcase className="w-3 h-3 inline mr-2" />
                  Company *
                </label>
                <input
                  type="text"
                  name="company"
                  required
                  value={formData.company}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  placeholder="TechStartup Inc."
                />
              </div>

              <div className="form-group mb-0 relative">
                <label className="block font-mono text-[0.65rem] tracking-[0.2em] uppercase text-gray-400 mb-2">
                  <Briefcase className="w-3 h-3 inline mr-2" />
                  Role/Title *
                </label>
                <input
                  type="text"
                  name="role"
                  required
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  placeholder="CEO / Head of RevOps"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="form-group mb-0 relative">
                <label className="block font-mono text-[0.65rem] tracking-[0.2em] uppercase text-gray-400 mb-2">
                  <Phone className="w-3 h-3 inline mr-2" />
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div className="form-group mb-0 relative">
                <label className="block font-mono text-[0.65rem] tracking-[0.2em] uppercase text-gray-400 mb-2">
                  <Globe className="w-3 h-3 inline mr-2" />
                  Website (Optional)
                </label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  placeholder="https://company.com"
                />
              </div>
            </div>

            <div className="form-group mb-0 relative">
              <label className="block font-mono text-[0.65rem] tracking-[0.2em] uppercase text-gray-400 mb-2">
                <MessageSquare className="w-3 h-3 inline mr-2" />
                Why Lucida? (Optional)
              </label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows="3"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
                placeholder="What are you hoping to solve with Lucida?"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-white text-black font-medium py-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              <span className="tracking-wide">{loading ? 'Submitting...' : 'Apply for Early Access'}</span>
              {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
