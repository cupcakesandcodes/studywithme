import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  History, 
  Target, 
  Skull, 
  Clock, 
  LogOut, 
  LineChart,
  BarChart,
  PieChart as PieChartIcon
} from 'lucide-react';
import { 
  BarChart as ReBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LineChart as ReLineChart,
  Line,
  CartesianGrid
} from 'recharts';
import { motion } from 'framer-motion';

const Dashboard = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    goals: 0,
    interruptions: 0,
    focusTime: '0h 0m',
    sessions: [],
    distractions: [] // We'll keep mock distractions for now, as we only sync sessions currently
  });

  const fetchData = async () => {
    console.log('🔍 Dashboard Querying Supabase for fresh data...');
    try {
      setLoading(prev => (stats.sessions.length === 0 ? true : prev));
      
      const [sessionsRes, interruptionsRes] = await Promise.all([
        supabase.from('study_sessions').select('*').order('timestamp', { ascending: false }),
        supabase.from('study_interruptions').select('*').order('timestamp', { ascending: false })
      ]);

      if (sessionsRes.error) {
        console.error('🚫 Sessions Error:', sessionsRes.error.message);
        throw sessionsRes.error;
      }
      if (interruptionsRes.error) {
        console.error('🚫 Interruptions Error:', interruptionsRes.error.message);
        throw interruptionsRes.error;
      }

      const sessionsData = sessionsRes.data;
      const interruptionsData = interruptionsRes.data;

      console.log('📊 Records found:', {
        sessions: sessionsData.length,
        interruptions: interruptionsData.length
      });

      // Calculate stats
      const totalMinutes = sessionsData.reduce((acc, s) => acc + (s.duration / 60), 0);
      const h = Math.floor(totalMinutes / 60);
      const m = Math.floor(totalMinutes % 60);

      // Group sessions by day for the chart (last 7 days)
      const dayMap = {};
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      sessionsData.forEach(s => {
        const date = new Date(s.timestamp);
        const day = days[date.getDay()];
        dayMap[day] = (dayMap[day] || 0) + (s.duration / 60);
      });

      const chartData = days.map(d => ({
        name: d,
        minutes: Math.round(dayMap[d] || 0)
      }));

      // Combine sessions and interruptions for the unified history log
      const sessionsWithStatus = sessionsData.map(s => ({ ...s, status: 'Completed' }));
      const interruptionsWithStatus = interruptionsData.map(i => ({ 
        ...i, 
        goal: i.goal_at_time || 'Session Interrupted', 
        duration: 0, 
        status: 'Interrupted' 
      }));

      const allActivity = [...sessionsWithStatus, ...interruptionsWithStatus]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setStats(prev => ({
        ...prev,
        goals: sessionsData.length,
        interruptions: interruptionsData.length,
        focusTime: `${h}h ${m}m`,
        sessions: chartData,
        allSessions: allActivity.slice(0, 10)
      }));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchData();

    setStats(prev => ({ ...prev, bridgeStatus: 'connecting' }));
    
    // Setup Extension Data Bridge (for local Distractions)
    let bridgeTimeout;
    const handleExtensionData = (e) => {
      clearTimeout(bridgeTimeout);
      const data = e.detail;
      console.log('📥 Extension Data Received from Bridge:', data);
      
      const updates = { bridgeStatus: 'connected' };
      
      if (data && data.distractions) {
        const sortedDist = Object.entries(data.distractions)
          .sort((a, b) => b[1] - a[1]) // Sort by count descending
          .slice(0, 5) // Top 5
          .map(([domain, hits]) => ({ domain, hits }));
          
        updates.distractions = sortedDist.length > 0 ? sortedDist : [];
      }
      
      setStats(prev => ({
        ...prev,
        ...updates
      }));
    };
    
    const requestData = () => window.dispatchEvent(new CustomEvent('REQUEST_EXTENSION_DATA'));
    
    window.addEventListener('EXTENSION_DATA_RESPONSE', handleExtensionData);
    window.addEventListener('EXTENSION_BRIDGE_READY', requestData);
    
    // Ping for local stats immediately in case bridge is already ready
    requestData();
    console.log('📡 Dashboard requesting local data from extension bridge...');
    
    // Detect if bridge is disconnected (e.g. requires page refresh)
    bridgeTimeout = setTimeout(() => {
      console.warn('⚠️ Extension Bridge failed to respond within 2s.');
      setStats(prev => ({ 
        ...prev, 
        bridgeStatus: prev.bridgeStatus === 'connected' ? 'connected' : 'disconnected' 
      }));
    }, 2000);

    // Real-time Subscriptions
    const sessionChannel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'study_sessions' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'study_interruptions' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      window.removeEventListener('EXTENSION_DATA_RESPONSE', handleExtensionData);
      window.removeEventListener('EXTENSION_BRIDGE_READY', requestData);
      supabase.removeChannel(sessionChannel);
    };
  }, [user]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading Productivity Data...</div>;

  const COLORS = ['#4caf50', '#66bb6a', '#81c784', '#a5d6a7', '#c8e6c9'];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-4xl font-black text-white tracking-tight">
            Welcome back, <span style={{ color: 'var(--accent-color)' }}>{user.user_metadata.full_name || 'Focused User'}</span>
          </h1>
          <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>Here's your productivity deep-dive for the week.</p>
        </motion.div>
        <button 
          onClick={handleSignOut}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
        >
          <LogOut size={16} /> Sign Out
        </button>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6 mb-12">
        <StatCard 
          icon={<Target className="text-[#4caf50]" />} 
          label="Goals Reached" 
          val={stats.goals} 
          sub="3 more than last week" 
        />
        <StatCard 
          icon={<Skull className="text-red-500" />} 
          label="Total Interruptions" 
          val={stats.interruptions} 
          sub="Downward trend detected" 
        />
        <StatCard 
          icon={<Clock className="text-sky-500" />} 
          label="Total Focus Hours" 
          val={stats.focusTime} 
          sub="Avg. 2.6h per day" 
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Main Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 p-6 rounded-2xl"
          style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
        >
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <LineChart size={18} style={{ color: 'var(--accent-color)' }} />
              Focus Trends (Minutes)
            </h3>
          </div>
          <div className="h-72 w-full min-h-[288px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={288}>
              <ReBarChart data={stats.sessions}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#666', fontSize: 12 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#666', fontSize: 12 }} 
                />
                <Tooltip 
                  cursor={{ fill: 'transparent' }} 
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                />
                <Bar dataKey="minutes" fill="var(--accent-color)" radius={[6, 6, 0, 0]} />
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Distractions Table */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 rounded-2xl"
          style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
        >
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <PieChartIcon size={18} className="text-red-500" />
            Top Sites Visited
          </h3>
          <div className="space-y-4">
            {stats.bridgeStatus === 'disconnected' ? (
              <div className="p-4 bg-[#f4433611] border border-[#f4433644] rounded-xl text-center">
                <p className="text-sm font-bold text-[#f44336] mb-1">Extension Link Broken</p>
                <p className="text-xs text-[#aaa]">Please hard refresh this page (F5) so the dashboard can reconnect to your browser extension.</p>
              </div>
            ) : stats.bridgeStatus === 'connecting' ? (
              <p className="text-[#555] text-sm text-center py-4 animate-pulse">Syncing local memory...</p>
            ) : stats.distractions && stats.distractions.length > 0 ? (
              stats.distractions.map((d, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-[#0c0c0c] rounded-xl border border-transparent hover:border-[#333] transition-all">
                  <span className="text-sm font-medium text-[#aaa] truncate max-w-[120px]">{d.domain}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-1.5 bg-[#222] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-500 rounded-full" 
                        style={{ width: `${(d.hits / stats.distractions[0].hits) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-white">{d.hits}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[#555] text-sm text-center py-4">No top sites visited today. Great focus!</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Recent History Table */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-8 rounded-2xl"
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
      >
        <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
          <History size={22} className="text-sky-500" />
          Extended Session Logs
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#222]">
                <th className="pb-4 text-[#666] font-bold text-xs uppercase tracking-wider">Goal / Session Name</th>
                <th className="pb-4 text-[#666] font-bold text-xs uppercase tracking-wider">Time Spent</th>
                <th className="pb-4 text-[#666] font-bold text-xs uppercase tracking-wider">Timestamp</th>
                <th className="pb-4 text-[#666] font-bold text-xs uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {stats.allSessions && stats.allSessions.length > 0 ? (
                stats.allSessions.map((session, idx) => (
                  <SessionRow 
                    key={session.id || idx}
                    goal={session.goal} 
                    time={`${Math.floor(session.duration / 60)}m`} 
                    date={new Date(session.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} 
                    status={session.status}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-[#555] text-sm">
                    No sessions synced yet. Start focusing in the extension!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

const StatCard = ({ icon, label, val, sub }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="p-6 rounded-2xl"
    style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
  >
    <div className="w-12 h-12 bg-[#0c0c0c] rounded-xl flex items-center justify-center mb-4 border border-[#333]">
      {icon}
    </div>
    <p className="text-[#888] text-sm font-semibold">{label}</p>
    <h4 className="text-2xl font-black mt-1">{val}</h4>
    <p className="text-[#555] text-xs mt-2">{sub}</p>
  </motion.div>
);

const SessionRow = ({ goal, time, date, status }) => {
  const isCompleted = status === 'Completed';
  return (
    <tr className="hover:bg-[#1a1a1a] transition-colors group">
      <td className="py-4 text-sm font-bold text-white pr-4">{goal}</td>
      <td className="py-4 text-sm text-[#888] font-medium">{time}</td>
      <td className="py-4 text-sm text-[#888] font-medium">{date}</td>
      <td className="py-4">
        <span className={`px-3 py-1 text-[10px] font-black uppercase rounded-full border ${
          isCompleted 
            ? 'bg-[#4caf5022] text-[#4caf50] border-[#4caf5044]' 
            : 'bg-[#f4433622] text-[#f44336] border-[#f4433644]'
        }`}>
          {status}
        </span>
      </td>
    </tr>
  );
};

export default Dashboard;
