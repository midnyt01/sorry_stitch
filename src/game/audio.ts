// Chiptune audio engine: original Hawaiian-flavored melody + synthesized SFX.
// All sounds are generated with the Web Audio API — no audio files.

export type SfxName =
  | "jump"
  | "stomp"
  | "squish"
  | "collect"
  | "cube"
  | "powerup"
  | "hurt"
  | "die"
  | "checkpoint"
  | "flag"
  | "throw"
  | "block"
  | "splash"
  | "turnaround";

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  private musicOn = false;
  private musicTimer: number | null = null;
  private step = 0;
  private muted = false;

  // Original melody in A major pentatonic + a bit of Hawaiian lilt.
  // Frequencies via a note table below.
  private seq: number[] = [
    // bar 1
    440, 523.25, 587.33, 523.25, 440, 523.25, 659.25, 587.33,
    // bar 2
    659.25, 587.33, 523.25, 587.33, 659.25, 783.99, 659.25, 587.33,
    // bar 3
    440, 523.25, 587.33, 659.25, 880, 659.25, 587.33, 523.33,
    // bar 4
    587.33, 659.25, 587.33, 523.25, 440, 392, 440, 493.88,
    // bar 5
    523.25, 587.33, 659.25, 783.99, 880, 783.99, 659.25, 587.33,
    // bar 6
    523.25, 587.33, 659.25, 587.33, 523.25, 493.88, 523.25, 440,
    // bar 7
    392, 440, 493.88, 523.25, 587.33, 523.25, 493.88, 440,
    // bar 8
    440, 523.25, 587.33, 523.25, 440, 392, 392, 440,
  ];
  private bass: number[] = [
    110, 110, 220, 110, 146.83, 146.83, 293.66, 146.83,
    130.81, 130.81, 261.63, 130.81, 196, 196, 392, 196,
    164.81, 164.81, 329.63, 164.81, 220, 220, 440, 220,
    146.83, 146.83, 293.66, 146.83, 164.81, 164.81, 329.63, 164.81,
  ];

  init() {
    if (this.ctx) return;
    const Ctor =
      (window.AudioContext as any) || (window as any).webkitAudioContext;
    this.ctx = new Ctor();
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(ctx.destination);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.master);
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 0.7;
    this.sfxGain.connect(this.master);

    // noise buffer for splashes / stomps
    const len = ctx.sampleRate * 1;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }

  isMuted() {
    return this.muted;
  }

  startMusic() {
    this.init();
    if (this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    const stepDur = 0.14; // ~85 BPM eighth notes
    const tick = () => {
      if (!this.musicOn || !this.ctx) return;
      this.scheduleStep(this.step);
      this.step = (this.step + 1) % this.seq.length;
      this.musicTimer = window.setTimeout(tick, stepDur * 1000);
    };
    tick();
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleStep(i: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    // lead
    this.pluck(this.seq[i % this.seq.length], t, 0.16, "square", this.musicGain!, 0.18);
    // off-beat soft lead
    this.pluck(this.seq[(i + 4) % this.seq.length], t + 0.07, 0.08, "triangle", this.musicGain!, 0.08);
    // bass on beats
    if (i % 2 === 0) {
      const b = this.bass[Math.floor(i / 2) % this.bass.length];
      this.pluck(b, t, 0.2, "triangle", this.musicGain!, 0.35, 0.5);
    }
  }

  private pluck(
    freq: number,
    time: number,
    dur: number,
    type: OscillatorType,
    dest: AudioNode,
    vol: number,
    detuneRatio = 1
  ) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq * detuneRatio;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g);
    g.connect(dest);
    o.start(time);
    o.stop(time + dur + 0.02);
  }

  sfx(name: SfxName) {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const dest = this.sfxGain;
    switch (name) {
      case "jump":
        this.sweep(300, 720, 0.16, "square", dest, 0.25);
        break;
      case "stomp":
        this.sweep(500, 120, 0.14, "square", dest, 0.3);
        this.noiseBurst(t, 0.08, 0.15, 1400, dest);
        break;
      case "squish":
        this.sweep(200, 60, 0.18, "sawtooth", dest, 0.25);
        this.noiseBurst(t, 0.1, 0.2, 900, dest);
        break;
      case "collect":
        this.buzz(880, 0.05, dest, 0.22, "square");
        this.buzz(1320, 0.06, dest, 0.2, "square", t + 0.05);
        break;
      case "cube":
        this.buzz(660, 0.06, dest, 0.2, "triangle");
        this.buzz(990, 0.07, dest, 0.2, "triangle", t + 0.07);
        this.buzz(1480, 0.08, dest, 0.18, "triangle", t + 0.14);
        break;
      case "powerup":
        this.sweep(400, 1200, 0.3, "square", dest, 0.25);
        this.sweep(600, 1600, 0.3, "triangle", dest, 0.15, t + 0.05);
        break;
      case "hurt":
        this.sweep(300, 90, 0.25, "sawtooth", dest, 0.28);
        break;
      case "die":
        this.sweep(600, 100, 0.5, "square", dest, 0.28);
        break;
      case "checkpoint":
        this.buzz(523.25, 0.08, dest, 0.2, "triangle");
        this.buzz(784, 0.12, dest, 0.2, "triangle", t + 0.08);
        break;
      case "flag":
        this.buzz(523.25, 0.09, dest, 0.22, "square");
        this.buzz(659.25, 0.09, dest, 0.22, "square", t + 0.09);
        this.buzz(783.99, 0.09, dest, 0.22, "square", t + 0.18);
        this.buzz(1046.5, 0.18, dest, 0.24, "square", t + 0.27);
        break;
      case "throw":
        this.sweep(700, 200, 0.12, "square", dest, 0.18);
        break;
      case "block":
        this.sweep(200, 120, 0.08, "square", dest, 0.2);
        this.noiseBurst(t, 0.05, 0.1, 2000, dest);
        break;
      case "splash":
        this.noiseBurst(t, 0.25, 0.25, 1200, dest);
        break;
      case "turnaround":
        this.sweep(300, 500, 0.08, "square", dest, 0.15);
        break;
    }
  }

  private buzz(
    freq: number,
    dur: number,
    dest: AudioNode,
    vol: number,
    type: OscillatorType = "square",
    startAt?: number
  ) {
    if (!this.ctx) return;
    const t = startAt ?? this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private sweep(
    from: number,
    to: number,
    dur: number,
    type: OscillatorType,
    dest: AudioNode,
    vol: number,
    startAt?: number
  ) {
    if (!this.ctx) return;
    const t = startAt ?? this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseBurst(t: number, dur: number, vol: number, freq: number, dest: AudioNode) {
    if (!this.ctx || !this.noise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = freq;
    filt.Q.value = 1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(dest);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}
