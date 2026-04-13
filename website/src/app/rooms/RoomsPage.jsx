import React from 'react';
import { motion } from 'framer-motion';
import { Users, Globe, Lock } from 'lucide-react';

const RoomsPage = () => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
    <header className='mb-12'>
      <h1 className='text-4xl font-black mb-2'>Focus Rooms Browser</h1>
      <p className='text-secondary'>Join public study groups or enter a private room code.</p>
    </header>
    
    <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
      <div className='p-10 rounded-2xl border-2 border-dashed border-border flex flex-col items-center text-center'>
         <Globe size={32} className='text-accent mb-4' />
         <h4 className='font-bold mb-2'>Public Rooms</h4>
         <p className='text-xs text-secondary'>Browse active sessions by category (Deep Work, Study, etc.)</p>
         <div className='mt-6 space-y-2 w-full'>
            <div className='p-3 rounded-xl bg-white/5 border border-border text-xs text-left flex justify-between'>
               <span>📚 Lofi Library</span>
               <span className='text-accent'>12 Focusing</span>
            </div>
         </div>
      </div>
      <div className='p-10 rounded-2xl border-2 border-dashed border-border flex flex-col items-center text-center'>
         <Lock size={32} className='text-accent mb-4' />
         <h4 className='font-bold mb-2'>Enter Private Code</h4>
         <p className='text-xs text-secondary'>Join your squad by entering their unique 6-digit room code.</p>
         <input type='text' placeholder='ABC123' className='mt-6 w-full p-3 rounded-xl bg-white/5 border border-border text-center font-bold tracking-widest' />
         <button className='mt-4 w-full p-3 rounded-xl bg-accent text-white font-bold'>Join Session</button>
      </div>
    </div>
  </motion.div>
);

export default RoomsPage;
