"""Copertina della schermata iniziale: Piazza Crespi di notte, la banda che esce dal supermercato coi sacchi.

Uso: blender -b -P copertina.py -- <cerano.json> <uscita.png> [larghezza altezza campioni]
Gli edifici sono le impronte e le altezze vere di cerano.json; le persone sono generate con MPFB e messe in
posa con Moveset, come quelle del gioco.
"""
import json
import math
import os
import random
import sys

import bpy
from mathutils import Vector

from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.locationservice import LocationService
from bl_ext.user_default.mpfb.services.targetservice import TargetService

ARG = sys.argv[sys.argv.index('--') + 1:]
DATI_CITTA, USCITA = ARG[0], ARG[1]
LARGO, ALTO = (int(ARG[2]), int(ARG[3])) if len(ARG) > 3 else (1920, 1080)
CAMPIONI = int(ARG[4]) if len(ARG) > 4 else 96
DATI = LocationService.get_user_data()
CENTRO = (-34.0, 30.0)
RAGGIO = 150
CAMERA = (-33.0, 16.4, 0.8)
MIRA = (-35.6, 30.0, 2.3)
caso = random.Random(7)


def svuota():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)


def materiale(nome, colore, ruvido=0.6, metallo=0.0, emissione=None, forza=0.0):
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*colore, 1)
    p.inputs['Roughness'].default_value = ruvido
    p.inputs['Metallic'].default_value = metallo
    if emissione:
        p.inputs['Emission Color'].default_value = (*emissione, 1)
        p.inputs['Emission Strength'].default_value = forza
    return m


def mondo3d(x, z, y=0.0):
    return Vector((x, -z, y))


