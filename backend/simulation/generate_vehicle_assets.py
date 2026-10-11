"""
Generates production-grade 3D Vehicle & Urban Stunt GLB assets for RoboTwin.
Creates detailed, multi-part 3D models with accurate automotive proportions,
materials, wheels, lighting elements, and collision damage variants:

- vehicle_sedan: Modern aerodynamic commuter sedan (blue/silver)
- vehicle_suv: Bold full-size SUV with roof rails and alloy wheels (dark charcoal)
- vehicle_sportscar: Low-slung aerodynamic sports car with rear spoiler (amber/crimson)
- vehicle_truck: Commercial delivery box truck with cargo container (white/steel)
- vehicle_police: Police interceptor with cruiser paint and rooftop red/blue lightbar
- vehicle_sedan_damaged: Frontally crumpled sedan with crushed hood and tilted bumper
- vehicle_suv_damaged: T-boned SUV with crushed door panels and sheared bumper
- prop_debris_cluster: Automotive accident debris (tires, broken bumper, metal fragments)
- prop_barrier: Concrete urban jersey barrier with yellow caution reflector
- prop_traffic_light: Street traffic signal pole with signal housing
"""

import os
import math
import numpy as np
import trimesh
from trimesh.creation import cylinder, box, icosphere
from trimesh.transformations import rotation_matrix, translation_matrix

OUTPUT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public", "models")
)

def rot_x(deg):
    return rotation_matrix(math.radians(deg), [1, 0, 0])

def rot_y(deg):
    return rotation_matrix(math.radians(deg), [0, 1, 0])

def rot_z(deg):
    return rotation_matrix(math.radians(deg), [0, 0, 1])

def colorize(mesh, rgba):
    """Assigns uniform RGBA vertex colors to a trimesh."""
    mesh.visual.vertex_colors = np.tile(rgba, (len(mesh.vertices), 1))
    return mesh

def create_wheel(radius=0.34, width=0.22, rim_color=[180, 190, 205, 255]):
    """Creates an assembled wheel with rubber tire and alloy rim."""
    tire = cylinder(radius=radius, height=width, sections=24)
    tire.apply_transform(rot_x(90))
    colorize(tire, [30, 32, 38, 255])  # Matte dark rubber

    rim = cylinder(radius=radius * 0.65, height=width + 0.01, sections=16)
    rim.apply_transform(rot_x(90))
    colorize(rim, rim_color)

    hub = icosphere(radius=radius * 0.28, subdivisions=2)
    colorize(hub, [100, 110, 125, 255])

    return [tire, rim, hub]

