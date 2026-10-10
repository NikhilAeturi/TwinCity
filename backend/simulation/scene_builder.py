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

        # Inject objects into worldbody
        for obj in scene_config.get("objects", []):
            obj_id = obj.get("id")
            geom_type = obj.get("geometry", "box")
            pos = obj.get("position", [0, 0, 0])
            pos_str = f"{pos[0]} {pos[1]} {pos[2]}"
            size = obj.get("size", [0.1, 0.1, 0.1])
            size_str = " ".join(str(s) for s in size)
            movable = obj.get("movable", False)
            color = obj.get("color", [0.7, 0.7, 0.7, 1.0])
            rgba_str = " ".join(str(c) for c in color)
            friction = obj.get("friction", [1.0, 0.05, 0.001])
            friction_str = " ".join(str(f) for f in friction)

            if geom_type == "plane":
                # Static floor plane
                ET.SubElement(worldbody, "geom", {
                    "name": obj_id,
                    "type": "plane",
                    "pos": pos_str,
                    "size": f"{size[0]} {size[1]} {size[2]}",
                    "material": "grid_mat",
                    "friction": friction_str,
                    "contype": "1",
                    "conaffinity": "1"
                })
            elif movable:
                # Movable physics object with freejoint
                body = ET.SubElement(worldbody, "body", {
                    "name": obj_id,
                    "pos": pos_str
                })
                ET.SubElement(body, "freejoint", {"name": f"{obj_id}_freejoint"})
                geom_attrs = {
                    "name": f"{obj_id}_geom",
                    "type": geom_type,
                    "size": size_str,
                    "rgba": rgba_str,
                    "mass": str(obj.get("mass", 0.25)),
                    "friction": friction_str,
                    "contype": "1",
                    "conaffinity": "1"
                }
                ET.SubElement(body, "geom", geom_attrs)
                # Tracking site for object center
                ET.SubElement(body, "site", {
                    "name": f"{obj_id}_site",
                    "pos": "0 0 0",
                    "size": "0.015",
                    "rgba": "1 1 0 1"
                })
            else:
                # Static furniture / obstacles
                body = ET.SubElement(worldbody, "body", {
                    "name": obj_id,
                    "pos": pos_str
                })
                ET.SubElement(body, "geom", {
                    "name": f"{obj_id}_geom",
                    "type": geom_type,
                    "size": size_str,
                    "rgba": rgba_str,
                    "friction": friction_str,
                    "contype": "1",
                    "conaffinity": "1"
                })
                # Add surface site for target placement if it's a table or shelf
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
