const VOLUME = 0.55;
const DISTANZA_RIFERIMENTO = 6;
const SPARI = Object.freeze({
  pistola: { colpo: 0.9, coda: 0.35, tono: 900 },
  revolver: { colpo: 1.1, coda: 0.55, tono: 700 },
  mitra: { colpo: 0.75, coda: 0.25, tono: 1100 },
  carabina: { colpo: 1, coda: 0.45, tono: 800 },
  pompa: { colpo: 1.25, coda: 0.6, tono: 500 },
});

export function creaAudio() {
  let ctx = null;
  let uscita = null;
  let rumore = null;
  const motori = new Map();
  let sirene = null;
  let allarme = null;
  let trapano = null;

  function prepara() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    ctx = new AudioContext();
    uscita = ctx.createGain();
    uscita.gain.value = VOLUME;
    const compressore = ctx.createDynamicsCompressor();
    uscita.connect(compressore).connect(ctx.destination);
    rumore = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = rumore.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const pronto = () => ctx && ctx.state === 'running';

  function canale(distanza = 0, pan = 0) {
    const g = ctx.createGain();
    g.gain.value = Math.min(1, DISTANZA_RIFERIMENTO / Math.max(DISTANZA_RIFERIMENTO, distanza));
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = Math.max(700, 18000 - distanza * 220);
    g.connect(filtro).connect(p).connect(uscita);
    return g;
  }

  function scoppio(destinazione, t, { durata, volume, frequenza, tipo = 'lowpass', q = 0.8 }) {
    const s = ctx.createBufferSource();
    s.buffer = rumore;
    const f = ctx.createBiquadFilter();
    f.type = tipo;
    f.frequency.value = frequenza;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durata);
    s.connect(f).connect(g).connect(destinazione);
    s.start(t, Math.random());
    s.stop(t + durata + 0.05);
  }

  function tonfo(destinazione, t, frequenza, durata, volume) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(frequenza, t);
    o.frequency.exponentialRampToValueAtTime(frequenza * 0.35, t + durata);
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durata);
    o.connect(g).connect(destinazione);
    o.start(t);
    o.stop(t + durata + 0.02);
  }

  return {
    prepara,
    sparo(arma, distanza = 0, pan = 0, silenziato = false) {
      if (!pronto()) return;
      const s = SPARI[arma] ?? SPARI.pistola;
      const c = canale(distanza, pan);
      const t = ctx.currentTime;
      if (silenziato) {
        scoppio(c, t, { durata: 0.12, volume: 0.35, frequenza: 1800, tipo: 'bandpass', q: 1.5 });
        return;
      }
      scoppio(c, t, { durata: 0.09, volume: s.colpo, frequenza: s.tono * 4 });
      scoppio(c, t, { durata: s.coda + Math.min(1.2, distanza / 60), volume: s.colpo * 0.4, frequenza: s.tono });
      tonfo(c, t, 140, 0.18, s.colpo * 0.8);
    },
    vetro(distanza = 0, pan = 0) {
      if (!pronto()) return;
      const c = canale(distanza, pan);
      const t = ctx.currentTime;
      for (let i = 0; i < 6; i++) scoppio(c, t + i * 0.035 + Math.random() * 0.02, { durata: 0.25, volume: 0.35, frequenza: 4000 + Math.random() * 3000, tipo: 'highpass' });
    },
    clic() {
      if (pronto()) scoppio(canale(0), ctx.currentTime, { durata: 0.03, volume: 0.25, frequenza: 3000, tipo: 'bandpass', q: 3 });
    },
    ricarica() {
      if (!pronto()) return;
      const c = canale(0);
      const t = ctx.currentTime;
      scoppio(c, t, { durata: 0.05, volume: 0.3, frequenza: 2500, tipo: 'bandpass', q: 4 });
      scoppio(c, t + 0.5, { durata: 0.06, volume: 0.35, frequenza: 1800, tipo: 'bandpass', q: 4 });
    },
    sacco() {
      if (pronto()) scoppio(canale(0), ctx.currentTime, { durata: 0.25, volume: 0.25, frequenza: 600 });
    },
    urlo(distanza = 0, pan = 0) {
      if (!pronto()) return;
      const c = canale(distanza, pan);
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(520, t);
      o.frequency.linearRampToValueAtTime(760, t + 0.25);
      o.frequency.linearRampToValueAtTime(600, t + 0.7);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      o.connect(f).connect(g).connect(c);
      o.start(t);
      o.stop(t + 0.85);
    },
    allarme(acceso) {
      if (!pronto()) return;
      if (acceso && !allarme) {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = 880;
        const trem = ctx.createOscillator();
        trem.frequency.value = 9;
        const tg = ctx.createGain();
        tg.gain.value = 0.02;
        const g = ctx.createGain();
        g.gain.value = 0.03;
        trem.connect(tg).connect(g.gain);
        o.connect(g).connect(uscita);
        o.start();
        trem.start();
        allarme = { o, trem, g };
      } else if (!acceso && allarme) {
        allarme.o.stop();
        allarme.trem.stop();
        allarme = null;
      }
    },
    distanzaAllarme(d) {
      if (allarme) allarme.g.gain.setTargetAtTime(0.035 * Math.min(1, 10 / Math.max(10, d)), ctx.currentTime, 0.2);
    },
    sirene(distanze) {
      if (!pronto()) return;
      const volume = Math.min(0.12, distanze.reduce((s, d) => s + 0.12 * Math.min(1, 25 / Math.max(25, d)), 0));
      if (!sirene && volume > 0.002) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        const lfo = ctx.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = 0.9;
        const lg = ctx.createGain();
        lg.gain.value = 180;
        o.frequency.value = 760;
        lfo.connect(lg).connect(o.frequency);
        const g = ctx.createGain();
        g.gain.value = 0;
        o.connect(g).connect(uscita);
        o.start();
        lfo.start();
        sirene = { g };
      }
      if (sirene) sirene.g.gain.setTargetAtTime(volume, ctx.currentTime, 0.3);
    },
    motore(id, velocita, gas, distanza = 0) {
      if (!pronto()) return;
      let m = motori.get(id);
      if (!m) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        const o2 = ctx.createOscillator();
        o2.type = 'square';
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 400;
        const g = ctx.createGain();
        g.gain.value = 0;
        o.connect(f);
        o2.connect(f);
        f.connect(g).connect(uscita);
        o.start();
        o2.start();
        m = { o, o2, f, g };
        motori.set(id, m);
      }
      const marcia = Math.abs(velocita) % 9;
      const giri = 34 + marcia * 7 + Math.abs(gas) * 14;
      m.o.frequency.setTargetAtTime(giri, ctx.currentTime, 0.08);
      m.o2.frequency.setTargetAtTime(giri * 0.5, ctx.currentTime, 0.08);
      m.f.frequency.setTargetAtTime(280 + Math.abs(gas) * 800 + Math.abs(velocita) * 18, ctx.currentTime, 0.1);
      m.g.gain.setTargetAtTime((0.045 + Math.abs(gas) * 0.04) * Math.min(1, 12 / Math.max(12, distanza)), ctx.currentTime, 0.1);
    },
    spegniMotori(tranne = new Set()) {
      for (const [id, m] of motori) {
        if (tranne.has(id)) continue;
        m.o.stop();
        m.o2.stop();
        motori.delete(id);
      }
    },
    trapano(acceso, distanza = 0) {
      if (!pronto()) return;
      if (acceso && !trapano) {
        const s = ctx.createBufferSource();
        s.buffer = rumore;
        s.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 2400;
        f.Q.value = 6;
        const g = ctx.createGain();
        g.gain.value = 0.06;
        s.connect(f).connect(g).connect(uscita);
        s.start();
        trapano = { s, g };
      } else if (!acceso && trapano) {
        trapano.s.stop();
        trapano = null;
      }
      if (trapano) trapano.g.gain.value = 0.08 * Math.min(1, 8 / Math.max(8, distanza));
    },
  };
}
