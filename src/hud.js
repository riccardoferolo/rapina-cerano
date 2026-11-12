import { RUOLI, SACCHI, ARMI } from './gioco/regole.js';

const $ = id => document.getElementById(id);
const DURATA_MESSAGGIO = 5000;
const MESSAGGI_MASSIMI = 5;

function formatta(euro) {
  return `${Math.round(euro).toLocaleString('it-IT')} €`;
}

export function creaHud() {
  const radice = $('hud');
  const messaggi = [];
  let ultimoDanno = 0;
  const minimappa = $('minimappa').getContext('2d');
  let sfondoMinimappa = null;

  function scriviMessaggi() {
    const ora = performance.now();
    while (messaggi.length && ora - messaggi[0].quando > DURATA_MESSAGGIO) messaggi.shift();
    $('messaggi').innerHTML = messaggi.map(m => `<div class="msg ${m.tipo}">${m.testo.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</div>`).join('');
  }

  return {
    mostra(si) { radice.hidden = !si; },
    messaggio(testo, tipo = 'info') {
      messaggi.push({ testo, tipo, quando: performance.now() });
      if (messaggi.length > MESSAGGI_MASSIMI) messaggi.shift();
      scriviMessaggi();
    },
    danno() { ultimoDanno = performance.now(); },
    preparaMinimappa(citta) {
      const c = document.createElement('canvas');
      c.width = c.height = 1024;
      const ctx = c.getContext('2d');
      const L = citta.dati.limite;
      const s = 1024 / (2 * L);
      ctx.fillStyle = '#1b2318';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.fillStyle = '#5a4a40';
      for (const e of citta.dati.edifici) {
        ctx.beginPath();
        e.p.forEach(([x, z], i) => (i ? ctx.lineTo((x + L) * s, (z + L) * s) : ctx.moveTo((x + L) * s, (z + L) * s)));
        ctx.fill();
      }
      ctx.lineCap = 'round';
      for (const st of citta.dati.strade) {
        if (!st.a && !st.pe) continue;
        ctx.strokeStyle = st.r >= 3 ? '#d8d0b8' : st.s ? '#6a6050' : '#9a968a';
        ctx.lineWidth = Math.max(1, st.l * s * 1.4);
        ctx.beginPath();
        st.p.forEach(([x, z], i) => (i ? ctx.lineTo((x + L) * s, (z + L) * s) : ctx.moveTo((x + L) * s, (z + L) * s)));
        ctx.stroke();
      }
      sfondoMinimappa = { c, L, s };
    },
    aggiorna({ vista, me, interazione, arma, rete, fps, soldi, obiettivo, auto, mira, ruolo, rifugio, meta, polizia, segni = [] }) {
      if (!me) return;
      scriviMessaggi();
      const vitaPerc = Math.max(0, me.vita / me.vitaMax);
      $('vita-barra').style.width = `${vitaPerc * 100}%`;
      $('vita-barra').dataset.basso = vitaPerc < 0.3 ? '1' : '0';
      $('giubbotto-barra').style.width = `${Math.min(100, (me.giubbotto / 60) * 100)}%`;
      $('giubbotto').hidden = me.giubbotto <= 0;
      $('ruolo').textContent = `${RUOLI[me.ruolo]?.nome ?? ''} · fascette ${me.fascette}`;
      const sacchi = (me.sacchi ?? []).map(id => vista.sacchi.find(s => s.id === id)).filter(Boolean);
      $('sacco').textContent = sacchi.length ? `Sacco: ${sacchi.map(s => SACCHI[s.tipo]?.nome).join(' + ')} — G per lanciarlo` : '';
      $('maschera').textContent = me.maschera ? 'Passamontagna' : 'In borghese (Q per il passamontagna)';
      $('maschera').dataset.attivo = me.maschera ? '1' : '0';
      if (arma && !auto?.guidi) {
        $('arma').hidden = false;
        $('arma-nome').textContent = ARMI[arma.tipo]?.nome ?? '';
        $('arma-colpi').textContent = `${arma.caricatore} / ${arma.riserva}`;
      } else $('arma').hidden = true;
      $('mirino').hidden = !!auto?.guidi || !me.maschera;
      $('mirino').dataset.mira = mira ? '1' : '0';
      if (interazione) {
        $('azione').hidden = false;
        $('azione-testo').textContent = `${interazione.tasto ?? 'F'} — ${interazione.testo}`;
        $('azione').dataset.bloccata = Number.isFinite(interazione.tempo) ? '0' : '1';
        const p = me.usoChiave === interazione.chiave && me.uso >= 0 ? me.uso : 0;
        $('azione-barra').style.width = `${p * 100}%`;
        $('azione-barra').parentElement.hidden = !(interazione.tempo > 0) || !Number.isFinite(interazione.tempo);
      } else $('azione').hidden = true;
      const al = vista.allarme;
      if (!al?.attivo && vista.scadenza !== null && vista.scadenza !== undefined && vista.fase === 'colpo') {
        $('allarme').hidden = false;
        $('allarme').textContent = `Il blindato riparte fra ${Math.ceil(vista.scadenza)} s`;
      } else if (al?.attivo) {
        $('allarme').hidden = false;
        const tra = al.polizia !== null ? Math.max(0, Math.ceil(al.polizia - vista.tempo)) : null;
        $('allarme').textContent = vista.fuga?.polizia ? `INSEGUIMENTO — seminateli (${Math.floor(vista.fuga.lontano)}/18 s lontani)` : al.ondata ? `ALLARME — ondata ${al.ondata}${tra !== null ? `, rinforzi fra ${tra} s` : ''}` : `ALLARME — polizia fra ${tra ?? '?'} s`;
      } else $('allarme').hidden = true;
      $('obiettivo').textContent = obiettivo ?? '';
      $('soldi').textContent = soldi !== null && soldi !== undefined ? formatta(soldi) : '';
      $('rete').textContent = [rete, `${Math.round(fps)} fps`].filter(Boolean).join(' · ');
      const vecchio = performance.now() - ultimoDanno;
      $('danno').style.opacity = String(Math.max(0, 0.55 - vecchio / 900));
      $('aterra').hidden = me.stato !== 'terra';
      if (me.stato === 'terra') $('aterra').textContent = `Sei a terra! Un compagno può rialzarti (${me.timerTerra} s)`;
      $('auto-info').hidden = !auto;
      if (auto) $('auto-info').textContent = auto.guidi ? `${Math.round(auto.velocita * 3.6)} km/h · danni ${Math.round(100 - auto.vita)}% · sacchi ${auto.sacchi} · Spazio freno a mano · C visuale · F scendi` : 'Passeggero · spara dal finestrino · F scendi';
      this.disegnaMinimappa(vista, me, rifugio, meta, polizia, segni);
    },
    disegnaMinimappa(vista, me, rifugio, meta, polizia, segni = []) {
      if (!sfondoMinimappa) return;
      const { c, L, s } = sfondoMinimappa;
      const ctx = minimappa;
      const lato = ctx.canvas.width;
      const zoom = 2.2;
      ctx.save();
      ctx.fillStyle = '#10140f';
      ctx.fillRect(0, 0, lato, lato);
      ctx.translate(lato / 2, lato / 2);
      ctx.rotate(me.yaw ?? 0);
      ctx.scale(zoom, zoom);
      ctx.translate(-(me.x + L) * s, -(me.z + L) * s);
      ctx.drawImage(c, 0, 0);
      const punto = (x, z, colore, r = 3) => {
        ctx.fillStyle = colore;
        ctx.beginPath();
        ctx.arc((x + L) * s, (z + L) * s, r / zoom, 0, Math.PI * 2);
        ctx.fill();
      };
      if (meta) punto(meta[0], meta[1], '#ffd34a', 5);
      if (rifugio) punto(rifugio[0], rifugio[1], '#4ade80', 5);
      for (const v of vista.veicoli) if (v.tipo === 'volante' && polizia) punto(v.x, v.z, '#3b82f6', 4);
      for (const g of vista.giocatori) if (g.id !== me.id) punto(g.x, g.z, '#e5e7eb', 3);
      for (const [x, z, colore] of segni) punto(x, z, colore, 3);
      ctx.restore();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(lato / 2, lato / 2 - 7);
      ctx.lineTo(lato / 2 - 5, lato / 2 + 5);
      ctx.lineTo(lato / 2 + 5, lato / 2 + 5);
      ctx.fill();
    },
  };
}