def build_sedan(damaged=False):
    """Builds a realistic 4-door sedan (length=4.6m, width=1.85m, height=1.45m)."""
    meshes = []
    
    # Body paint
    c_paint = [35, 75, 140, 255] if not damaged else [28, 60, 115, 255] # Deep sapphire blue
    c_glass = [40, 60, 85, 230] # Tinted automotive glass
    c_chrome = [210, 215, 225, 255]
    c_headlight = [255, 255, 220, 255]
    c_taillight = [220, 30, 30, 255]
    c_undercarriage = [25, 25, 28, 255]

    # Lower chassis
    chassis = box(extents=[1.85, 4.4, 0.45])
    chassis.apply_translation([0, 0, 0.45])
    colorize(chassis, c_paint)
    meshes.append(chassis)

    # Undercarriage dark plate
    undercarriage = box(extents=[1.7, 4.2, 0.15])
    undercarriage.apply_translation([0, 0, 0.22])
    colorize(undercarriage, c_undercarriage)
    meshes.append(undercarriage)

    # Hood & Trunk decks
    if not damaged:
        # Clean front hood
        hood = box(extents=[1.75, 1.3, 0.2])
        hood.apply_translation([0, 1.45, 0.68])
        colorize(hood, c_paint)
        meshes.append(hood)
    else:
        # Accordion-crumpled front hood
        hood_front = box(extents=[1.65, 0.6, 0.28])
        hood_front.apply_transform(rot_x(22))
        hood_front.apply_translation([0, 1.6, 0.82])
        colorize(hood_front, [55, 60, 68, 255]) # Exposed crumpled steel
        meshes.append(hood_front)

        hood_rear = box(extents=[1.7, 0.65, 0.22])
        hood_rear.apply_transform(rot_x(-15))
        hood_rear.apply_translation([0, 1.1, 0.76])
        colorize(hood_rear, c_paint)
        meshes.append(hood_rear)

        # Deployed driver airbag inside windshield
        airbag = icosphere(radius=0.25, subdivisions=2)
        airbag.apply_translation([0.35, 0.35, 1.05])
        colorize(airbag, [240, 240, 245, 255])
        meshes.append(airbag)

    # Rear trunk
    trunk = box(extents=[1.75, 1.05, 0.25])
    trunk.apply_translation([0, -1.6, 0.70])
    colorize(trunk, c_paint)
    meshes.append(trunk)

    # Passenger greenhouse / cabin
    cabin = box(extents=[1.65, 2.1, 0.62])
    cabin.apply_translation([0, -0.05, 0.98])
    colorize(cabin, c_paint)
    meshes.append(cabin)

    # Windshield front
    windshield = box(extents=[1.55, 0.08, 0.58])
    windshield.apply_transform(rot_x(32))
    windshield.apply_translation([0, 0.95, 0.95])
    colorize(windshield, c_glass)
    meshes.append(windshield)

    # Rear window
    rear_glass = box(extents=[1.55, 0.08, 0.52])
    rear_glass.apply_transform(rot_x(-32))
    rear_glass.apply_translation([0, -1.05, 0.95])
    colorize(rear_glass, c_glass)
    meshes.append(rear_glass)

    # Side windows
    for side in [-0.83, 0.83]:
        side_glass = box(extents=[0.05, 1.7, 0.42])
        side_glass.apply_translation([side, -0.05, 1.02])
        colorize(side_glass, c_glass)
        meshes.append(side_glass)

    # Bumpers
    front_bumper = box(extents=[1.82, 0.25, 0.32])
    if damaged:
        front_bumper.apply_transform(rot_z(14))
        front_bumper.apply_transform(rot_x(18))
        front_bumper.apply_translation([0.1, 2.15, 0.38])
    else:
        front_bumper.apply_translation([0, 2.15, 0.42])
    colorize(front_bumper, [45, 48, 55, 255])
    meshes.append(front_bumper)

    rear_bumper = box(extents=[1.82, 0.25, 0.32])
    rear_bumper.apply_translation([0, -2.15, 0.42])
    colorize(rear_bumper, [45, 48, 55, 255])
    meshes.append(rear_bumper)

    # Headlights & Taillights
    for side in [-0.68, 0.68]:
        hl = box(extents=[0.32, 0.08, 0.16])
        hl.apply_translation([side, 2.16, 0.58])
        colorize(hl, c_headlight if not (damaged and side > 0) else [80, 80, 80, 255])
        meshes.append(hl)

        tl = box(extents=[0.32, 0.08, 0.16])
        tl.apply_translation([side, -2.16, 0.58])
        colorize(tl, c_taillight)
        meshes.append(tl)

    # Wheels (Front & Rear, Left & Right)
    wheel_y = [1.35, -1.35]
    wheel_x = [-0.85, 0.85]
    for wy in wheel_y:
        for wx in wheel_x:
            parts = create_wheel(radius=0.34, width=0.22)
            for p in parts:
                mesh_copy = p.copy()
                if damaged and wy > 0 and wx > 0:
                    # Smashed bent right front wheel
                    mesh_copy.apply_transform(rot_y(25))
                    mesh_copy.apply_transform(rot_z(-20))
                mesh_copy.apply_translation([wx, wy, 0.34])
                meshes.append(mesh_copy)

    combined = trimesh.util.concatenate(meshes)
    return combined