def edifici(dati):
    muro = materiale('muro', (0.42, 0.36, 0.3), 0.85)
    nodi = muro.node_tree.nodes
    rumore = nodi.new('ShaderNodeTexNoise')
    rumore.inputs['Scale'].default_value = 3.0
    rumore.inputs['Detail'].default_value = 8.0
    rampa = nodi.new('ShaderNodeValToRGB')
    rampa.color_ramp.elements[0].color = (0.25, 0.2, 0.16, 1)
    rampa.color_ramp.elements[1].color = (0.55, 0.47, 0.38, 1)
    muro.node_tree.links.new(rumore.outputs['Fac'], rampa.inputs['Fac'])
    muro.node_tree.links.new(rampa.outputs['Color'], nodi['Principled BSDF'].inputs['Base Color'])
    rilievo = nodi.new('ShaderNodeBump')
    rilievo.inputs['Strength'].default_value = 0.35
    muro.node_tree.links.new(rumore.outputs['Fac'], rilievo.inputs['Height'])
    muro.node_tree.links.new(rilievo.outputs['Normal'], nodi['Principled BSDF'].inputs['Normal'])
    tetto = materiale('tetto', (0.22, 0.12, 0.09), 0.8)
    luce = materiale('finestra', (0.9, 0.6, 0.3), 0.3, emissione=(1.0, 0.62, 0.3), forza=6)
    buio = materiale('vetro_buio', (0.02, 0.025, 0.03), 0.08, 0.2)
    finestre_accese = []
    finestre_spente = []
    for e in dati['edifici']:
        if not any(math.hypot(x - CENTRO[0], z - CENTRO[1]) < RAGGIO for x, z in e['p']):
            continue
        h = e['h']
        verts = [mondo3d(x, z, 0) for x, z in e['p']] + [mondo3d(x, z, h) for x, z in e['p']]
        n = len(e['p'])
        facce = [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)] + [list(range(2 * n - 1, n - 1, -1))]
        me = bpy.data.meshes.new(f"e{e['id']}")
        me.from_pydata(verts, [], facce)
        me.materials.append(muro)
        me.materials.append(tetto)
        me.polygons[-1].material_index = 1
        ob = bpy.data.objects.new(f"e{e['id']}", me)
        bpy.context.collection.objects.link(ob)
        for i in range(n):
            ax, az = e['p'][i]
            bx, bz = e['p'][(i + 1) % n]
            lato = math.hypot(bx - ax, bz - az)
            if lato < 3:
                continue
            nx, nz = (bz - az) / lato, -(bx - ax) / lato
            ux, uz = (bx - ax) / lato, (bz - az) / lato
            quante = int(lato // 3.2)
            for k in range(quante):
                t = (k + 0.5) / quante
                for piano in range(1, max(1, int(h // 3))):
                    cx = ax + (bx - ax) * t + nx * 0.04
                    cz = az + (bz - az) * t + nz * 0.04
                    y = piano * 3 + 0.5
                    lista = finestre_accese if caso.random() < 0.28 else finestre_spente
                    base = len(lista) // 1
                    lista.append([mondo3d(cx - ux * 0.5, cz - uz * 0.5, y - 0.65), mondo3d(cx + ux * 0.5, cz + uz * 0.5, y - 0.65),
                                  mondo3d(cx + ux * 0.5, cz + uz * 0.5, y + 0.65), mondo3d(cx - ux * 0.5, cz - uz * 0.5, y + 0.65)])
    for nome, lista, m in (('accese', finestre_accese, luce), ('spente', finestre_spente, buio)):
        verts = [v for q in lista for v in q]
        facce = [[4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 3] for i in range(len(lista))]
        me = bpy.data.meshes.new(nome)
        me.from_pydata(verts, [], facce)
        me.materials.append(m)
        bpy.context.collection.objects.link(bpy.data.objects.new(nome, me))


def terreno():
    bpy.ops.mesh.primitive_plane_add(size=600, location=(0, 0, 0))
    asfalto = materiale('asfalto_bagnato', (0.035, 0.035, 0.04), 0.12, 0.0)
    bpy.context.object.data.materials.append(asfalto)


def supermercato():
    fx0, fz0, fx1, fz1 = -41.8, 36.2, -29.3, 35.3
    cx, cz = (fx0 + fx1) / 2, (fz0 + fz1) / 2 - 0.08
    yaw = math.atan2(-(fx1 - fx0), -(fz1 - fz0)) + math.pi / 2
    insegna = materiale('insegna', (0.1, 0.5, 0.2), 0.4, emissione=(0.15, 1.0, 0.35), forza=9)
    bpy.ops.mesh.primitive_cube_add(size=1, location=mondo3d(cx, cz - 0.15, 3.05))
    s = bpy.context.object
    s.scale = (9.5, 0.25, 0.75)
    s.rotation_euler = (0, 0, yaw)
    s.data.materials.append(insegna)
    vetrina = materiale('vetrina', (1.0, 0.95, 0.85), 0.2, emissione=(1.0, 0.93, 0.8), forza=4.5)
    bpy.ops.mesh.primitive_plane_add(size=1, location=mondo3d(cx, cz - 0.05, 1.4))
    v = bpy.context.object
    v.scale = (10.5, 2.4, 1)
    v.rotation_euler = (math.pi / 2, 0, yaw)
    v.data.materials.append(vetrina)


def fontana():
    pietra = materiale('pietra', (0.5, 0.48, 0.44), 0.85)
    acqua = materiale('acqua', (0.02, 0.05, 0.06), 0.02, 0.2)
    bpy.ops.mesh.primitive_cylinder_add(radius=1.8, depth=0.55, location=mondo3d(-35, 24, 0.27))
    bpy.context.object.data.materials.append(pietra)
    bpy.ops.mesh.primitive_cylinder_add(radius=1.55, depth=0.05, location=mondo3d(-35, 24, 0.45))
    bpy.context.object.data.materials.append(acqua)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=1.4, location=mondo3d(-35, 24, 0.7))
    bpy.context.object.data.materials.append(pietra)


def persona(scheda, x, z, yaw, azione, fotogramma, sacco_mano):
    macro = TargetService.get_default_macro_info_dict()
    macro.update(scheda['macro'])
    corpo = HumanService.create_human(macro_detail_dict=macro)
    HumanService.set_character_skin(os.path.join(DATI, 'skins', scheda['pelle'], scheda['pelle'] + '.mhmat'), corpo, skin_type='GAMEENGINE')
    rig = HumanService.add_builtin_rig(corpo, 'mixamo')
    for cartella, nome in [('eyes', 'low-poly')] + [('clothes', v) for v in scheda['vestiti']]:
        percorso = os.path.join(DATI, cartella, nome, nome + '.mhclo')
        HumanService.add_mhclo_asset(percorso, corpo, asset_type='Eyes' if cartella == 'eyes' else 'Clothes', subdiv_levels=0, material_type='GAMEENGINE')
    for figlio in rig.children_recursive:
        for slot in getattr(figlio, 'material_slots', []):
            if slot.material and ('mask' in slot.material.name.lower() or 'hood' in slot.material.name.lower()):
                slot.material = slot.material.copy()
                for n in slot.material.node_tree.nodes:
                    if n.type == 'BSDF_PRINCIPLED':
                        n.inputs['Base Color'].default_value = (0.012, 0.012, 0.014, 1)
                        for l in list(n.inputs['Base Color'].links):
                            slot.material.node_tree.links.remove(l)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.gait.create()
    bpy.ops.gait.anim_add(item='act|run')
    bpy.ops.gait.bake()
    act = next((a for a in bpy.data.actions if a.name.startswith(azione) and a.name not in persona.usate), None)
    if act:
        persona.usate.add(act.name)
        rig.animation_data_create()
        rig.animation_data.action = None
        traccia = rig.animation_data.nla_tracks.new()
        striscia = traccia.strips.new(act.name, int(1 - fotogramma), act)
        striscia.extrapolation = 'HOLD'
    rig.location = mondo3d(x, z, 0)
    rig.rotation_euler = (0, 0, yaw)
    rig['fotogramma'] = fotogramma
    sacco = materiale('sacco', (0.05, 0.06, 0.05), 0.75)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=20, ring_count=12, location=(0, 0, 0))
    b = bpy.context.object
    b.scale = (0.075, 0.1, 0.075)
    b.data.materials.append(sacco)
    b.parent = rig
    b.parent_type = 'BONE'
    b.parent_bone = sacco_mano
    b.location = (0, 0.12, 0)
    return rig


persona.usate = set()


def banconote(quante):
    bpy.ops.mesh.primitive_plane_add(size=1)
    base = bpy.context.object
    base.scale = (0.26, 0.12, 1)
    m = materiale('banconota', (0.36, 0.55, 0.38), 0.55)
    nodi = m.node_tree.nodes
    rumore = nodi.new('ShaderNodeTexNoise')
    rumore.inputs['Scale'].default_value = 40
    rampa = nodi.new('ShaderNodeValToRGB')
    rampa.color_ramp.elements[0].color = (0.22, 0.38, 0.25, 1)
    rampa.color_ramp.elements[1].color = (0.62, 0.78, 0.6, 1)
    m.node_tree.links.new(rumore.outputs['Fac'], rampa.inputs['Fac'])
    m.node_tree.links.new(rampa.outputs['Color'], nodi['Principled BSDF'].inputs['Base Color'])
    base.data.materials.append(m)
    for _ in range(quante):
        c = base.copy()
        c.data = base.data
        bpy.context.collection.objects.link(c)
        c.location = mondo3d(caso.uniform(-40, -28), caso.uniform(17.5, 27), caso.uniform(0.4, 3.8))
        c.rotation_euler = (caso.uniform(0, 6.3), caso.uniform(0, 6.3), caso.uniform(0, 6.3))
    bpy.data.objects.remove(base, do_unlink=True)


def luci():
    for colore, pos, forza in [((1.0, 0.04, 0.03), (-44, 25, 2.2), 3000), ((0.04, 0.18, 1.0), (-25, 25, 2.2), 3000), ((0.04, 0.18, 1.0), (-41, 11, 1.6), 1500), ((1.0, 0.04, 0.03), (-25, 12, 1.6), 1500)]:
        bpy.ops.object.light_add(type='POINT', location=mondo3d(pos[0], pos[1], pos[2]))
        l = bpy.context.object
        l.data.color = colore
        l.data.energy = forza
        l.data.shadow_soft_size = 0.4
    bpy.ops.object.light_add(type='SPOT', location=mondo3d(-36, 26, 7.5))
    l = bpy.context.object
    l.data.color = (1.0, 0.72, 0.45)
    l.data.energy = 2500
    l.data.spot_size = 1.2
    l.rotation_euler = (0.25, 0, 0)
    bpy.ops.object.light_add(type='AREA', location=mondo3d(-32.5, 14.0, 4.5))
    k = bpy.context.object
    k.data.color = (0.75, 0.85, 1.0)
    k.data.energy = 650
    k.data.size = 3
    k.rotation_euler = (math.radians(62), 0, math.radians(20))
    bpy.ops.object.light_add(type='AREA', location=mondo3d(-34, 40, 3))
    l = bpy.context.object
    l.data.color = (0.75, 1.0, 0.8)
    l.data.energy = 1800
    l.data.size = 8
    l.rotation_euler = (-1.3, 0, 0)


def cielo():
    w = bpy.data.worlds.new('notte')
    bpy.context.scene.world = w
    w.use_nodes = True
    sfondo = w.node_tree.nodes['Background']
    sfondo.inputs['Color'].default_value = (0.012, 0.014, 0.03, 1)
    sfondo.inputs['Strength'].default_value = 1.0
    volume = w.node_tree.nodes.new('ShaderNodeVolumePrincipled')
    volume.inputs['Density'].default_value = 0.007
    volume.inputs['Anisotropy'].default_value = 0.4
    w.node_tree.links.new(volume.outputs['Volume'], w.node_tree.nodes['World Output'].inputs['Volume'])


def camera():
    da = mondo3d(CAMERA[0], CAMERA[1], CAMERA[2])
    verso = mondo3d(MIRA[0], MIRA[1], MIRA[2])
    bpy.ops.object.camera_add(location=da)
    c = bpy.context.object
    dir = verso - da
    c.rotation_euler = dir.to_track_quat('-Z', 'Y').to_euler()
    c.data.lens = 22
    c.data.dof.use_dof = True
    c.data.dof.focus_distance = 3.4
    c.data.dof.aperture_fstop = 2.2
    bpy.context.scene.camera = c


def rendi():
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = CAMPIONI
    sc.cycles.use_denoising = True
    sc.cycles.volume_step_rate = 4
    sc.render.resolution_x = LARGO
    sc.render.resolution_y = ALTO
    sc.render.filepath = USCITA
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Punchy'
    sc.frame_set(1)
    bpy.ops.render.render(write_still=True)


svuota()
with open(DATI_CITTA, encoding='utf-8') as f:
    citta = json.load(f)
edifici(citta)
terreno()
supermercato()
fontana()
BANDA = [
    dict(macro=dict(gender=0.95, age=0.45, muscle=0.62, weight=0.52, height=0.6), pelle='middleage_caucasian_male', vestiti=['male_casualsuit05', 'shoes03', 'culturalibre_hero-heroine_hood_1', 'culturalibre_hero-heroine_hood_2']),
    dict(macro=dict(gender=0.05, age=0.42, muscle=0.6, weight=0.45, height=0.55), pelle='young_caucasian_female', vestiti=['toigo_basic_tucked_t-shirt', 'cortu_cargo_pants', 'shoes03', 'culturalibre_hero-heroine_hood_1', 'culturalibre_hero-heroine_hood_2']),
    dict(macro=dict(gender=0.9, age=0.38, muscle=0.7, weight=0.5, height=0.55), pelle='young_african_male', vestiti=['elvs_crude_t-shirt_male', 'cortu_cargo_pants', 'shoes04', 'culturalibre_hero-heroine_hood_1', 'culturalibre_hero-heroine_hood_2']),
]
persona(BANDA[0], -34.5, 19.3, math.pi + math.radians(6), 'run', 6, 'mixamorig:RightHand')
persona(BANDA[1], -36.9, 21.3, math.pi - math.radians(12), 'run', 12, 'mixamorig:LeftHand')
persona(BANDA[2], -32.2, 21.1, math.pi + math.radians(18), 'run', 3, 'mixamorig:RightHand')
banconote(140)
luci()
cielo()
camera()
rendi()
print('COPERTINA', USCITA)
