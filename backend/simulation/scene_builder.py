"""
RoboTwin Two-Layer Scene Compiler
Merges phone-scanned environment geometry with MuJoCo physics layer and articulated humanoid.
"""

import json
import os
import xml.etree.ElementTree as ET
from typing import Dict, Any, Optional

class SceneBuilder:
    def __init__(self, scenes_dir: str, robot_xml_path: str):
        self.scenes_dir = scenes_dir
        self.robot_xml_path = robot_xml_path

    def load_scene_config(self, scene_filename: str = "default_room.json") -> Dict[str, Any]:
        path = os.path.join(self.scenes_dir, scene_filename)
        with open(path, "r") as f:
            return json.load(f)

    def save_scene_config(self, config: Dict[str, Any], scene_filename: str = "default_room.json"):
        path = os.path.join(self.scenes_dir, scene_filename)
        with open(path, "w") as f:
            json.dump(config, f, indent=2)

    def build_full_scene_xml(self, scene_config: Optional[Dict[str, Any]] = None, output_path: Optional[str] = None) -> str:
        """
        Compiles the complete MJCF XML by injecting scene objects into the base humanoid model.
        """
        if scene_config is None:
            scene_config = self.load_scene_config()

        tree = ET.parse(self.robot_xml_path)
        root = tree.getroot()
        worldbody = root.find("worldbody")
        if worldbody is None:
            raise ValueError("Worldbody element not found in base humanoid XML")

        # Reposition robot pelvis spawn if specified
        robot_spawn = scene_config.get("robot_spawn", {})
        spawn_pos = robot_spawn.get("position", [0.0, 0.0, 0.98])
        pelvis = worldbody.find(".//body[@name='pelvis']")
        if pelvis is not None:
            pelvis.set("pos", f"{spawn_pos[0]} {spawn_pos[1]} {spawn_pos[2]}")

        # Add visual environment assets
        asset_el = root.find("asset")
        if asset_el is None:
            asset_el = ET.SubElement(root, "asset")

        # Add room floor and environment boundary materials
        ET.SubElement(asset_el, "material", {
            "name": "mat_floor",
            "rgba": "0.12 0.15 0.20 1.0",
            "specular": "0.1"
        })
        ET.SubElement(asset_el, "material", {
            "name": "mat_desk",
            "rgba": "0.45 0.35 0.24 1.0",
            "specular": "0.2"
        })
        ET.SubElement(asset_el, "material", {
            "name": "mat_shelf",
            "rgba": "0.24 0.28 0.36 1.0",
            "specular": "0.3"
        })
        ET.SubElement(asset_el, "material", {
            "name": "mat_bottle",
            "rgba": "0.08 0.72 0.95 0.95",
            "specular": "0.6"
        })

        # Add materials for furniture elements
        ET.SubElement(asset_el, "material", {
            "name": "mat_table_wood",
            "rgba": "0.45 0.32 0.20 1.0",
            "specular": "0.2"
        })
        ET.SubElement(asset_el, "material", {
            "name": "mat_table_metal",
            "rgba": "0.18 0.20 0.24 1.0",
            "specular": "0.5"
        })
        ET.SubElement(asset_el, "material", {
            "name": "mat_chair_seat",
            "rgba": "0.24 0.28 0.34 1.0",
            "specular": "0.3"
        })
        ET.SubElement(asset_el, "material", {
            "name": "mat_chair_back",
            "rgba": "0.22 0.26 0.32 1.0",
            "specular": "0.3"
        })

        # Inject objects into worldbody
        for obj in scene_config.get("objects", []):
            obj_id = obj.get("id")
            geom_type = obj.get("geometry", "box")
            pos = obj.get("position", [0, 0, 0])
            size = obj.get("size", [0.1, 0.1, 0.1])
            movable = obj.get("movable", False)
            color = obj.get("color", [0.7, 0.7, 0.7, 1.0])
            rgba_str = " ".join(str(c) for c in color)
            friction = obj.get("friction", [1.0, 0.05, 0.001])
            friction_str = " ".join(str(f) for f in friction)

            if geom_type == "compound_table":
                # Realistic Dining Table: Tabletop slab + 4 corner legs with open clearance underneath
                surf_h = float(obj.get("surface_height", 0.74))
                tbl_w = float(size[0])  # half-length
                tbl_d = float(size[1])  # half-width
                top_th = 0.025         # half-thickness of tabletop
                leg_h = surf_h - (top_th * 2.0)
                leg_r = 0.032
                leg_ox = max(0.1, tbl_w - 0.08)
                leg_oy = max(0.1, tbl_d - 0.08)

                body = ET.SubElement(worldbody, "body", {
                    "name": obj_id,
                    "pos": f"{pos[0]} {pos[1]} 0.0"
                })
                # Tabletop slab
                ET.SubElement(body, "geom", {
                    "name": f"{obj_id}_top",
                    "type": "box",
                    "pos": f"0 0 {surf_h - top_th:.3f}",
                    "size": f"{tbl_w:.3f} {tbl_d:.3f} {top_th:.3f}",
                    "material": "mat_table_wood",
                    "friction": friction_str,
                    "contype": "1",
                    "conaffinity": "1"
                })
                # 4 Corner Legs
                for leg_idx, (lx, ly) in enumerate([
                    (leg_ox, leg_oy), (leg_ox, -leg_oy),
                    (-leg_ox, leg_oy), (-leg_ox, -leg_oy)
                ]):
                    ET.SubElement(body, "geom", {
                        "name": f"{obj_id}_leg_{leg_idx}",
                        "type": "cylinder",
                        "pos": f"{lx:.3f} {ly:.3f} {leg_h / 2.0:.3f}",
                        "size": f"{leg_r:.3f} {leg_h / 2.0:.3f}",
                        "material": "mat_table_metal",
                        "friction": friction_str,
                        "contype": "1",
                        "conaffinity": "1"
                    })
                # Center tracking site
                ET.SubElement(body, "site", {
                    "name": f"{obj_id}_site",
                    "pos": f"0 0 {surf_h:.3f}",
                    "size": "0.02",
                    "rgba": "0 1 0 0.5"
                })

            elif geom_type == "compound_chair":
                # Physics-ready Movable Chair: Freejoint + Seat + 4 Legs + Backrest + Hand Push Target Site
                body = ET.SubElement(worldbody, "body", {
                    "name": obj_id,
                    "pos": f"{pos[0]} {pos[1]} 0.0"
                })
                ET.SubElement(body, "freejoint", {"name": f"{obj_id}_freejoint"})

                seat_h = 0.42
                seat_th = 0.02
                seat_w = 0.22
                seat_d = 0.22
                leg_h = seat_h - seat_th
                leg_r = 0.02
                leg_ox = seat_w - 0.04
                leg_oy = seat_d - 0.04
                back_h = 0.36

                # Seat Cushion / Base
                ET.SubElement(body, "geom", {
                    "name": f"{obj_id}_seat",
                    "type": "box",
                    "pos": f"0 0 {seat_h:.3f}",
                    "size": f"{seat_w:.3f} {seat_d:.3f} {seat_th:.3f}",
                    "material": "mat_chair_seat",
                    "mass": "2.2",
                    "friction": friction_str,
                    "contype": "1",
                    "conaffinity": "1"
                })
                # Backrest (at rear edge: negative X side)
                ET.SubElement(body, "geom", {
                    "name": f"{obj_id}_backrest",
                    "type": "box",
                    "pos": f"{-seat_w + 0.02:.3f} 0 {seat_h + back_h / 2.0:.3f}",
                    "size": f"0.02 {seat_d:.3f} {back_h / 2.0:.3f}",
                    "material": "mat_chair_back",
                    "mass": "1.2",
                    "friction": friction_str,
                    "contype": "1",
                    "conaffinity": "1"
                })
                # 4 Chair Legs down to floor
                for leg_idx, (lx, ly) in enumerate([
                    (leg_ox, leg_oy), (leg_ox, -leg_oy),
                    (-leg_ox, leg_oy), (-leg_ox, -leg_oy)
                ]):
                    ET.SubElement(body, "geom", {
                        "name": f"{obj_id}_leg_{leg_idx}",
                        "type": "cylinder",
                        "pos": f"{lx:.3f} {ly:.3f} {leg_h / 2.0:.3f}",
                        "size": f"{leg_r:.3f} {leg_h / 2.0:.3f}",
                        "material": "mat_table_metal",
                        "mass": "0.2",
                        "friction": friction_str,
                        "contype": "1",
                        "conaffinity": "1"
                    })
                # Push Contact Site on Backrest
                ET.SubElement(body, "site", {
                    "name": f"{obj_id}_backrest_site",
                    "pos": f"{-seat_w + 0.02:.3f} 0 {seat_h + back_h - 0.04:.3f}",
                    "size": "0.025",
                    "rgba": "0 0.8 1 0.8"
                })
                # Center tracking site
                ET.SubElement(body, "site", {
                    "name": f"{obj_id}_site",
                    "pos": f"0 0 {seat_h:.3f}",
                    "size": "0.02",
                    "rgba": "1 1 0 1"
                })

            elif geom_type == "door_frame":
                # Static door frame with opening
                door_w = float(size[0]) if len(size) > 0 else 0.95
                door_d = float(size[1]) if len(size) > 1 else 0.12
                door_h = float(size[2]) if len(size) > 2 else 2.10
                body = ET.SubElement(worldbody, "body", {
                    "name": obj_id,
                    "pos": f"{pos[0]} {pos[1]} 0.0"
                })
                # Left post
                ET.SubElement(body, "geom", {
                    "name": f"{obj_id}_post_left",
                    "type": "box",
                    "pos": f"{-door_w / 2.0:.3f} 0 {door_h / 2.0:.3f}",
                    "size": f"0.05 {door_d / 2.0:.3f} {door_h / 2.0:.3f}",
                    "rgba": rgba_str,
                    "friction": friction_str
                })
                # Right post
                ET.SubElement(body, "geom", {
                    "name": f"{obj_id}_post_right",
                    "type": "box",
                    "pos": f"{door_w / 2.0:.3f} 0 {door_h / 2.0:.3f}",
                    "size": f"0.05 {door_d / 2.0:.3f} {door_h / 2.0:.3f}",
                    "rgba": rgba_str,
                    "friction": friction_str
                })
                # Top lintel
                ET.SubElement(body, "geom", {
                    "name": f"{obj_id}_lintel",
                    "type": "box",
                    "pos": f"0 0 {door_h - 0.05:.3f}",
                    "size": f"{door_w / 2.0 + 0.05:.3f} {door_d / 2.0:.3f} 0.05",
                    "rgba": rgba_str,
                    "friction": friction_str
                })
            elif geom_type == "plane":
                # Static floor plane
                ET.SubElement(worldbody, "geom", {
                    "name": obj_id,
                    "type": "plane",
                    "pos": f"{pos[0]} {pos[1]} {pos[2]}",
                    "size": f"{size[0]} {size[1]} {size[2]}",
                    "material": "grid_mat",
                    "friction": friction_str,
                    "contype": "1",
                    "conaffinity": "1"
                })
            elif movable:
                # Movable physics object with freejoint
                valid_types = {"plane", "sphere", "capsule", "ellipsoid", "cylinder", "box", "mesh"}
                safe_geom_type = geom_type if geom_type in valid_types else "box"
                body = ET.SubElement(worldbody, "body", {
                    "name": obj_id,
                    "pos": f"{pos[0]} {pos[1]} {pos[2]}"
                })
                ET.SubElement(body, "freejoint", {"name": f"{obj_id}_freejoint"})
                geom_attrs = {
                    "name": f"{obj_id}_geom",
                    "type": safe_geom_type,
                    "size": " ".join(str(s) for s in size),
                    "rgba": rgba_str,
                    "mass": str(obj.get("mass", 0.25)),
                    "friction": friction_str,
                    "contype": "1",
                    "conaffinity": "1"
                }
                ET.SubElement(body, "geom", geom_attrs)
                ET.SubElement(body, "site", {
                    "name": f"{obj_id}_site",
                    "pos": "0 0 0",
                    "size": "0.015",
                    "rgba": "1 1 0 1"
                })
            else:
                # Static furniture / obstacles
                valid_types = {"plane", "sphere", "capsule", "ellipsoid", "cylinder", "box", "mesh"}
                safe_geom_type = geom_type if geom_type in valid_types else "box"
                body = ET.SubElement(worldbody, "body", {
                    "name": obj_id,
                    "pos": f"{pos[0]} {pos[1]} {pos[2]}"
                })
                ET.SubElement(body, "geom", {
                    "name": f"{obj_id}_geom",
                    "type": safe_geom_type,
                    "size": " ".join(str(s) for s in size),
                    "rgba": rgba_str,
                    "friction": friction_str,
                    "contype": "1",
                    "conaffinity": "1"
                })
                if obj.get("surface_height"):
                    surf_z = obj.get("size")[2] if len(obj.get("size")) > 2 else 0.1
                    ET.SubElement(body, "site", {
                        "name": f"{obj_id}_surface_site",
                        "pos": f"0 0 {surf_z}",
                        "size": "0.02",
                        "rgba": "0 1 0 0.5"
                    })

        xml_string = ET.tostring(root, encoding="utf-8").decode("utf-8")

        if output_path:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, "w") as f:
                f.write(xml_string)

        return xml_string