def build_suv(damaged=False):
    """Builds a full-size SUV (length=4.9m, width=1.98m, height=1.78m)."""
    meshes = []
    
    c_paint = [45, 48, 54, 255] if not damaged else [38, 40, 45, 255] # Tactical Charcoal
    c_trim = [25, 28, 32, 255]
    c_glass = [30, 45, 65, 230]
    c_headlight = [240, 248, 255, 255]
    c_taillight = [230, 20, 20, 255]
    c_roof_rack = [150, 155, 165, 255]

    # Main Body block
    chassis = box(extents=[1.98, 4.7, 0.55])
    chassis.apply_translation([0, 0, 0.55])
    colorize(chassis, c_paint)
    meshes.append(chassis)

    # Cabin Greenhouse (Tall & Boxy)
    cabin = box(extents=[1.85, 3.2, 0.78])
    if not damaged:
        cabin.apply_translation([0, -0.35, 1.18])
    else:
        # T-boned side crushing
        cabin.apply_transform(rot_x(6))
        cabin.apply_translation([0.15, -0.35, 1.15])
    colorize(cabin, c_paint)
    meshes.append(cabin)

    # Hood
    hood = box(extents=[1.85, 1.4, 0.28])
    hood.apply_translation([0, 1.55, 0.82])
    colorize(hood, c_paint)
    meshes.append(hood)

    # Roof rails
    for side in [-0.82, 0.82]:
        rail = cylinder(radius=0.03, height=2.8, sections=12)
        rail.apply_transform(rot_x(90))
        rail.apply_translation([side, -0.35, 1.62])
        colorize(rail, c_roof_rack)
        meshes.append(rail)

    # Windshield (Upright SUV rake)
    windshield = box(extents=[1.72, 0.08, 0.68])
    windshield.apply_transform(rot_x(26))
    windshield.apply_translation([0, 1.18, 1.16])
    colorize(windshield, c_glass)
    meshes.append(windshield)

    # Rear glass
    rear_glass = box(extents=[1.72, 0.08, 0.62])
    rear_glass.apply_translation([0, -1.92, 1.18])
    colorize(rear_glass, c_glass)
    meshes.append(rear_glass)

    # Heavy bumpers
    front_bumper = box(extents=[1.96, 0.32, 0.38])
    front_bumper.apply_translation([0, 2.32, 0.48])
    colorize(front_bumper, c_trim)
    meshes.append(front_bumper)

    rear_bumper = box(extents=[1.96, 0.32, 0.38])
    rear_bumper.apply_translation([0, -2.32, 0.48])
    colorize(rear_bumper, c_trim)
    meshes.append(rear_bumper)

    # Lights
    for side in [-0.75, 0.75]:
        hl = box(extents=[0.36, 0.08, 0.22])
        hl.apply_translation([side, 2.34, 0.70])
        colorize(hl, c_headlight)
        meshes.append(hl)

        tl = box(extents=[0.24, 0.08, 0.45])
        tl.apply_translation([side, -2.33, 0.95])
        colorize(tl, c_taillight)
        meshes.append(tl)

    # Chunky SUV Wheels
    wheel_y = [1.45, -1.45]
    wheel_x = [-0.94, 0.94]
    for wy in wheel_y:
        for wx in wheel_x:
            parts = create_wheel(radius=0.42, width=0.28, rim_color=[80, 85, 95, 255])
            for p in parts:
                mesh_copy = p.copy()
                if damaged and wx > 0 and wy < 0:
                    # Side impact wheel sheared inwards
                    mesh_copy.apply_transform(rot_y(15))
                    mesh_copy.apply_transform(rot_x(12))
                mesh_copy.apply_translation([wx, wy, 0.42])
                meshes.append(mesh_copy)

    combined = trimesh.util.concatenate(meshes)
    return combined

