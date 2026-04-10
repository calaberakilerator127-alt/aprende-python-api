import { useCallback } from 'react';
import { useSettings } from './SettingsContext';

export function useSound() {
  const { soundsEnabled } = useSettings();

  const playSound = useCallback((type) => {
    if (!soundsEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const playTone = (freqs, duration = 0.2, typeOsc = 'sine', gainVal = 0.1) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = typeOsc;
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        const now = audioCtx.currentTime;
        freqs.forEach((f, i) => {
          oscillator.frequency.setValueAtTime(f, now + (i * (duration / freqs.length)));
        });
        
        gainNode.gain.setValueAtTime(gainVal, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        oscillator.start();
        oscillator.stop(now + duration);
      };

      if (type === 'click') {
        playTone([440], 0.1, 'sine', 0.05);
      } else if (type === 'success') {
        playTone([523.25, 659.25, 783.99], 0.3, 'triangle', 0.1);
      } else if (type === 'bubble') {
        playTone([800, 1200], 0.15, 'sine', 0.1);
      } else if (type === 'bell') {
        playTone([987.77, 987.77], 0.4, 'triangle', 0.1);
      } else if (type === 'classic') {
        playTone([523.25, 440, 523.25], 0.3, 'sine', 0.1);
      } else if (type === 'notification') {
        playTone([659.25, 523.25], 0.2, 'sine', 0.1);
      }
    } catch (e) {
      console.warn("AudioContext error", e);
    }
  }, [soundsEnabled]);

  return { playSound };
}
