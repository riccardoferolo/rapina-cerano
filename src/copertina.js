const BANCONOTE = 70;
const PARALLASSE = 14;

function disegnaBanconota() {
  const c = document.createElement('canvas');
  c.width = 260;
  c.height = 124;
  const x = c.getContext('2d');
  const sfondo = x.createLinearGradient(0, 0, 260, 124);
  sfondo.addColorStop(0, '#9fd6a6');
  sfondo.addColorStop(0.5, '#cfe9c4');
  sfondo.addColorStop(1, '#7fbf95');
  x.fillStyle = sfondo;
  x.fillRect(0, 0, 260, 124);
  x.strokeStyle = '#2f6b45';
  x.lineWidth = 4;
  x.strokeRect(6, 6, 248, 112);
  x.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    x.beginPath();
    x.ellipse(196, 62, 44 - i * 1.4, 38 - i * 1.2, 0, 0, Math.PI * 2);
    x.strokeStyle = `rgba(30, 90, 60, ${0.25 + (i % 3) * 0.1})`;
    x.stroke();
  }
  x.fillStyle = '#1f4f33';
  x.font = 'bold 44px Georgia, serif';
  x.fillText('50', 16, 52);
  x.font = 'bold 15px Georgia, serif';
  x.fillText('BANCA DI CERANO', 16, 82);
  x.font = '11px Georgia, serif';
  x.fillText('CINQUANTA SCUDI · MODELLO DI GIOCO', 16, 104);
  x.font = 'bold 30px Georgia, serif';
  x.fillText('C', 186, 74);
  return c;
}

/** Anima la schermata iniziale: banconote che volano, parallasse col mouse. Restituisce `ferma()`. */
export function avviaCopertina() {
  const tela = document.getElementById('t-soldi');
  const foto = document.querySelector('.t-fondo');
  if (!tela) return { ferma() {} };
  const ctx = tela.getContext('2d');
  const banconota = disegnaBanconota();
  let w = 0;
  let h = 0;
  const ridimensiona = () => {
    const k = Math.min(2, devicePixelRatio || 1);
    w = tela.clientWidth;
    h = tela.clientHeight;
    tela.width = Math.round(w * k);
    tela.height = Math.round(h * k);
    ctx.setTransform(k, 0, 0, k, 0, 0);
  };
  ridimensiona();
  addEventListener('resize', ridimensiona);
  const nuova = (sopra = false) => {
    const z = 0.35 + Math.random() * 0.9;
    return { x: Math.random() * w, y: sopra ? -60 - Math.random() * h * 0.5 : Math.random() * h, z, giro: Math.random() * 6.28, vGiro: (Math.random() - 0.5) * 2.4, fase: Math.random() * 6.28, vy: 26 + z * 60, vx: -8 + Math.random() * 30 };
  };
  const soldi = Array.from({ length: BANCONOTE }, () => nuova());
  let mx = 0;
  let my = 0;
  const muovi = e => {
    mx = e.clientX / innerWidth - 0.5;
    my = e.clientY / innerHeight - 0.5;
  };
  addEventListener('mousemove', muovi);
  let prima = performance.now();
  let attiva = true;
  const ciclo = ora => {
    if (!attiva) return;
    const dt = Math.min(0.05, (ora - prima) / 1000);
    prima = ora;
    ctx.clearRect(0, 0, w, h);
    soldi.sort((a, b) => a.z - b.z);
    for (const b of soldi) {
      b.fase += dt * (2 + b.z);
      b.giro += b.vGiro * dt;
      b.y += b.vy * dt;
      b.x += (b.vx + Math.sin(b.fase) * 40) * dt;
      if (b.y > h + 80 || b.x < -120 || b.x > w + 120) Object.assign(b, nuova(true));
      const scala = 0.28 * b.z;
      ctx.save();
      ctx.translate(b.x - mx * PARALLASSE * b.z * 3, b.y - my * PARALLASSE * b.z * 3);
      ctx.rotate(b.giro);
      ctx.scale(scala, scala * Math.cos(b.fase));
      ctx.globalAlpha = 0.55 + b.z * 0.4;
      ctx.filter = b.z < 0.55 ? 'blur(2px)' : 'none';
      ctx.drawImage(banconota, -130, -62);
      ctx.restore();
    }
    if (foto) foto.style.transform = `translate(${-mx * PARALLASSE}px, ${-my * PARALLASSE}px)`;
    requestAnimationFrame(ciclo);
  };
  requestAnimationFrame(ciclo);
  return {
    ferma() {
      attiva = false;
      removeEventListener('mousemove', muovi);
      removeEventListener('resize', ridimensiona);
    },
  };
}
