"""Genera i personaggi del gioco con MPFB (MakeHuman per Blender, asset CC0) e li anima con Moveset.

Uso: blender -b -P personaggi.py -- <cartella di uscita> [nome ...]
Ogni personaggio diventa un .glb con scheletro Mixamo e le animazioni idle, cammina, corre, chino,
chinoCammina, guardia, pugno. Le texture sono ridotte e salvate in JPEG per il web.
"""
import os
import sys

import bpy

from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.exportservice import ExportService
from bl_ext.user_default.mpfb.services.locationservice import LocationService
from bl_ext.user_default.mpfb.services.targetservice import TargetService

ARGOMENTI = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
USCITA = ARGOMENTI[0] if ARGOMENTI else None
SOLO = set(ARGOMENTI[1:])
DATI = LocationService.get_user_data()
ANIMAZIONI = ['act|run', 'act|crouch', 'act|crouch_walk', 'act|guard', 'act|punch']
LATO_PELLE = 768
LATO_ALTRO = 512
LATO_OCCHI = 128


def razza(africana=0.0, asiatica=0.0):
    return {'african': africana, 'asian': asiatica, 'caucasian': max(0.0, 1.0 - africana - asiatica)}


CAST = {
    'banda': dict(macro=dict(gender=0.95, age=0.45, muscle=0.62, weight=0.52, height=0.6, race=razza()), pelle='middleage_caucasian_male', capelli='short02', sopracciglia='eyebrow006', vestiti=['male_casualsuit05', 'shoes03'], maschera=['culturalibre_hero-heroine_hood_1', 'culturalibre_hero-heroine_hood_2']),
    'banda2': dict(macro=dict(gender=0.05, age=0.42, muscle=0.6, weight=0.45, height=0.55, race=razza()), pelle='young_caucasian_female', capelli='ponytail01', sopracciglia='eyebrow010', vestiti=['toigo_basic_tucked_t-shirt', 'cortu_cargo_pants', 'shoes03'], maschera=['culturalibre_hero-heroine_hood_1', 'culturalibre_hero-heroine_hood_2']),
    'banda3': dict(macro=dict(gender=0.9, age=0.38, muscle=0.7, weight=0.5, height=0.55, race=razza(africana=0.8)), pelle='young_african_male', capelli='short03', sopracciglia='eyebrow007', vestiti=['elvs_crude_t-shirt_male', 'cortu_cargo_pants', 'shoes04'], maschera=['culturalibre_hero-heroine_hood_1', 'culturalibre_hero-heroine_hood_2']),
    'banda4': dict(macro=dict(gender=1.0, age=0.5, muscle=0.92, weight=0.68, height=0.72, race=razza()), pelle='middleage_caucasian_male', capelli='short03', sopracciglia='eyebrow008', vestiti=['namuhekam_male_polo_shirt', 'toigo_wool_pants', 'shoes03'], maschera=['culturalibre_hero-heroine_hood_1', 'culturalibre_hero-heroine_hood_2']),
    'civile': dict(macro=dict(gender=0.92, age=0.55, muscle=0.5, weight=0.62, height=0.5, race=razza()), pelle='middleage_caucasian_male', capelli='short01', sopracciglia='eyebrow001', vestiti=['male_casualsuit01', 'shoes01']),
    'civile3': dict(macro=dict(gender=0.9, age=0.4, muscle=0.5, weight=0.5, height=0.52, race=razza()), pelle='young_caucasian_male2', capelli='short04', sopracciglia='eyebrow005', vestiti=['male_casualsuit03', 'shoes05']),
    'anziano': dict(macro=dict(gender=0.95, age=0.92, muscle=0.35, weight=0.6, height=0.42, race=razza()), pelle='old_caucasian_male', capelli='short04', sopracciglia='eyebrow003', vestiti=['male_casualsuit05', 'shoes01', 'fedora01']),
    'civile2': dict(macro=dict(gender=0.05, age=0.6, muscle=0.4, weight=0.58, height=0.45, race=razza()), pelle='middleage_caucasian_female', capelli='bob02', sopracciglia='eyebrow011', vestiti=['female_elegantsuit01', 'shoes04']),
    'ragazza': dict(macro=dict(gender=0.0, age=0.3, muscle=0.45, weight=0.42, height=0.5, race=razza()), pelle='young_caucasian_female2', capelli='long01', sopracciglia='eyebrow012', vestiti=['toigo_fisherman_sweater', 'toigo_wool_pants', 'shoes05']),
    'cassiera': dict(macro=dict(gender=0.05, age=0.48, muscle=0.42, weight=0.55, height=0.48, race=razza()), pelle='young_caucasian_female', capelli='bob01', sopracciglia='eyebrow009', vestiti=['joepal_crude_t-shirt_female', 'toigo_wool_pants', 'shoes04']),
    'guardia': dict(macro=dict(gender=1.0, age=0.5, muscle=0.75, weight=0.6, height=0.65, race=razza()), pelle='middleage_caucasian_male', capelli='short03', sopracciglia='eyebrow002', vestiti=['namuhekam_male_polo_shirt', 'cortu_cargo_pants', 'shoes03']),
    'direttore': dict(macro=dict(gender=0.95, age=0.68, muscle=0.45, weight=0.66, height=0.55, race=razza()), pelle='middleage_caucasian_male', capelli='short02', sopracciglia='eyebrow004', vestiti=['male_elegantsuit01', 'shoes04']),
}


