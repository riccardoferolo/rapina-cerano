import bpy
import glob
import os
import sys

cartella = sys.argv[sys.argv.index('--') + 1]
for zip_path in sorted(glob.glob(os.path.join(cartella, '*.zip'))):
    esito = bpy.ops.mpfb.load_pack(filepath=zip_path)
    print('PACCO', os.path.basename(zip_path), esito)
