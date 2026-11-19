import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type SoundType =
  | 'deal'
  | 'win'
  | 'lose'
  | 'spin'
  | 'crash'
  | 'cashout'
  | 'click'
  | 'reveal'
  | 'rare'
  | 'levelup'
  | 'packOpen'
  | 'cardFlip'
  | 'tick'
  | 'legendary';

const MUTE_STORAGE_KEY = 'benbets_sound_muted';

let globalMuted = (() => {
  try {
    return typeof window !== 'undefined' && localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
})();

const muteListeners = new Set<(muted: boolean) => void>();

function setGlobalMuted(next: boolean) {
  globalMuted = next;
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, next ? '1' : '0');
  } catch {}
  muteListeners.forEach((cb) => cb(next));
}

const audioCtx: AudioContext | null =
  typeof window !== 'undefined'
    ? new (window.AudioContext || (window as any).webkitAudioContext)()
    : null;

let masterInput: AudioNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function getMasterInput(): AudioNode | null {
  if (!audioCtx) return null;
  if (masterInput) return masterInput;

  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-18, audioCtx.currentTime);
  compressor.knee.setValueAtTime(18, audioCtx.currentTime);
  compressor.ratio.setValueAtTime(4, audioCtx.currentTime);
  compressor.attack.setValueAtTime(0.005, audioCtx.currentTime);
  compressor.release.setValueAtTime(0.15, audioCtx.currentTime);

  const masterGain = audioCtx.createGain();
  masterGain.gain.setValueAtTime(0.85, audioCtx.currentTime);

  compressor.connect(masterGain);
  masterGain.connect(audioCtx.destination);
  masterInput = compressor;
  return masterInput;
}

function getNoiseBuffer(): AudioBuffer | null {
  if (!audioCtx) return null;
  if (noiseBuffer) return noiseBuffer;
  const len = Math.floor(audioCtx.sampleRate * 0.4);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buf;
  return noiseBuffer;
}

interface CrystalNoteOpts {
  duration?: number;
  type?: 'sine' | 'triangle';
  volume?: number;
  delayMs?: number;
  slideTo?: number;
  cutoff?: number;
  harmonic?: boolean;
}

function playCrystalNote(freq: number, opts: CrystalNoteOpts = {}) {
  if (!audioCtx || globalMuted) return;
  const dest = getMasterInput();
  if (!dest) return;

  const {
    duration = 0.24,
    type = 'sine',
    volume = 0.036,
    delayMs = 0,
    slideTo,
    cutoff = 3200,
    harmonic = false,
  } = opts;

  const t0 = audioCtx.currentTime + delayMs / 1000;
  const attack = Math.min(0.008, duration * 0.25);

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cutoff, t0);
  filter.Q.setValueAtTime(0.7, t0);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  const osc = audioCtx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + duration);
  }

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);

  if (harmonic) {
    const harmOsc = audioCtx.createOscillator();
    const harmGain = audioCtx.createGain();
    harmOsc.type = 'sine';
    harmOsc.frequency.setValueAtTime(freq * 2, t0);
    harmGain.gain.setValueAtTime(0.0001, t0);
    harmGain.gain.linearRampToValueAtTime(volume * 0.2, t0 + attack);
    harmGain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration * 0.78);
    harmOsc.connect(harmGain);
    harmGain.connect(filter);
    harmOsc.start(t0);
    harmOsc.stop(t0 + duration + 0.02);
  }
}

interface VelvetSweepOpts {
  duration?: number;
  startFreq?: number;
  endFreq?: number;
  volume?: number;
  delayMs?: number;
  q?: number;
}

