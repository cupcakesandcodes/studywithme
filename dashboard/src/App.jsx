import { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import useExtensionTheme from './hooks/useExtensionTheme';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import './index.css';

function App() {
  const [session, setSession] = useState(null);

  // ✅ APPLY THEME HERE
  useExtensionTheme();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        window.dispatchEvent(new CustomEvent('STUDY_WITH_ME_SYNC', {
          detail: { session }
        }));
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        window.dispatchEvent(new CustomEvent('STUDY_WITH_ME_SYNC', {
          detail: { session }
        }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="app-container">
      {!session ? (
        <LandingPage />
      ) : (
        <DashboardPage user={session.user} />
      )}
    </div>
  );
}

export default App;