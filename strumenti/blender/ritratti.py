"""Foto segnaletiche dei quattro della banda per la schermata iniziale (sfondo trasparente).

Uso: blender -b -P ritratti.py -- <cartella di uscita>
"""
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from personaggi import CAST, DATI, file_asset, svuota  # noqa: E402
from bl_ext.user_default.mpfb.services.humanservice import HumanService  # noqa: E402
from bl_ext.user_default.mpfb.services.targetservice import TargetService  # noqa: E402

USCITA = sys.argv[sys.argv.index('--') + 1]
RUOLI = {'scassinatore': 'banda', 'hacker': 'banda2', 'autista': 'banda3', 'azione': 'banda4'}


def vesti(scheda):
    macro = TargetService.get_default_macro_info_dict()
    macro.update(scheda['macro'])
    corpo = HumanService.create_human(macro_detail_dict=macro)
    HumanService.set_character_skin(file_asset('skins', scheda['pelle'], 'mhmat'), corpo, skin_type='GAMEENGINE')
    rig = HumanService.add_builtin_rig(corpo, 'mixamo')
    HumanService.add_mhclo_asset(os.path.join(DATI, 'eyes', 'low-poly', 'low-poly.mhclo'), corpo, asset_type='Eyes', subdiv_levels=0, material_type='GAMEENGINE')
    HumanService.add_mhclo_asset(file_asset('eyebrows', scheda['sopracciglia'], 'mhclo'), corpo, asset_type='Eyebrows', subdiv_levels=0, material_type='GAMEENGINE')
    if not scheda.get('maschera'):
        HumanService.add_mhclo_asset(file_asset('hair', scheda['capelli'], 'mhclo'), corpo, asset_type='Hair', subdiv_levels=0, material_type='GAMEENGINE')
    for vestito in scheda['vestiti'] + list(scheda['maschera']):
        HumanService.add_mhclo_asset(file_asset('clothes', vestito, 'mhclo'), corpo, asset_type='Clothes', subdiv_levels=0, material_type='GAMEENGINE')
    for o in rig.children_recursive:
        for slot in getattr(o, 'material_slots', []):
            m = slot.material
            if m and ('mask' in m.name.lower() or 'hood' in m.name.lower()):
                for n in m.node_tree.nodes:
                    if n.type == 'BSDF_PRINCIPLED':
                        for l in list(n.inputs['Base Color'].links):
                            m.node_tree.links.remove(l)
                        n.inputs['Base Color'].default_value = (0.012, 0.012, 0.014, 1)
    return rig


def scatta(rig, percorso):
    testa = rig.matrix_world @ rig.data.bones['mixamorig:Head'].head_local
    occhi = testa + Vector((0, 0, 0.09))
    bpy.ops.object.camera_add(location=occhi + Vector((0, -1.25, 0.02)))
    cam = bpy.context.object
    cam.rotation_euler = (Vector((0, 1, -0.01))).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = 70
    bpy.context.scene.camera = cam
    bpy.ops.object.light_add(type='AREA', location=occhi + Vector((0, -1.0, 0.1)))
    flash = bpy.context.object
    flash.data.energy = 90
    flash.data.size = 0.5
    flash.rotation_euler = (1.5708, 0, 0)
    bpy.ops.object.light_add(type='AREA', location=occhi + Vector((0.6, 0.7, 0.6)))
    contro = bpy.context.object
    contro.data.energy = 60
    contro.data.color = (1.0, 0.85, 0.6)
    contro.rotation_euler = (Vector((-0.6, -0.7, -0.6))).to_track_quat('-Z', 'Y').to_euler()
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 48
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = 360
    sc.render.resolution_y = 480
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'AgX'
    sc.render.filepath = percorso
    bpy.ops.render.render(write_still=True)


PROVA = os.environ.get('PROVA_MASCHERE')
os.makedirs(USCITA, exist_ok=True)
if PROVA:
    for maschera in PROVA.split(','):
        svuota()
        rig = vesti({**CAST['banda'], 'maschera': maschera.split('+')})
        scatta(rig, os.path.join(USCITA, f'prova-{maschera}.png'))
        print('PROVA', maschera)
else:
    for ruolo, nome in RUOLI.items():
        svuota()
        rig = vesti(CAST[nome])
        scatta(rig, os.path.join(USCITA, f'ritratto-{ruolo}.png'))
        print('RITRATTO', ruolo)
