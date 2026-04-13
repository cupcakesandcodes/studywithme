import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { supabase } from '../lib/supabaseClient';

const Layout = ({ user, session }) => {
  // Protect the route
  if (!session) return <Navigate to="/" replace />;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-color)' }}>
      {/* Persistant Left Sidebar */}
      <Sidebar user={user} onSignOut={handleSignOut} />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto h-screen custom-scroll">
        <div className="max-w-[1400px] mx-auto p-8 md:p-12">
            <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
