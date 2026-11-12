import { readFileSync } from 'node:fs';
for (const file of process.argv.slice(2)) {
  const b = readFileSync(file);
  const lJson = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + lJson).toString());
  const tri = j.meshes.map(m => m.primitives.reduce((t, p) => t + (p.indices !== undefined ? j.accessors[p.indices].count / 3 : j.accessors[p.attributes.POSITION].count / 3), 0));
  const imgs = (j.images ?? []).map(im => ({ n: im.name, kb: Math.round(j.bufferViews[im.bufferView].byteLength / 1024) }));
  console.log(file.split(/[\/]/).pop(), `${(b.length / 1e6).toFixed(2)} MB`, `mesh ${j.meshes.length}`, `tri ${tri.map(Math.round).join('+')}`, `materiali ${j.materials?.length}`, `nodi ${j.nodes.length}`, `animazioni ${j.animations?.map(a => a.name).join(',')}`);
  console.log('  materiali:', j.materials.map(m => `${m.name}${m.alphaMode ? '(' + m.alphaMode + ')' : ''}`).join(', '));
  console.log('  immagini:', imgs.map(i => `${i.n}:${i.kb}KB`).join(', '));
}