def build_sportscar():
    """Builds an exotic aerodynamic sports car with rear wing (length=4.6m, width=2.02m, height=1.18m)."""
    meshes = []
    c_paint = [235, 140, 20, 255] # Racing Amber Gold
    c_glass = [20, 25, 35, 240]
    c_carbon = [22, 22, 24, 255]
    c_brake_caliper = [220, 20, 20, 255]

    # Ultra-low aerodynamic body
    chassis = box(extents=[2.02, 4.5, 0.35])
    chassis.apply_translation([0, 0, 0.32])
    colorize(chassis, c_paint)
    meshes.append(chassis)

    # Sloped aerodynamic nose
    nose = box(extents=[1.92, 1.2, 0.18])
    nose.apply_transform(rot_x(14))
    nose.apply_translation([0, 1.6, 0.44])
    colorize(nose, c_paint)
    meshes.append(nose)

    # Low aerodynamic canopy / cockpit
    cabin = box(extents=[1.5, 1.8, 0.48])
    cabin.apply_translation([0, -0.15, 0.72])
    colorize(cabin, c_paint)
    meshes.append(cabin)

    windshield = box(extents=[1.42, 0.08, 0.52])
    windshield.apply_transform(rot_x(48)) # Steep aero rake
    windshield.apply_translation([0, 0.75, 0.74])
    colorize(windshield, c_glass)
    meshes.append(windshield)

    # Rear aerodynamic wing / spoiler
    wing = box(extents=[1.88, 0.35, 0.06])
    wing.apply_translation([0, -1.95, 0.92])
    colorize(wing, c_carbon)
    meshes.append(wing)

    for side in [-0.65, 0.65]:
        pylon = box(extents=[0.05, 0.15, 0.32])
        pylon.apply_translation([side, -1.95, 0.76])
        colorize(pylon, c_carbon)
        meshes.append(pylon)

    # Front splitter
    splitter = box(extents=[2.04, 0.25, 0.06])
    splitter.apply_translation([0, 2.22, 0.16])
    colorize(splitter, c_carbon)
    meshes.append(splitter)

    # Wide sports wheels with low-profile tires
    wheel_y = [1.35, -1.35]
    wheel_x = [-0.96, 0.96]
    for wy in wheel_y:
        for wx in wheel_x:
            parts = create_wheel(radius=0.33, width=0.28, rim_color=[230, 230, 235, 255])
            for p in parts:
                mesh_copy = p.copy()
                mesh_copy.apply_translation([wx, wy, 0.33])
                meshes.append(mesh_copy)

    combined = trimesh.util.concatenate(meshes)
    return combined

def build_truck():
    """Builds a commercial box delivery truck (length=6.8m, width=2.4m, height=3.1m)."""
    meshes = []
    c_cab = [230, 235, 240, 255] # Clean White Cab
    c_box = [215, 220, 228, 255] # Cargo Container Box
    c_frame = [35, 38, 42, 255]  # Heavy Steel Chassis Frame
    c_glass = [40, 60, 80, 230]

    # Heavy steel chassis rails
    rails = box(extents=[1.8, 6.4, 0.35])
    rails.apply_translation([0, -0.4, 0.45])
    colorize(rails, c_frame)
    meshes.append(rails)

    # Forward cab
    cab = box(extents=[2.25, 1.8, 1.9])
    cab.apply_translation([0, 2.1, 1.55])
    colorize(cab, c_cab)
    meshes.append(cab)

    # Cab windshield
    windshield = box(extents=[2.1, 0.08, 0.85])
    windshield.apply_transform(rot_x(12))
    windshield.apply_translation([0, 2.92, 1.75])
    colorize(windshield, c_glass)
    meshes.append(windshield)

    # Large cargo container box
    cargo_box = box(extents=[2.38, 4.4, 2.35])
    cargo_box.apply_translation([0, -0.9, 1.85])
    colorize(cargo_box, c_box)
    meshes.append(cargo_box)

    # Heavy front bumper
    front_bumper = box(extents=[2.35, 0.3, 0.42])
    front_bumper.apply_translation([0, 3.02, 0.45])
    colorize(front_bumper, c_frame)
    meshes.append(front_bumper)

    # Dual rear axle + front wheels
    wheel_configs = [
        (2.1, [-1.05, 1.05]),   # Front steer
        (-1.7, [-1.08, 1.08]),  # Rear axle 1
        (-2.6, [-1.08, 1.08])   # Rear axle 2
    ]
    for wy, wxs in wheel_configs:
        for wx in wxs:
            parts = create_wheel(radius=0.48, width=0.32, rim_color=[120, 125, 135, 255])
            for p in parts:
                mesh_copy = p.copy()
                mesh_copy.apply_translation([wx, wy, 0.48])
                meshes.append(mesh_copy)

    combined = trimesh.util.concatenate(meshes)
    return combined

