import { useState } from 'react';
import { Compass, Code } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';

const LandingPage = () => {
  const [loading, setLoading] = useState(false);

  const handleLogin = async (provider) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (error) {
      alert(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl p-8 md:p-12 rounded-2xl border"
        style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
      >
        <div className="grid md:grid-cols-2 gap-8 md:gap-10 items-center">
          <section>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--text-secondary)] mb-4">
              StudyWithMe
            </p>
            <h1 className="text-4xl md:text-5xl font-black leading-tight text-[var(--text-primary)]">
              Focus deeply. <span style={{ color: 'var(--accent-color)' }}>Track clearly.</span>
            </h1>
            <p className="mt-5 text-sm md:text-base text-[var(--text-secondary)]">
              Start sessions from the extension popup and view your full productivity dashboard here.
              Your selected popup colour theme now carries into this page.
            </p>
          </section>

          <section className="space-y-4">
            <button
              onClick={() => handleLogin('google')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white text-black font-bold rounded-xl transition-all hover:bg-[#f0f0f0] active:scale-95 disabled:opacity-50"
            >
              <Compass size={20} style={{ color: 'var(--accent-color)' }} />
              {loading ? 'Connecting...' : 'Continue with Google'}
            </button>

            <button
              onClick={() => handleLogin('github')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#24292e] text-white font-bold rounded-xl transition-all hover:bg-[#2f363d] active:scale-95 disabled:opacity-50"
            >
              <Code size={20} className="text-white" />
              {loading ? 'Connecting...' : 'Continue with GitHub'}
            </button>
          </section>
        </div>
      </motion.div>
    </div>
  );
};

export default LandingPage;
