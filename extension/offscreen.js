let audioCtx = null;
let noiseNode = null;
let rainNodes = [];
let emptyRoomNodes = [];
let binauralNodes = [];
const audioPlayer = document.getElementById('audio-player') || document.createElement('audio');

chrome.runtime.onMessage.addListener((message) => {
  if (message.target !== 'offscreen') return;

  if (message.type === 'PLAY_AUDIO') {
    handlePlaySound(message.sound);
  } else if (message.type === 'STOP_AUDIO') {
    handleStopSound();
  }
});

function handlePlaySound(sound) {
  handleStopSound(); 

  if (sound === 'brown-noise' || sound === 'white-noise' || sound === 'binaural-beats' || sound === 'rain-music' || sound === 'empty-room') {
    startSyntheticSound(sound);
  } else {
    startLocalSound(sound);
  }
}

function handleStopSound() {
  audioPlayer.pause();
  audioPlayer.src = '';

  if (noiseNode) {
    try { noiseNode.stop(); noiseNode.disconnect(); } catch(e) {}
    noiseNode = null;
  }
  rainNodes.forEach(node => {
     try { node.stop(); node.disconnect(); } catch(e) {}
  });
  rainNodes = [];
  emptyRoomNodes.forEach(node => {
     try { node.stop(); node.disconnect(); } catch(e) {}
  });
  emptyRoomNodes = [];
  binauralNodes.forEach(node => {
     try { node.stop(); node.disconnect(); } catch(e) {}
  });
  binauralNodes = [];
}

function startLocalSound(sound) {
  const localMap = {
    'lofi-focus': 'assets/sounds/lofi_loop.mp3'
  };
  const path = localMap[sound];
  if (path) {
    audioPlayer.src = path;
    audioPlayer.loop = true;
    const playPromise = audioPlayer.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        // Suppress abort errors from rapid sound switching
        if (err.name !== 'AbortError' && err.name !== 'NotSupportedError') {
          console.warn('Audio Playback Error:', err);
        }
      });
    }
  }
}

function startSyntheticSound(type) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  if (type === 'white-noise') {
    noiseNode = createWhiteNoise(audioCtx);
    noiseNode.connect(audioCtx.destination);
  } else if (type === 'brown-noise') {
    noiseNode = createBrownNoise(audioCtx);
    noiseNode.connect(audioCtx.destination);
  } else if (type === 'binaural-beats') {
    startBinauralBeats(audioCtx);
  } else if (type === 'rain-music') {
    startRealRainSynthesis(audioCtx);
  } else if (type === 'empty-room') {
    startEmptyRoomSynthesis(audioCtx);
  }
}

// Synthesis Engines
function createWhiteNoise(ctx) {
  const bufferSize = 2 * ctx.sampleRate,
        buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate),
        output = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.start(0);
  return source;
}

function createBrownNoise(ctx) {
  const bufferSize = 2 * ctx.sampleRate,
        buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate),
        output = buffer.getChannelData(0);
  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    output[i] = (lastOut + (0.02 * white)) / 1.02;
    lastOut = output[i];
    output[i] *= 3.5; 
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.start(0);
  return source;
}

// THE SOUND YOU LIKED (Muffled Brown Noise)
function startEmptyRoomSynthesis(ctx) {
  const source = createBrownNoise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(600, ctx.currentTime);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  source.connect(filter).connect(gain).connect(ctx.destination);
  emptyRoomNodes = [source, filter, gain];
}

// REAL RAIN with distinct droplets
function startRealRainSynthesis(ctx) {
  // Layer 1: Base rumble and distant washing (Pink/Brown noise)
  const baseNoise = createBrownNoise(ctx);
  const baseFilter = ctx.createBiquadFilter();
  baseFilter.type = 'lowpass';
  baseFilter.frequency.setValueAtTime(1200, ctx.currentTime);
  const baseGain = ctx.createGain();
  baseGain.gain.setValueAtTime(0.15, ctx.currentTime);
  baseNoise.connect(baseFilter).connect(baseGain).connect(ctx.destination);

  // Layer 2: High-pitched splash (White noise filtered)
  const splashNoise = createWhiteNoise(ctx);
  const splashFilter = ctx.createBiquadFilter();
  splashFilter.type = 'highpass';
  splashFilter.frequency.setValueAtTime(6000, ctx.currentTime);
  const splashGain = ctx.createGain();
  splashGain.gain.setValueAtTime(0.02, ctx.currentTime);
  splashNoise.connect(splashFilter).connect(splashGain).connect(ctx.destination);

  // Layer 3: INDIVIDUAL DROPLETS
  function createDroplet() {
    if (!audioCtx) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    // Droplet is a fast frequency sweep with a very short envelope
    osc.type = 'sine';
    const freq = 1000 + Math.random() * 2000;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.1);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, ctx.currentTime);

    env.gain.setValueAtTime(0, ctx.currentTime);
    env.gain.linearRampToValueAtTime(Math.random() * 0.05 + 0.02, ctx.currentTime + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    
    osc.connect(filter).connect(env).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    
    rainNodes.push(osc, env, filter);
  }

  // Schedule random droplets
  const dropletInterval = setInterval(() => {
    if (rainNodes.length < 50) { // Limit number of active nodes
       createDroplet();
    }
    // Clean up old nodes periodically
    if (rainNodes.length > 100) rainNodes.splice(0, 50);
  }, 200 + Math.random() * 800);

  rainNodes.push(baseNoise, baseFilter, baseGain, splashNoise, splashFilter, splashGain);
  // We don't push interval to the list, we'll need to clear it in handleStopSound
  rainNodes.push({ stop: () => clearInterval(dropletInterval), disconnect: () => {} });
}

function startBinauralBeats(ctx) {
  const oscLeft = ctx.createOscillator();
  const oscRight = ctx.createOscillator();
  const panLeft = ctx.createStereoPanner();
  const panRight = ctx.createStereoPanner();
  oscLeft.type = 'sine';
  oscRight.type = 'sine';
  oscLeft.frequency.setValueAtTime(200, ctx.currentTime);
  oscRight.frequency.setValueAtTime(240, ctx.currentTime);
  panLeft.pan.setValueAtTime(-1, ctx.currentTime);
  panRight.pan.setValueAtTime(1, ctx.currentTime);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.1, ctx.currentTime); 
  oscLeft.connect(panLeft).connect(gain);
  oscRight.connect(panRight).connect(gain);
  gain.connect(ctx.destination);
  oscLeft.start();
  oscRight.start();
  binauralNodes = [oscLeft, oscRight];
}