def build_police_cruiser():
    """Builds a police cruiser with lightbar on top of the sedan base."""
    sedan = build_sedan(damaged=False)
    meshes = [sedan]

    # Emergency roof lightbar
    lightbar_base = box(extents=[1.1, 0.22, 0.06])
    lightbar_base.apply_translation([0, -0.05, 1.34])
    colorize(lightbar_base, [30, 30, 32, 255])
    meshes.append(lightbar_base)

    # Red beacon (Left)
    red_light = box(extents=[0.45, 0.18, 0.12])
    red_light.apply_translation([-0.3, -0.05, 1.41])
    colorize(red_light, [255, 30, 30, 255])
    meshes.append(red_light)

    # Blue beacon (Right)
    blue_light = box(extents=[0.45, 0.18, 0.12])
    blue_light.apply_translation([0.3, -0.05, 1.41])
    colorize(blue_light, [30, 110, 255, 255])
    meshes.append(blue_light)

    # Push bumper / bullbar on front
    pushbar = box(extents=[1.3, 0.15, 0.42])
    pushbar.apply_translation([0, 2.28, 0.48])
    colorize(pushbar, [20, 20, 22, 255])
    meshes.append(pushbar)

    combined = trimesh.util.concatenate(meshes)
    return combined

def build_debris_cluster():
    """Builds scattered accident debris parts (tire, crumpled panel, bumper fragment)."""
    meshes = []
    
    # Dislodged wheel on side
    tire_parts = create_wheel(radius=0.34, width=0.22)
    for p in tire_parts:
        m = p.copy()
        m.apply_transform(rot_x(82))
        m.apply_translation([0.6, 0.4, 0.12])
        meshes.append(m)

    # Crumpled metal quarter panel
    panel = box(extents=[0.85, 0.55, 0.12])
    panel.apply_transform(rot_z(35))
    panel.apply_transform(rot_x(-20))
    panel.apply_translation([-0.5, 0.3, 0.14])
    colorize(panel, [120, 130, 145, 255])
    meshes.append(panel)

    # Broken bumper corner
    bumper_frag = box(extents=[0.9, 0.22, 0.18])
    bumper_frag.apply_transform(rot_z(-55))
    bumper_frag.apply_translation([0.2, -0.6, 0.10])
    colorize(bumper_frag, [40, 42, 48, 255])
    meshes.append(bumper_frag)

    # Broken glass shard cluster (tinted translucent appearance)
    glass_shards = box(extents=[0.6, 0.8, 0.04])
    glass_shards.apply_translation([-0.1, -0.1, 0.04])
    colorize(glass_shards, [180, 210, 230, 200])
    meshes.append(glass_shards)

    combined = trimesh.util.concatenate(meshes)
    return combined

def build_concrete_barrier():
    """Builds a standard concrete Jersey crash barrier."""
    meshes = []
    c_concrete = [175, 178, 185, 255]
    c_stripe = [245, 180, 25, 255]

    base = box(extents=[0.65, 3.2, 0.35])
    base.apply_translation([0, 0, 0.18])
    colorize(base, c_concrete)
    meshes.append(base)

    stem = box(extents=[0.35, 3.2, 0.65])
    stem.apply_translation([0, 0, 0.65])
    colorize(stem, c_concrete)
    meshes.append(stem)

    # Caution stripe
    stripe = box(extents=[0.36, 0.8, 0.2])
    stripe.apply_translation([0, 0, 0.65])
    colorize(stripe, c_stripe)
    meshes.append(stripe)

    combined = trimesh.util.concatenate(meshes)
    return combined

def build_traffic_light():
    """Builds an urban traffic signal pole with signal housing."""
    meshes = []
    c_pole = [45, 48, 52, 255]
    c_yellow = [240, 195, 30, 255]
    c_green = [30, 220, 60, 255]
    c_red = [240, 30, 30, 255]

    # Vertical mast pole
    pole = cylinder(radius=0.12, height=5.5, sections=16)
    pole.apply_translation([0, 0, 2.75])
    colorize(pole, c_pole)
    meshes.append(pole)

    # Cantilever arm
    arm = cylinder(radius=0.08, height=3.5, sections=12)
    arm.apply_transform(rot_x(90))
    arm.apply_translation([0, 1.6, 5.2])
    colorize(arm, c_pole)
    meshes.append(arm)

    # Signal housing
    housing = box(extents=[0.35, 0.3, 1.1])
    housing.apply_translation([0, 2.8, 4.8])
    colorize(housing, [30, 32, 35, 255])
    meshes.append(housing)

    # Red lens
    red_lens = icosphere(radius=0.1, subdivisions=2)
    red_lens.apply_translation([0, 2.65, 5.15])
    colorize(red_lens, c_red)
    meshes.append(red_lens)

    # Yellow lens
    yellow_lens = icosphere(radius=0.1, subdivisions=2)
    yellow_lens.apply_translation([0, 2.65, 4.8])
    colorize(yellow_lens, [100, 80, 20, 255]) # Inactive
    meshes.append(yellow_lens)

    # Green lens
    green_lens = icosphere(radius=0.1, subdivisions=2)
    green_lens.apply_translation([0, 2.65, 4.45])
    colorize(green_lens, [20, 80, 30, 255]) # Inactive
    meshes.append(green_lens)

    combined = trimesh.util.concatenate(meshes)
    return combined

