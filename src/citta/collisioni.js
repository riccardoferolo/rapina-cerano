import { puntoSegmento, intersezioneRaggio } from './geometria.js';

const LATO = 12;
const ITERAZIONI = 3;

export function creaCollisioni(lato = LATO) {
  const celle = new Map();
  const segmenti = [];
  const cerchi = [];
  let marca = 0;
  const chiave = (i, j) => i * 100003 + j;

  function inserisci(voce, x0, z0, x1, z1) {
    for (let i = Math.floor(x0 / lato); i <= Math.floor(x1 / lato); i++) {
      for (let j = Math.floor(z0 / lato); j <= Math.floor(z1 / lato); j++) {
        const k = chiave(i, j);
        let cella = celle.get(k);
        if (!cella) {
          cella = [];
          celle.set(k, cella);
        }
        cella.push(voce);
      }
    }
  }

  function vicini(x0, z0, x1, z1, fuori) {
    marca += 1;
    fuori.length = 0;
    for (let i = Math.floor(x0 / lato); i <= Math.floor(x1 / lato); i++) {
      for (let j = Math.floor(z0 / lato); j <= Math.floor(z1 / lato); j++) {
        const cella = celle.get(chiave(i, j));
        if (!cella) continue;
        for (const v of cella) {
          if (v.marca === marca || !v.attivo) continue;
          v.marca = marca;
          fuori.push(v);
        }
      }
    }
    return fuori;
  }

  const appoggio = [];

  function respingi(x, z, r, filtro) {
    let px = x;
    let pz = z;
    let nx = 0;
    let nz = 0;
    let urtato = false;
    for (let it = 0; it < ITERAZIONI; it++) {
      let mosso = false;
      for (const v of vicini(px - r, pz - r, px + r, pz + r, appoggio)) {
        if (filtro && !filtro(v)) continue;
        if (v.tipo === 's') {
          const q = puntoSegmento(px, pz, v.ax, v.az, v.bx, v.bz);
          if (q.d >= r) continue;
          let ux;
          let uz;
          if (q.d > 1e-6) {
            ux = (px - q.x) / q.d;
            uz = (pz - q.z) / q.d;
          } else {
            const l = Math.hypot(v.bx - v.ax, v.bz - v.az) || 1;
            ux = -(v.bz - v.az) / l;
            uz = (v.bx - v.ax) / l;
          }
          px = q.x + ux * r;
          pz = q.z + uz * r;
          nx += ux;
          nz += uz;
          mosso = urtato = true;
        } else {
          const dx = px - v.x;
          const dz = pz - v.z;
          const d = Math.hypot(dx, dz);
          const somma = r + v.r;
          if (d >= somma) continue;
          const ux = d > 1e-6 ? dx / d : 1;
          const uz = d > 1e-6 ? dz / d : 0;
          px = v.x + ux * somma;
          pz = v.z + uz * somma;
          nx += ux;
          nz += uz;
          mosso = urtato = true;
        }
      }
      if (!mosso) break;
    }
    const ln = Math.hypot(nx, nz);
    return { x: px, z: pz, urto: urtato, nx: ln > 0 ? nx / ln : 0, nz: ln > 0 ? nz / ln : 0 };
  }

  return {
    segmenti,
    cerchi,
    aggiungiSegmento(ax, az, bx, bz, etichetta = null, extra = {}) {
      const v = { tipo: 's', ax, az, bx, bz, etichetta, attivo: true, marca: 0, ...extra };
      segmenti.push(v);
      inserisci(v, Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz));
      return v;
    },
    aggiungiAnello(anello, etichetta = null, extra = {}) {
      return anello.map((a, i) => {
        const b = anello[(i + 1) % anello.length];
        return this.aggiungiSegmento(a[0], a[1], b[0], b[1], etichetta, extra);
      });
    },
    aggiungiCerchio(x, z, r, etichetta = null, extra = {}) {
      const v = { tipo: 'c', x, z, r, etichetta, attivo: true, marca: 0, ...extra };
      cerchi.push(v);
      inserisci(v, x - r, z - r, x + r, z + r);
      return v;
    },
    vicini(x, z, r) {
      return [...vicini(x - r, z - r, x + r, z + r, [])];
    },
    respingi,
    muoviCerchio(x, z, dx, dz, r, filtro = null) {
      const lungo = Math.hypot(dx, dz);
      const passi = Math.max(1, Math.ceil(lungo / (r * 0.5)));
      let px = x;
      let pz = z;
      let urto = false;
      let nx = 0;
      let nz = 0;
      for (let i = 0; i < passi; i++) {
        const esito = respingi(px + dx / passi, pz + dz / passi, r, filtro);
        px = esito.x;
        pz = esito.z;
        if (esito.urto) {
          urto = true;
          nx = esito.nx;
          nz = esito.nz;
        }
      }
      return { x: px, z: pz, urto, nx, nz };
    },
    raggio(ox, oz, dx, dz, massimo, filtro = null) {
      const l = Math.hypot(dx, dz) || 1;
      const ux = dx / l;
      const uz = dz / l;
      let migliore = massimo;
      let colpito = null;
      const passo = lato * 0.5;
      marca += 1;
      for (let s = 0; s <= massimo + passo; s += passo) {
        const cx = ox + ux * s;
        const cz = oz + uz * s;
        const i = Math.floor(cx / lato);
        const j = Math.floor(cz / lato);
        for (let a = i - 1; a <= i + 1; a++) {
          for (let b = j - 1; b <= j + 1; b++) {
            const cella = celle.get(chiave(a, b));
            if (!cella) continue;
            for (const v of cella) {
              if (v.marca === marca || !v.attivo) continue;
              v.marca = marca;
              if (filtro && !filtro(v)) continue;
              let t;
              if (v.tipo === 's') t = intersezioneRaggio(ox, oz, ux, uz, v.ax, v.az, v.bx, v.bz);
              else {
                const fx = ox - v.x;
                const fz = oz - v.z;
                const bb = fx * ux + fz * uz;
                const cc = fx * fx + fz * fz - v.r * v.r;
                const disc = bb * bb - cc;
                t = disc < 0 ? Infinity : -bb - Math.sqrt(disc);
                if (t < 0) t = Infinity;
              }
              if (t < migliore) {
                migliore = t;
                colpito = v;
              }
            }
          }
        }
        if (s > migliore) break;
      }
      return { distanza: migliore, colpito };
    },
    libero(ax, az, bx, bz, filtro = null) {
      const d = Math.hypot(bx - ax, bz - az);
      if (d < 1e-6) return true;
      return this.raggio(ax, az, bx - ax, bz - az, d, filtro).distanza >= d - 1e-3;
    },
  };
}