function playVelvetSweep(opts: VelvetSweepOpts = {}) {
  if (!audioCtx || globalMuted) return;
  const dest = getMasterInput();
  const buf = getNoiseBuffer();
  if (!dest || !buf) return;

  const {
    duration = 0.08,
    startFreq = 600,
    endFreq = 1600,
    volume = 0.022,
    delayMs = 0,
    q = 1.4,
  } = opts;

  const t0 = audioCtx.currentTime + delayMs / 1000;
  const attack = Math.min(0.008, duration * 0.25);

  const src = audioCtx.createBufferSource();
  src.buffer = buf;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.setValueAtTime(q, t0);
  filter.frequency.setValueAtTime(startFreq, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(80, endFreq), t0 + duration);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

const SOUNDS: Record<SoundType, () => void> = {
  click: () => {
    playCrystalNote(540, { duration: 0.032, type: 'sine', volume: 0.02, slideTo: 360, cutoff: 2200 });
  },
  tick: () => {
    playCrystalNote(860, { duration: 0.02, type: 'triangle', volume: 0.018, slideTo: 480, cutoff: 1800 });
  },
  cardFlip: () => {
    playVelvetSweep({ duration: 0.055, startFreq: 900, endFreq: 2100, volume: 0.018 });
    playCrystalNote(466, { duration: 0.11, type: 'sine', volume: 0.028, slideTo: 587, cutoff: 2600 });
  },
  deal: () => {
    playVelvetSweep({ duration: 0.05, startFreq: 850, endFreq: 1900, volume: 0.016 });
    playCrystalNote(466, { duration: 0.1, type: 'sine', volume: 0.026, slideTo: 587, cutoff: 2500 });
  },
  packOpen: () => {
    playVelvetSweep({ duration: 0.16, startFreq: 380, endFreq: 1850, volume: 0.028, q: 1.1 });
    playCrystalNote(587.33, { duration: 0.16, type: 'sine', volume: 0.034, delayMs: 25, harmonic: true });
    playCrystalNote(880, { duration: 0.2, type: 'sine', volume: 0.036, delayMs: 95, harmonic: true });
    playCrystalNote(1318.51, { duration: 0.28, type: 'sine', volume: 0.032, delayMs: 165, harmonic: true });
  },
  spin: () => {
    playVelvetSweep({ duration: 0.09, startFreq: 480, endFreq: 1100, volume: 0.024, q: 1.3 });
  },
  reveal: () => {
    // F5 -> A5 -> C6
    playCrystalNote(698.46, { duration: 0.18, type: 'sine', volume: 0.034, delayMs: 0, harmonic: true });
    playCrystalNote(880.0, { duration: 0.2, type: 'sine', volume: 0.036, delayMs: 55, harmonic: true });
    playCrystalNote(1046.5, { duration: 0.28, type: 'sine', volume: 0.038, delayMs: 110, harmonic: true });
  },
  rare: () => {
    // Cmaj9 crystalline arpeggio: C5 -> E5 -> G5 -> B5 -> D6
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66];
    notes.forEach((freq, i) => {
      playCrystalNote(freq, {
        duration: i === notes.length - 1 ? 0.42 : 0.22,
        type: 'sine',
        volume: 0.042,
        delayMs: i * 62,
        harmonic: true,
        cutoff: 3400,
      });
    });
  },
  legendary: () => {
    // Warm filtered pad (G4 + D5) + sparkling Gmaj7 cascade
    playCrystalNote(392.0, { duration: 0.55, type: 'triangle', volume: 0.032, cutoff: 1400 });
    playCrystalNote(587.33, { duration: 0.55, type: 'triangle', volume: 0.026, delayMs: 30, cutoff: 1600 });
    const cascade = [783.99, 987.77, 1174.66, 1479.98, 1567.98];
    cascade.forEach((freq, i) => {
      playCrystalNote(freq, {
        duration: i === cascade.length - 1 ? 0.52 : 0.24,
        type: 'sine',
        volume: 0.046,
        delayMs: 40 + i * 68,
        harmonic: true,
        cutoff: 3600,
      });
    });
  },
  levelup: () => {
    SOUNDS.legendary();
  },
  win: () => {
    // E5 -> G#5 -> B5 -> E6
    const notes = [659.25, 830.61, 987.77, 1318.51];
    notes.forEach((freq, i) => {
      playCrystalNote(freq, {
        duration: i === notes.length - 1 ? 0.36 : 0.18,
        type: 'sine',
        volume: 0.042,
        delayMs: i * 65,
        harmonic: true,
      });
    });
  },
  cashout: () => {
    SOUNDS.win();
  },
  lose: () => {
    // Gentle muted E4 -> C#4
    playCrystalNote(329.63, { duration: 0.18, type: 'triangle', volume: 0.026, cutoff: 800 });
    playCrystalNote(277.18, { duration: 0.26, type: 'triangle', volume: 0.024, delayMs: 110, cutoff: 760 });
  },
  crash: () => {
    playCrystalNote(175, { duration: 0.34, type: 'triangle', volume: 0.04, slideTo: 60, cutoff: 400 });
    playVelvetSweep({ duration: 0.18, startFreq: 420, endFreq: 110, volume: 0.024, q: 0.9 });
  },
};

