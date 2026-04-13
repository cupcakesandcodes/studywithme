import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { 
  Users, 
  MessageSquare, 
  Send, 
  Play, 
  Square, 
  X,
  Crown,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const LiveRoom = ({ room, user, onLeave, extensionFocusData }) => {
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [roomTimer, setRoomTimer] = useState({ isRunning: false, remaining: room.timer_duration || 1500 });
  const chatEndRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    // 1. Join Realtime Channel
    const channel = supabase.channel(`room:${room.code}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channelRef.current = channel;

    // 2. Handle Presence
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const presences = Object.values(state).flat();
        setParticipants(presences);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('Join:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('Leave:', key, leftPresences);
      });

    // 3. Handle Broadcasts
    channel.on('broadcast', { event: 'timer-update' }, ({ payload }) => {
      setRoomTimer(payload);
    });

    // 4. Fetch/Listen to Messages
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('room_messages')
        .select('*')
        .eq('room_id', room.id)
        .order('created_at', { ascending: true })
        .limit(50);
      
      if (data) setMessages(data);
    };

    fetchMessages();

    const msgSubscription = supabase
      .channel(`room_messages:${room.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${room.id}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new]);
        }
      )
      .subscribe();

    // 5. Initial Presence Track
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const isFocusing = extensionFocusData?.isRunning || false;
        await channel.track({
          user_id: user.id,
          name: user.user_metadata?.full_name || user.email,
          avatar: user.user_metadata?.avatar_url,
          status: isFocusing ? 'focusing' : 'idle',
          joined_at: new Date().toISOString()
        });
      }
    });

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(msgSubscription);
    };
  }, [room.id, room.code, user.id]);

  // Update presence status when extension focus data changes
  useEffect(() => {
    if (channelRef.current) {
      const isFocusing = extensionFocusData?.isRunning || false;
      channelRef.current.track({
        user_id: user.id,
        name: user.user_metadata?.full_name || user.email,
        avatar: user.user_metadata?.avatar_url,
        status: isFocusing ? 'focusing' : 'idle',
        joined_at: new Date().toISOString()
      });
    }
  }, [extensionFocusData?.isRunning, user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Timer logic for host
  useEffect(() => {
    let interval;
    if (roomTimer.isRunning && roomTimer.remaining > 0) {
      interval = setInterval(() => {
        setRoomTimer(prev => {
          const next = { ...prev, remaining: prev.remaining - 1 };
          if (user.id === room.host_id) {
            channelRef.current?.send({
              type: 'broadcast',
              event: 'timer-update',
              payload: next
            });
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [roomTimer.isRunning, room.host_id, user.id]);

  const handleStartTimer = () => {
    if (user.id !== room.host_id) return;
    const newState = { isRunning: true, remaining: room.timer_duration || 1500 };
    setRoomTimer(newState);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'timer-update',
      payload: newState
    });
  };

  const handleStopTimer = () => {
    if (user.id !== room.host_id) return;
    const newState = { ...roomTimer, isRunning: false };
    setRoomTimer(newState);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'timer-update',
      payload: newState
    });
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const { error } = await supabase.from('room_messages').insert({
      room_id: room.id,
      user_id: user.id,
      content: newMessage.trim()
    });

    if (!error) setNewMessage('');
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isHost = user.id === room.host_id;

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] sticky top-32 overflow-hidden shadow-2xl rounded-2xl border border-border" style={{ background: 'var(--card-bg)' }}>
      {/* Sidebar Header */}
      <div className="p-4 border-b border-border" style={{ background: 'color-mix(in srgb, var(--accent-color) 4%, transparent)' }}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="text-sm font-black truncate" style={{ color: 'var(--text-primary)' }}>
              {room.name || 'Group Focus'}
            </h3>
            <span className="text-[10px] font-mono opacity-60 flex items-center gap-1">
              <Crown size={10} className="text-yellow-500" /> {isHost ? 'Host' : 'Member'} • {room.code}
            </span>
          </div>
          <button 
            onClick={onLeave}
            className="p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
          >
            <X size={16} />
          </button>
        </div>

        {/* Vertical Timer Block */}
        <div className="flex flex-col items-center gap-3 py-3 rounded-xl bg-black/10 border border-white/5">
          <div className="text-3xl font-black font-mono tracking-tighter" style={{ color: 'var(--text-primary)' }}>
            {formatTime(roomTimer.remaining)}
          </div>
          {isHost && (
            <button 
              onClick={roomTimer.isRunning ? handleStopTimer : handleStartTimer}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold transition-all shadow-lg active:scale-95`}
              style={{ 
                background: roomTimer.isRunning ? 'var(--timer-sep)' : 'var(--accent-color)', 
                color: '#fff' 
              }}
            >
              {roomTimer.isRunning ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
              {roomTimer.isRunning ? 'Pause' : 'Start Focus'}
            </button>
          )}
        </div>
      </div>

      {/* Main Sidebar Area (Participants + Chat) */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Participants (Scrollable) */}
        <div className="p-4 flex-none border-b border-border max-h-[220px] overflow-y-auto">
          <h4 className="text-[10px] font-black uppercase tracking-widest mb-3 flex justify-between items-center" style={{ color: 'var(--text-secondary)' }}>
            Active Squad <span>({participants.length})</span>
          </h4>
          <div className="space-y-3">
            {participants.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="relative flex-shrink-0">
                  {p.avatar ? (
                    <img src={p.avatar} className="w-8 h-8 rounded-full border border-border" alt="" />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[10px]" style={{ background: 'var(--accent-color)' }}>
                      {(p.name || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div 
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2`} 
                    style={{ 
                      borderColor: 'var(--card-bg)', 
                      background: p.status === 'focusing' ? '#4caf50' : '#888' 
                    }} 
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                  <p className="text-[9px] truncate" style={{ color: 'var(--text-secondary)' }}>
                    {p.status === 'focusing' ? 'Currently Deep Focusing' : 'Ambient Presence'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat (Rest of Space) */}
        <div className="flex-1 flex flex-col min-h-0" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex flex-col ${m.user_id === user.id ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[90%] px-3 py-1.5 rounded-xl text-xs ${
                  m.user_id === user.id ? 'text-white' : 'bg-white/5 border border-border'
                }`} style={m.user_id === user.id ? { background: 'var(--accent-color)' } : { color: 'var(--text-primary)' }}>
                  {m.content}
                </div>
                <span className="text-[8px] mt-1 opacity-50 px-1">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={sendMessage} className="p-3 border-t border-border mt-auto bg-card">
            <div className="flex gap-1.5 p-1 bg-white/5 border border-border rounded-xl">
              <input 
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Send encouragement..."
                className="flex-1 bg-transparent border-none px-2 py-1 text-xs focus:outline-none"
                style={{ color: 'var(--text-primary)' }}
              />
              <button 
                type="submit"
                className="p-1.5 rounded-lg hover:opacity-90 transition-opacity"
                style={{ background: 'var(--accent-color)', color: '#fff' }}
              >
                <Send size={14} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LiveRoom;
