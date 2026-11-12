"""Riduce le texture dentro i .glb dei personaggi: JPEG dove non serve trasparenza, PNG piccolo dove serve.

Uso: python strumenti/comprimi-glb.py public/modelli/persone/*.glb
"""
import io
import json
import struct
import sys

from PIL import Image

LATI = (('skin', 512), ('eye', 96), ('brow', 128), ('lash', 128), ('', 256))
ALFA = ('brow', 'lash', 'short', 'long', 'bob', 'ponytail', 'afro', 'braid', 'hair')
QUALITA_JPEG = 78


def lato_per(nome):
    n = nome.lower()
    return next(lato for chiave, lato in LATI if chiave in n)


def comprimi(percorso):
    dati = open(percorso, 'rb').read()
    lung_json = struct.unpack_from('<I', dati, 12)[0]
    gltf = json.loads(dati[20:20 + lung_json])
    inizio_bin = 20 + lung_json + 8
    binario = dati[inizio_bin:]
    pezzi = []
    for i, vista in enumerate(gltf['bufferViews']):
        pezzi.append(binario[vista.get('byteOffset', 0):vista.get('byteOffset', 0) + vista['byteLength']])
    for img in gltf.get('images', []):
        vista = img['bufferView']
        immagine = Image.open(io.BytesIO(pezzi[vista]))
        nome = img.get('name', '')
        lato = lato_per(nome)
        alfa = any(k in nome.lower() for k in ALFA) and immagine.mode in ('RGBA', 'LA', 'P')
        if max(immagine.size) > lato:
            k = lato / max(immagine.size)
            immagine = immagine.resize((max(1, round(immagine.width * k)), max(1, round(immagine.height * k))), Image.LANCZOS)
        uscita = io.BytesIO()
        if alfa:
            immagine.convert('RGBA').save(uscita, 'PNG', optimize=True)
            img['mimeType'] = 'image/png'
        else:
            immagine.convert('RGB').save(uscita, 'JPEG', quality=QUALITA_JPEG, optimize=True)
            img['mimeType'] = 'image/jpeg'
        pezzi[vista] = uscita.getvalue()
    nuovo = bytearray()
    for i, vista in enumerate(gltf['bufferViews']):
        while len(nuovo) % 4:
            nuovo.append(0)
        vista['byteOffset'] = len(nuovo)
        vista['byteLength'] = len(pezzi[i])
        nuovo += pezzi[i]
    while len(nuovo) % 4:
        nuovo.append(0)
    gltf['buffers'][0]['byteLength'] = len(nuovo)
    testo = json.dumps(gltf, separators=(',', ':')).encode()
    testo += b' ' * ((4 - len(testo) % 4) % 4)
    totale = 12 + 8 + len(testo) + 8 + len(nuovo)
    with open(percorso, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, totale))
        f.write(struct.pack('<II', len(testo), 0x4E4F534A) + testo)
        f.write(struct.pack('<II', len(nuovo), 0x004E4942) + bytes(nuovo))
    print(f'{percorso}: {len(dati) / 1e6:.2f} -> {totale / 1e6:.2f} MB')


for p in sys.argv[1:]:
    comprimi(p)