interface EngineSound {
  start: (baseFreq?: number, waveType?: OscillatorType) => void;
  setFreq: (freq: number) => void;
  stop: () => void;
}

export function useSound() {
  const oscRef = useRef<OscillatorNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const engineRunning = useRef(false);
  const [muted, setMuted] = useState<boolean>(globalMuted);

  useEffect(() => {
    const listener = (next: boolean) => setMuted(next);
    muteListeners.add(listener);
    return () => {
      muteListeners.delete(listener);
    };
  }, []);

  const resumeAudio = useCallback(() => {
    if (audioCtx?.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }, []);

  const toggleMute = useCallback(() => {
    const next = !globalMuted;
    setGlobalMuted(next);
    if (next) {
      // Immediately silence active engine if muted mid-flight
      try {
        if (audioCtx && gainRef.current) {
          gainRef.current.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.02);
        }
      } catch {}
    } else {
      resumeAudio();
      playCrystalNote(660, { duration: 0.05, type: 'sine', volume: 0.022, slideTo: 880 });
    }
  }, [resumeAudio]);

  const play = useCallback(
    (type: SoundType) => {
      if (globalMuted) return;
      resumeAudio();
      SOUNDS[type]?.();
    },
    [resumeAudio]
  );

  const engine: EngineSound = useMemo(
    () => ({
      start: (baseFreq = 90, waveType: OscillatorType = 'triangle') => {
        if (!audioCtx || globalMuted) return;
        const dest = getMasterInput();
        if (!dest) return;
        resumeAudio();
        if (engineRunning.current) return;

        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const filter = audioCtx.createBiquadFilter();
        const gain = audioCtx.createGain();

        osc.type = waveType === 'sawtooth' ? 'triangle' : waveType;
        osc.frequency.setValueAtTime(baseFreq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(460, now);
        filter.Q.setValueAtTime(1.1, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.015, now + 0.05);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        osc.start(now);

        oscRef.current = osc;
        filterRef.current = filter;
        gainRef.current = gain;
        engineRunning.current = true;
      },
      setFreq: (freq: number) => {
        if (!audioCtx || !oscRef.current || globalMuted || !Number.isFinite(freq)) return;
        const now = audioCtx.currentTime;
        oscRef.current.frequency.setTargetAtTime(Math.max(60, freq), now, 0.04);
        if (filterRef.current) {
          filterRef.current.frequency.setTargetAtTime(Math.min(1100, 360 + freq * 1.1), now, 0.05);
        }
      },
      stop: () => {
        const osc = oscRef.current;
        const filter = filterRef.current;
        const gain = gainRef.current;
        oscRef.current = null;
        filterRef.current = null;
        gainRef.current = null;
        engineRunning.current = false;

        if (!osc || !gain || !audioCtx) return;
        try {
          const now = audioCtx.currentTime;
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
          gain.gain.linearRampToValueAtTime(0.0001, now + 0.05);
          setTimeout(() => {
            try { osc.stop(); } catch {}
            try { osc.disconnect(); } catch {}
            try { filter?.disconnect(); } catch {}
            try { gain.disconnect(); } catch {}
          }, 65);
        } catch {
          try { osc.stop(); } catch {}
        }
      },
    }),
    [resumeAudio]
  );

  const playFile = useCallback(
    (url: string, volume = 0.16) => {
      if (globalMuted) return;
      resumeAudio();
      const audio = new Audio(url);
      audio.volume = volume;
      audio.play().catch(() => {});
    },
    [resumeAudio]
  );

  return { play, resumeAudio, engine, playFile, muted, toggleMute };
}
