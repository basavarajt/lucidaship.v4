import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, AlertCircle, Lock } from 'lucide-react';

const MASTER_KEY = import.meta.env.VITE_MASTER_KEY || '';

export default function Login() {
  const navigate = useNavigate();
  const [masterKey, setMasterKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    await new Promise((r) => setTimeout(r, 500));

    if (!MASTER_KEY) {
      setError('VITE_MASTER_KEY is not configured. Set it in apps/frontend/.env.local.');
      setLoading(false);
      return;
    }

    if (masterKey === MASTER_KEY) {
      localStorage.setItem('lucida_authenticated', 'true');
      localStorage.setItem('lucida_auth_time', new Date().toISOString());
      navigate('/dashboard');
    } else {
      setError('Invalid access key.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative bg-black">
      <div className="bg-glow"></div>

      <div className="w-full max-w-lg p-8 relative z-10">
        <div className="glass-card p-12">
          <div className="absolute top-0 left-0 w-[3px] h-0 bg-accent transition-all duration-500 group-hover:h-full"></div>

          <div className="flex flex-col items-center mb-10 border-b border-line pb-8">
            <div className="w-10 h-10 border border-accent flex items-center justify-center font-mono text-accent mb-6 shadow-[0_0_15px_rgba(200,169,110,0.15)]">
              L
            </div>
            <h1 className="text-4xl font-serif font-light text-white mb-2">
              Authentication Session
            </h1>
            <p className="text-dim text-sm font-sans font-light text-center">
              Enter your access key to open the Lucida Command Center
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 text-sm font-sans flex items-center gap-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-5">
              <div className="form-group mb-0 relative group">
                <div className="flex justify-between items-center mb-3">
                  <label className="block font-mono text-[0.6rem] tracking-[0.25em] uppercase text-dim group-focus-within:text-accent transition-colors">
                    <Lock className="w-3 h-3 inline mr-2" />
                    Access Key
                  </label>
                </div>
                <input
                  type="password"
                  required
                  value={masterKey}
                  onChange={(e) => setMasterKey(e.target.value)}
                  className="glass-input pl-4 pr-4 py-3"
                  placeholder="Enter access key..."
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-4 flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="tracking-[0.25em]">{loading ? 'Authenticating...' : 'Establish Connection'}</span>
              {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          <div className="mt-10 text-center border-t border-line pt-6">
            <p className="font-mono text-[0.6rem] tracking-[0.15em] uppercase text-dim">
              <Link to="/" className="text-accent hover:text-white hover:underline transition-all inline-block">
                ← Back to Landing
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
