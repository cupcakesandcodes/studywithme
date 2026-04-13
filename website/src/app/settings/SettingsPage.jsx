import React from 'react';
import { motion } from 'framer-motion';
import { Settings, Palette, User, Shield } from 'lucide-react';

const SettingsPage = () => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
    <header className='mb-12'>
      <h1 className='text-4xl font-black mb-2'>Settings</h1>
      <p className='text-secondary'>Manage your account, theme preferences, and extension sync.</p>
    </header>
    
    <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
      <div className='p-6 rounded-2xl border border-border bg-card'>
        <h3 className='text-lg font-bold mb-4 flex items-center gap-2'><Palette size={18} className='text-accent' /> Appearance</h3>
        <p className='text-sm text-secondary mb-4'>Personalize your dashboard with custom color themes.</p>
        <div className='grid grid-cols-3 gap-2'>
           {['Dark Mode', 'Navy Blue', 'Forest', 'Monochrome', 'Warm', 'Deep Purple'].map(t => (
             <div key={t} className='p-3 rounded-lg border border-border text-[10px] font-bold text-center hover:border-accent cursor-pointer'>{t}</div>
           ))}
        </div>
      </div>
      
      <div className='p-6 rounded-2xl border border-border bg-card'>
        <h3 className='text-lg font-bold mb-4 flex items-center gap-2'><User size={18} className='text-accent' /> Account</h3>
        <p className='text-sm text-secondary'>Manage your display name and sync status.</p>
        <button className='mt-4 px-4 py-2 rounded-xl bg-white/5 border border-border text-xs font-bold'>Edit Profile</button>
      </div>
    </div>
  </motion.div>
);

export default SettingsPage;