def build_quadcopter():
    """Builds an autonomous 4-rotor tactical stunt & surveillance quadcopter drone."""
    meshes = []
    c_carbon = [28, 30, 36, 255]
    c_accent = [6, 182, 212, 255]  # Cyan accent
    c_rotor = [18, 20, 24, 230]
    c_lens = [0, 242, 254, 255]

    # Central fuselage / avionics hub
    hub = box(extents=[0.38, 0.44, 0.14])
    hub.apply_translation([0, 0, 0.28])
    colorize(hub, c_carbon)
    meshes.append(hub)

    # Upper aerodynamic canopy
    canopy = box(extents=[0.24, 0.32, 0.08])
    canopy.apply_translation([0, -0.02, 0.38])
    colorize(canopy, c_accent)
    meshes.append(canopy)

    # Forward 4K sensor gimbal
    gimbal = icosphere(radius=0.07, subdivisions=2)
    gimbal.apply_translation([0, 0.24, 0.24])
    colorize(gimbal, c_lens)
    meshes.append(gimbal)

    # 4 diagonal rotor arms
    arm_span = 0.48
    angles = [45, 135, 225, 315]
    for ang in angles:
        rad = math.radians(ang)
        dx = arm_span * math.cos(rad)
        dy = arm_span * math.sin(rad)

        # Carbon fiber structural arm
        arm = cylinder(radius=0.022, height=arm_span, sections=12)
        arm.apply_transform(rot_y(90))
        arm.apply_transform(rot_z(ang))
        arm.apply_translation([dx * 0.5, dy * 0.5, 0.28])
        colorize(arm, c_carbon)
        meshes.append(arm)

        # Brushless motor housing at tip
        motor = cylinder(radius=0.045, height=0.08, sections=16)
        motor.apply_translation([dx, dy, 0.32])
        colorize(motor, [45, 48, 55, 255])
        meshes.append(motor)

        # Propeller blades (2-blade assembly)
        prop = box(extents=[0.26, 0.032, 0.008])
        prop.apply_translation([dx, dy, 0.37])
        colorize(prop, c_rotor)
        meshes.append(prop)

    # Twin landing skids
    for side in [-0.18, 0.18]:
        skid_tube = cylinder(radius=0.012, height=0.52, sections=12)
        skid_tube.apply_transform(rot_x(90))
        skid_tube.apply_translation([side, 0, 0.12])
        colorize(skid_tube, [50, 55, 65, 255])
        meshes.append(skid_tube)

        # Struts
        for fwd in [-0.16, 0.16]:
            strut = cylinder(radius=0.012, height=0.18, sections=12)
            strut.apply_translation([side, fwd, 0.20])
            colorize(strut, [50, 55, 65, 255])
            meshes.append(strut)

    combined = trimesh.util.concatenate(meshes)
    return combined

