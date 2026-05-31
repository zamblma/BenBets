import { useCallback, useRef } from 'react';

type SoundType = 'deal' | 'win' | 'lose' | 'spin' | 'crash' | 'cashout' | 'click' | 'reveal' | 'rare' | 'levelup';

const audioCtx = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

function playTone(freq: number, duration: number, type: OscillatorType = 'square', volume = 0.1) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playNoise(duration: number, volume = 0.05) {
  if (!audioCtx) return;
  const bufferSize = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  source.connect(gain);
  gain.connect(audioCtx.destination);
  source.start();
}

const SOUNDS: Record<SoundType, () => void> = {
  deal: () => { playTone(523, 0.08); setTimeout(() => playTone(659, 0.08), 80); },
  win: () => { playTone(523, 0.1); setTimeout(() => playTone(659, 0.1), 100); setTimeout(() => playTone(784, 0.15), 200); setTimeout(() => playTone(1047, 0.3), 300); },
  lose: () => { playTone(330, 0.15); setTimeout(() => playTone(262, 0.3), 150); },
  spin: () => { playNoise(0.1, 0.03); },
  crash: () => { playTone(200, 0.05, 'sawtooth', 0.15); setTimeout(() => playTone(100, 0.3, 'sawtooth', 0.1), 50); },
  cashout: () => { playTone(784, 0.08); setTimeout(() => playTone(988, 0.08), 80); setTimeout(() => playTone(1175, 0.2), 160); },
  click: () => { playTone(600, 0.03, 'square', 0.04); },
  reveal: () => { playTone(440, 0.06); setTimeout(() => playTone(554, 0.06), 60); setTimeout(() => playTone(659, 0.1), 120); },
  rare: () => { playTone(523, 0.08); setTimeout(() => playTone(659, 0.08), 80); setTimeout(() => playTone(784, 0.08), 160); setTimeout(() => playTone(1047, 0.3), 240); },
  levelup: () => { playTone(392, 0.1); setTimeout(() => playTone(523, 0.1), 120); setTimeout(() => playTone(659, 0.1), 240); setTimeout(() => playTone(784, 0.1), 360); setTimeout(() => playTone(1047, 0.4), 480); },
};

export function useSound() {
  const resumeAudio = useCallback(() => {
    if (audioCtx?.state === 'suspended') audioCtx.resume();
  }, []);

  const play = useCallback((type: SoundType) => {
    resumeAudio();
    SOUNDS[type]?.();
  }, [resumeAudio]);

  return { play, resumeAudio };
}