def file_asset(cartella, nome, estensione):
    return os.path.join(DATI, cartella, nome, f'{nome}.{estensione}')


def svuota():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for raccolta in (bpy.data.actions, bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.images):
        for x in list(raccolta):
            raccolta.remove(x)


def riduci_texture():
    for img in bpy.data.images:
        if not img.size[0]:
            continue
        n = img.name.lower()
        lato = LATO_PELLE if 'skin' in n else LATO_OCCHI if 'eye' in n and 'brow' not in n and 'lash' not in n else LATO_ALTRO
        if max(img.size) > lato:
            k = lato / max(img.size)
            img.scale(max(1, int(img.size[0] * k)), max(1, int(img.size[1] * k)))


def togli_avanzamento(rig):
    for azione in bpy.data.actions:
        for curva in list(azione.fcurves):
            if curva.data_path == 'pose.bones["mixamorig:Hips"].location' and curva.array_index in (0, 2):
                inizio = curva.keyframe_points[0].co[1] if curva.keyframe_points else 0.0
                for k in curva.keyframe_points:
                    k.co[1] = inizio
                    k.handle_left[1] = inizio
                    k.handle_right[1] = inizio


def genera(nome, scheda):
    svuota()
    macro = TargetService.get_default_macro_info_dict()
    macro.update(scheda['macro'])
    corpo = HumanService.create_human(macro_detail_dict=macro)
    corpo.name = f'{nome}_corpo'
    HumanService.set_character_skin(file_asset('skins', scheda['pelle'], 'mhmat'), corpo, skin_type='GAMEENGINE')
    rig = HumanService.add_builtin_rig(corpo, 'mixamo')
    HumanService.add_mhclo_asset(os.path.join(DATI, 'eyes', 'low-poly', 'low-poly.mhclo'), corpo, asset_type='Eyes', subdiv_levels=0, material_type='GAMEENGINE')
    HumanService.add_mhclo_asset(file_asset('eyebrows', scheda['sopracciglia'], 'mhclo'), corpo, asset_type='Eyebrows', subdiv_levels=0, material_type='GAMEENGINE')
    HumanService.add_mhclo_asset(file_asset('eyelashes', 'eyelashes01', 'mhclo'), corpo, asset_type='Eyelashes', subdiv_levels=0, material_type='GAMEENGINE')
    HumanService.add_mhclo_asset(file_asset('hair', scheda['capelli'], 'mhclo'), corpo, asset_type='Hair', subdiv_levels=0, material_type='GAMEENGINE')
    for vestito in scheda['vestiti'] + list(scheda.get('maschera') or []):
        HumanService.add_mhclo_asset(file_asset('clothes', vestito, 'mhclo'), corpo, asset_type='Clothes', subdiv_levels=0, material_type='GAMEENGINE')
    ExportService.bake_modifiers_remove_helpers(corpo, bake_masks=True, bake_subdiv=False, remove_helpers=True)
    if TargetService.has_any_shapekey(corpo):
        TargetService.bake_targets(corpo)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.gait.create()
    for voce in ANIMAZIONI:
        bpy.ops.gait.anim_add(item=voce)
    bpy.ops.gait.bake()
    togli_avanzamento(rig)
    riduci_texture()
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    for figlio in rig.children_recursive:
        figlio.select_set(True)
    percorso = os.path.join(USCITA, f'{nome}.glb')
    bpy.ops.export_scene.gltf(
        filepath=percorso, export_format='GLB', use_selection=True, export_apply=True, export_animations=True,
        export_animation_mode='ACTIONS', export_image_format='JPEG', export_jpeg_quality=82, export_yup=True,
        export_skins=True, export_morph=False, export_extras=False, export_cameras=False, export_lights=False,
    )
    print('PERSONAGGIO', nome, round(os.path.getsize(percorso) / 1e6, 2), 'MB', [a.name for a in bpy.data.actions])


if __name__ == '__main__' and USCITA:
    os.makedirs(USCITA, exist_ok=True)
    for nome, scheda in CAST.items():
        if SOLO and nome not in SOLO:
            continue
        genera(nome, scheda)