def build_traffic_cone():
    """Builds an OSHA-compliant high-visibility safety traffic cone with reflective stripes."""
    meshes = []
    c_orange = [255, 92, 10, 255]
    c_white = [245, 245, 250, 255]
    c_base = [22, 24, 28, 255]

    # Weighted rubber square base
    base = box(extents=[0.42, 0.42, 0.04])
    base.apply_translation([0, 0, 0.02])
    colorize(base, c_base)
    meshes.append(base)

    # Conical body segments with reflective stripe
    # Bottom cone section (orange)
    c1 = cylinder(radius=0.18, height=0.28, sections=24)
    c1.apply_translation([0, 0, 0.18])
    colorize(c1, c_orange)
    meshes.append(c1)

    # Middle retro-reflective collar (white)
    c2 = cylinder(radius=0.13, height=0.18, sections=24)
    c2.apply_translation([0, 0, 0.40])
    colorize(c2, c_white)
    meshes.append(c2)

    # Upper cone tip (orange)
    c3 = cylinder(radius=0.08, height=0.26, sections=24)
    c3.apply_translation([0, 0, 0.60])
    colorize(c3, c_orange)
    meshes.append(c3)

    combined = trimesh.util.concatenate(meshes)
    return combined

def build_cargo_crate():
    """Builds a reinforced industrial heavy cargo crate with steel corner protectors."""
    meshes = []
    c_wood = [148, 108, 64, 255]
    c_steel = [45, 50, 58, 255]
    c_stencil = [234, 179, 8, 255]

    # Main wooden box body (1.2m cube)
    body = box(extents=[1.16, 1.16, 1.16])
    body.apply_translation([0, 0, 0.58])
    colorize(body, c_wood)
    meshes.append(body)

    # Corner steel framing posts
    for x in [-0.58, 0.58]:
        for y in [-0.58, 0.58]:
            bracket = box(extents=[0.08, 0.08, 1.20])
            bracket.apply_translation([x, y, 0.60])
            colorize(bracket, c_steel)
            meshes.append(bracket)

    # Diagonal brace bands
    band_top = box(extents=[1.22, 1.22, 0.08])
    band_top.apply_translation([0, 0, 1.16])
    colorize(band_top, c_steel)
    meshes.append(band_top)

    band_bottom = box(extents=[1.22, 1.22, 0.08])
    band_bottom.apply_translation([0, 0, 0.04])
    colorize(band_bottom, c_steel)
    meshes.append(band_bottom)

    # Hazard caution label
    label = box(extents=[0.36, 0.01, 0.24])
    label.apply_translation([0, 0.59, 0.60])
    colorize(label, c_stencil)
    meshes.append(label)

    combined = trimesh.util.concatenate(meshes)
    return combined

def export_asset(mesh, filename):
    """Exports a trimesh to binary GLB format, converting from MuJoCo Z-up to standard glTF 2.0 Y-up coordinates so vehicles sit horizontally on their wheels and props stand upright."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_path = os.path.join(OUTPUT_DIR, filename)
    # Convert Z-up (MuJoCo/robotics) to Y-up (glTF 2.0 / Three.js / Google Maps 3D)
    mesh_export = mesh.copy()
    mesh_export.apply_transform(rot_x(-90))
    data = mesh_export.export(file_type="glb")
    with open(out_path, "wb") as f:
        f.write(data)
    print(f"Generated {filename}: {len(data):,} bytes ({out_path})")

def main():
    print("Generating RoboTwin Stunt & Vehicle 3D GLB assets...")
    assets = [
        ("vehicle_sedan.glb", lambda: build_sedan(damaged=False)),
        ("vehicle_sedan_damaged.glb", lambda: build_sedan(damaged=True)),
        ("vehicle_suv.glb", lambda: build_suv(damaged=False)),
        ("vehicle_suv_damaged.glb", lambda: build_suv(damaged=True)),
        ("vehicle_sportscar.glb", lambda: build_sportscar()),
        ("vehicle_truck.glb", lambda: build_truck()),
        ("vehicle_police.glb", lambda: build_police_cruiser()),
        ("prop_debris_cluster.glb", lambda: build_debris_cluster()),
        ("prop_barrier.glb", lambda: build_concrete_barrier()),
        ("prop_traffic_light.glb", lambda: build_traffic_light()),
        ("drone_quadcopter.glb", lambda: build_quadcopter()),
        ("prop_traffic_cone.glb", lambda: build_traffic_cone()),
        ("prop_delivery_crate.glb", lambda: build_cargo_crate()),
    ]
    for filename, builder in assets:
        mesh = builder()
        export_asset(mesh, filename)
    print("All vehicle, drone, and stunt prop assets generated successfully!")

if __name__ == "__main__":
    main()
