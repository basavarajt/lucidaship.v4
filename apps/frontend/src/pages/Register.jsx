import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, AlertCircle } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    company_name: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.company_name.trim() || !formData.email.trim()) {
        throw new Error('Company name and email are required.');
      }

      localStorage.setItem('lucida_authenticated', 'true');
      localStorage.setItem('lucida_auth_time', new Date().toISOString());
      localStorage.setItem(
        'lucida_profile',
        JSON.stringify({
          company_name: formData.company_name.trim(),
          email: formData.email.trim(),
        })
      );

      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Initialization failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative bg-black pt-16 pb-16">
      <div className="bg-glow"></div>

      <div className="w-full max-w-xl p-8 relative z-10">
        <div className="glass-card p-12">
          <div className="absolute top-0 left-0 w-[3px] h-0 bg-accent transition-all duration-500 group-hover:h-full"></div>

          <div className="flex flex-col items-center mb-10 border-b border-line pb-8">
            <div className="w-10 h-10 border border-accent flex items-center justify-center font-mono text-accent mb-6 shadow-[0_0_15px_rgba(200,169,110,0.15)]">
              R
            </div>
            <h1 className="text-4xl font-serif font-light text-white mb-2 text-center">
              Workspace Initialization
            </h1>
            <p className="text-dim text-sm font-sans font-light text-center">
              Create a local workspace session for scoring and model management.
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 text-sm font-sans flex items-center gap-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-5">
              <div className="form-group mb-0 relative group">
                <label className="block font-mono text-[0.6rem] tracking-[0.25em] uppercase text-dim mb-3 group-focus-within:text-accent transition-colors">
                  Enterprise Name
                </label>
                <input
                  type="text"
                  name="company_name"
                  required
                  value={formData.company_name}
                  onChange={handleChange}
                  className="glass-input pl-4 pr-4 py-3"
                  placeholder="Acme Corp"
                />
              </div>

              <div className="form-group mb-0 relative group">
                <label className="block font-mono text-[0.6rem] tracking-[0.25em] uppercase text-dim mb-3 group-focus-within:text-accent transition-colors">
                  Administrator Email
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="glass-input pl-4 pr-4 py-3"
                  placeholder="admin@company.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-6 flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="tracking-[0.25em]">{loading ? 'Provisioning...' : 'Provision Workspace'}</span>
              {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          <div className="mt-10 text-center border-t border-line pt-6">
            <p className="font-mono text-[0.6rem] tracking-[0.15em] uppercase text-dim">
              Already provisioned?{' '}
              <Link to="/login" className="text-accent hover:text-white hover:underline transition-all inline-block ml-1">
                Authenticate Session
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
