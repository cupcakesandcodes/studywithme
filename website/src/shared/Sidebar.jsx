import { NavLink } from 'react-router-dom';
import { 
  Zap, 
  LayoutDashboard, 
  Calendar, 
  Columns, 
  Users, 
  Settings, 
  LogOut,
  Palette
} from 'lucide-react';
import { motion } from 'framer-motion';

const Sidebar = ({ user, onSignOut }) => {
  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Calendar size={20} />, label: 'Planner', path: '/planner' },
    { icon: <Columns size={20} />, label: 'Kanban', path: '/kanban' },
    { icon: <Users size={20} />, label: 'Focus Rooms', path: '/rooms' },
  ];

  return (
    <aside className="w-64 h-screen sticky top-0 flex flex-col border-r border-border transition-all duration-300" style={{ background: 'var(--bg-color)', borderColor: 'var(--border-color)' }}>
      {/* Brand */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ background: 'var(--accent-color)' }}>
          <Zap size={20} color="#fff" strokeWidth={3} />
        </div>
        <span className="text-xl font-black tracking-tighter" style={{ color: 'var(--text-primary)' }}>
          StudyWithMe
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-8 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all group
              ${isActive 
                ? 'bg-accent/10 text-accent' 
                : 'text-secondary hover:bg-white/5 hover:text-primary'}
            `}
            style={({ isActive }) => isActive ? { color: 'var(--accent-color)', backgroundColor: 'color-mix(in srgb, var(--accent-color) 10%, transparent)' } : {}}
          >
            {({ isActive }) => (
              <>
                <span className="transition-transform group-hover:scale-110">{item.icon}</span>
                {item.label}
                {isActive && (
                  <motion.div 
                    layoutId="active-pill"
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--accent-color)' }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-border space-y-1">
        <NavLink
            to="/settings"
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all
              ${isActive 
                ? 'bg-accent/10 text-accent' 
                : 'text-secondary hover:bg-white/5 hover:text-primary'}
            `}
            style={({ isActive }) => isActive ? { color: 'var(--accent-color)', backgroundColor: 'color-mix(in srgb, var(--accent-color) 10%, transparent)' } : {}}
          >
          {({ isActive }) => (
            <>
              <Settings size={20} />
              Settings
              {isActive && (
                <motion.div 
                  layoutId="active-pill-settings"
                  className="ml-auto w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--accent-color)' }}
                />
              )}
            </>
          )}
        </NavLink>

        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-secondary hover:bg-red-500/10 hover:text-red-500 transition-all"
        >
          <LogOut size={20} />
          Sign Out
        </button>

        {/* User Card */}
        {user && (
          <div className="mt-4 p-3 rounded-2xl flex items-center gap-3 bg-white/5 border border-white/5">
            {user.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} className="w-8 h-8 rounded-full border border-border" alt="" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ background: 'var(--accent-color)' }}>
                {(user.user_metadata?.full_name || user.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                {user.user_metadata?.full_name || 'Focused User'}
              </p>
              <p className="text-[10px] opacity-40 truncate">Free Tier</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
