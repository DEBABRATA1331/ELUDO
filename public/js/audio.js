/**
 * Web Audio API Sound Synthesizer
 * Pure JS procedural sound generator (No external MP3 files needed)
 */

const SoundFX = (function () {
  let audioCtx = null;
  let muted = false;
  let currentVoiceAudio = null;

  function initCtx() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.1) {
    if (muted) return;
    try {
      initCtx();
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play tone error', e);
    }
  }

  return {
    toggleMute: function () {
      muted = !muted;
      return muted;
    },
    isMuted: function () {
      return muted;
    },
    playClick: function () {
      playTone(600, 'triangle', 0.04, 0.08);
    },
    playRoll: function () {
      if (muted) return;
      initCtx();
      let count = 0;
      const interval = setInterval(() => {
        playTone(300 + Math.random() * 400, 'square', 0.03, 0.05);
        count++;
        if (count > 6) clearInterval(interval);
      }, 50);
    },
    playMove: function () {
      playTone(440, 'sine', 0.08, 0.12);
    },
    playCapture: function () {
      if (muted) return;
      initCtx();
      playTone(150, 'sawtooth', 0.15, 0.25);
      setTimeout(() => playTone(100, 'sawtooth', 0.25, 0.3), 100);
    },
    playHome: function () {
      if (muted) return;
      initCtx();
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        setTimeout(() => playTone(freq, 'sine', 0.15, 0.15), idx * 80);
      });
    },
    playWin: function () {
      if (muted) return;
      initCtx();
      const fanfare = [
        { f: 523.25, d: 0.15 }, { f: 659.25, d: 0.15 }, { f: 783.99, d: 0.15 },
        { f: 1046.50, d: 0.4 }
      ];
      fanfare.forEach((n, idx) => {
        setTimeout(() => playTone(n.f, 'triangle', n.d, 0.25), idx * 150);
      });
    },
    playPoke: function () {
      if (muted) return;
      initCtx();
      playTone(800, 'square', 0.08, 0.2);
      setTimeout(() => playTone(1200, 'triangle', 0.12, 0.2), 60);
    },
    playStep: function () {
      if (muted) return;
      initCtx();
      playTone(480, 'sine', 0.05, 0.15);
    },
    playVoiceClip: function (clipPath) {
      if (muted || !clipPath) return;
      try {
        if (currentVoiceAudio) {
          currentVoiceAudio.pause();
          currentVoiceAudio.currentTime = 0;
        }
        currentVoiceAudio = new Audio(encodeURI(clipPath));
        currentVoiceAudio.volume = 0.95;
        currentVoiceAudio.play().catch(e => console.warn('Audio play error', e));
      } catch (e) {
        console.warn('Voice play error', e);
      }
    }
  };
})();
