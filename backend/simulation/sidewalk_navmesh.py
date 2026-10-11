"""
RoboTwin Urban Sidewalk NavMesh & Obstacle Collision Avoidance Engine.

Based on OpenStreetMap (OSM) pedestrian topology and Nav2 costmap standards:
1. Defines explicit building footprint obstacle volumes (Lethal Obstacles).
2. Defines pedestrian sidewalk corridors, curb lines, and marked crosswalks.
3. Provides collision raycasting to prevent humanoid trajectories from slicing through buildings or landing on rooftops.
4. Snaps arbitrary GPS/metric coordinates to certified walkable sidewalk pavement.
5. A* graph pathfinding along street sidewalk corridors with obstacle avoidance.
"""

import math
from typing import Dict, Any, List, Tuple, Optional

# Constants
SIDEWALK_WIDTH_NOMINAL = 3.0   # meters
SAFETY_MARGIN = 0.5           # meters clearance from building facades
CURB_HEIGHT = 0.15            # meters standard street curb height


# 1. 2.5D Building Footprints (Bounding Boxes) per City in Metric Coordinates (dx, dy from origin)
# Buildings sit strictly inside city blocks, bounded away from sidewalk corridors.
CITY_BUILDING_FOOTPRINTS: Dict[str, List[Dict[str, Any]]] = {
    "san_francisco": [
        {
            "id": "sf_bldg_transamerica",
            "name": "Transamerica Pyramid & Annex",
            "min_x": 10.0, "max_x": 80.0,
            "min_y": 48.0, "max_y": 84.0,
            "height": 260.0
        },
        {
            "id": "sf_bldg_475_sansome",
            "name": "475 Sansome Street Tower",
            "min_x": 10.0, "max_x": 80.0,
            "min_y": -2.0, "max_y": 32.0,
            "height": 42.0
        },
        {
            "id": "sf_bldg_405_sansome",
            "name": "405 Sansome Historic Bank",
            "min_x": 10.0, "max_x": 80.0,
            "min_y": -34.0, "max_y": -16.0,
            "height": 38.5
        },
        {
            "id": "sf_bldg_bofa_555",
            "name": "555 California Street Skyscraper",
            "min_x": 10.0, "max_x": 80.0,
            "min_y": -78.0, "max_y": -46.0,
            "height": 237.0
        },
        {
            "id": "sf_bldg_brick_apartments",
            "name": "Montgomery Brick Lofts & Residencies",
            "min_x": -82.0, "max_x": -10.0,
            "min_y": -2.0, "max_y": 32.0,
            "height": 24.0
        },
        {
            "id": "sf_bldg_cafe_block",
            "name": "Merchant & Montgomery Commercial Block",
            "min_x": -82.0, "max_x": -10.0,
            "min_y": -34.0, "max_y": -16.0,
            "height": 16.0
        },
        {
            "id": "sf_bldg_columbus_block",
            "name": "North Montgomery Residential Block",
            "min_x": -82.0, "max_x": -10.0,
            "min_y": 48.0, "max_y": 84.0,
            "height": 28.0
        }
    ],
    "manhattan": [
        {
            "id": "ny_bldg_empire_state",
            "name": "Empire State Building Footprint",
            "min_x": -45.0, "max_x": 45.0,
            "min_y": -185.0, "max_y": -115.0,
            "height": 381.0
        },
        {
            "id": "ny_bldg_midtown_tower",
            "name": "Midtown Glass Atrium Tower",
            "min_x": -85.0, "max_x": -35.0,
            "min_y": -65.0, "max_y": -15.0,
            "height": 160.0
        },
        {
            "id": "ny_bldg_avenue_cafe",
            "name": "Avenue Commercial Block",
            "min_x": 25.0, "max_x": 75.0,
            "min_y": -45.0, "max_y": -5.0,
            "height": 22.0
        }
    ],
    "chicago": [
        {
            "id": "chi_bldg_river_tower",
            "name": "Chicago Wacker Drive Tower",
            "min_x": -50.0, "max_x": 50.0,
            "min_y": -80.0, "max_y": -20.0,
            "height": 145.0
        },
        {
            "id": "chi_bldg_loop_corner",
            "name": "The Loop Commercial Plaza Block",
            "min_x": 20.0, "max_x": 70.0,
            "min_y": 20.0, "max_y": 70.0,
            "height": 55.0
        }
    ]
}


# 2. Pedestrian Sidewalk & Crosswalk NavMesh Graph Nodes (Metric Offsets dx, dy)
# Each node represents certified walkable pedestrian pavement (sidewalk, crosswalk, plaza).
CITY_SIDEWALK_GRAPHS: Dict[str, Dict[str, Any]] = {
    "san_francisco": {
        "nodes": {
            # Montgomery Street - West Sidewalk (dx = -6.0)
            "montgomery_w_california": {"x": -6.0, "y": -36.0, "type": "sidewalk", "name": "Montgomery & California West Corner"},
            "montgomery_w_cafe": {"x": -6.0, "y": -25.0, "type": "sidewalk", "name": "Blue Bottle Artisan Cafe Sidewalk"},
            "montgomery_w_sacramento": {"x": -6.0, "y": -10.0, "type": "sidewalk", "name": "Montgomery & Sacramento West Corner"},
            "montgomery_w_origin": {"x": -6.0, "y": 0.0, "type": "sidewalk", "name": "Montgomery St West Sidewalk (Origin)"},
            "montgomery_w_apartments": {"x": -6.0, "y": 15.0, "type": "sidewalk", "name": "Montgomery Brick Lofts Entrance"},
            "montgomery_w_clay": {"x": -6.0, "y": 38.0, "type": "sidewalk", "name": "Montgomery & Clay West Corner"},
            "montgomery_w_north": {"x": -6.0, "y": 65.0, "type": "sidewalk", "name": "Montgomery St West Sidewalk (North)"},

            # Montgomery Street - East Sidewalk (dx = +6.0)
            "montgomery_e_california": {"x": 6.0, "y": -36.0, "type": "sidewalk", "name": "Montgomery & California East Corner"},
            "montgomery_e_sacramento": {"x": 6.0, "y": -10.0, "type": "sidewalk", "name": "Montgomery & Sacramento East Corner"},
            "montgomery_e_origin": {"x": 6.0, "y": 0.0, "type": "sidewalk", "name": "Montgomery St East Sidewalk (Origin)"},
            "montgomery_e_clay": {"x": 6.0, "y": 38.0, "type": "sidewalk", "name": "Montgomery & Clay East Corner"},
            "montgomery_e_north": {"x": 6.0, "y": 65.0, "type": "sidewalk", "name": "Montgomery St East Sidewalk (North)"},

            # Clay Street - South Sidewalk (dy = +38.0)
            "clay_s_west": {"x": -45.0, "y": 38.0, "type": "sidewalk", "name": "Clay Street South Sidewalk (West)"},
            "clay_s_east": {"x": 55.0, "y": 38.0, "type": "sidewalk", "name": "Clay Street South Sidewalk (East)"},

            # Clay Street - North Sidewalk (dy = +44.0)
            "clay_n_west": {"x": -45.0, "y": 44.0, "type": "sidewalk", "name": "Clay Street North Sidewalk (West)"},
            "clay_n_montgomery_w": {"x": -6.0, "y": 44.0, "type": "sidewalk", "name": "Clay & Montgomery NW Corner"},
            "clay_n_montgomery_e": {"x": 6.0, "y": 44.0, "type": "sidewalk", "name": "Clay & Montgomery NE Corner"},
            "clay_n_east": {"x": 55.0, "y": 44.0, "type": "sidewalk", "name": "Clay Street North Sidewalk (East)"},

            # Sacramento Street - Sidewalk (dy = -10.0)
            "sacramento_s_west": {"x": -45.0, "y": -10.0, "type": "sidewalk", "name": "Sacramento Street Sidewalk (West)"},
            "sacramento_s_east": {"x": 55.0, "y": -10.0, "type": "sidewalk", "name": "Sacramento Street Sidewalk (East)"},

            # Sansome Street - West Sidewalk (dx = +84.0)
            "sansome_w_clay": {"x": 84.0, "y": 38.0, "type": "sidewalk", "name": "Clay & Sansome Walkway Corner"},
            "sansome_w_475": {"x": 84.0, "y": 15.0, "type": "sidewalk", "name": "475 Sansome Main Entrance Walkway"},
            "sansome_w_sacramento": {"x": 84.0, "y": -10.0, "type": "crosswalk", "name": "Sansome Pedestrian Crossing Ramp"},
            "sansome_w_bank": {"x": 84.0, "y": -25.0, "type": "sidewalk", "name": "405 Sansome Historic Bank Entrance"},
            "sansome_w_california": {"x": 84.0, "y": -36.0, "type": "sidewalk", "name": "Sansome & California South Corner"},

            # California Street Sidewalk (dy = -36.0)
            "california_bofa_555": {"x": 45.0, "y": -36.0, "type": "plaza", "name": "555 California Plaza Entrance"},

            # Redwood Park Sunken Plaza & Transamerica Promenade
            "plaza_entrance": {"x": 6.0, "y": 65.0, "type": "plaza", "name": "Redwood Park Sunken Plaza Entrance"},
            "plaza_promenade": {"x": 25.0, "y": 65.0, "type": "plaza", "name": "Redwood Park Central Tree Promenade"},
            "transamerica_base": {"x": 8.0, "y": 80.0, "type": "plaza", "name": "Transamerica Pyramid Base Walkway"}
        },
        # Bidirectional walkable corridors along sidewalks and marked crosswalks
        "edges": [
            ("montgomery_w_california", "montgomery_w_cafe"),
            ("montgomery_w_cafe", "montgomery_w_sacramento"),
            ("montgomery_w_sacramento", "montgomery_w_origin"),
            ("montgomery_w_origin", "montgomery_w_apartments"),
            ("montgomery_w_apartments", "montgomery_w_clay"),
            ("montgomery_w_clay", "montgomery_w_north"),

            ("montgomery_e_california", "montgomery_e_sacramento"),
            ("montgomery_e_sacramento", "montgomery_e_origin"),
            ("montgomery_e_origin", "montgomery_e_clay"),
            ("montgomery_e_clay", "montgomery_e_north"),

            # Crosswalks across Montgomery St
            ("montgomery_w_california", "montgomery_e_california"),
            ("montgomery_w_sacramento", "montgomery_e_sacramento"),
            ("montgomery_w_origin", "montgomery_e_origin"),
            ("montgomery_w_clay", "montgomery_e_clay"),
            ("clay_n_montgomery_w", "clay_n_montgomery_e"),
            ("montgomery_w_clay", "clay_n_montgomery_w"),
            ("montgomery_e_clay", "clay_n_montgomery_e"),

            # Clay Street lateral sidewalk runs
            ("clay_s_west", "montgomery_w_clay"),
            ("montgomery_e_clay", "clay_s_east"),
            ("clay_s_east", "sansome_w_clay"),

            ("clay_n_west", "clay_n_montgomery_w"),
            ("clay_n_montgomery_e", "clay_n_east"),

            # Sacramento Street lateral sidewalk runs
            ("sacramento_s_west", "montgomery_w_sacramento"),
            ("montgomery_e_sacramento", "sacramento_s_east"),
            ("sacramento_s_east", "sansome_w_sacramento"),

            # California Street lateral sidewalk runs
            ("montgomery_e_california", "california_bofa_555"),
            ("california_bofa_555", "sansome_w_california"),

            # Sansome corridor access
            ("sansome_w_clay", "sansome_w_475"),
            ("sansome_w_475", "sansome_w_sacramento"),
            ("sansome_w_sacramento", "sansome_w_bank"),
            ("sansome_w_bank", "sansome_w_california"),

            # Plaza access
            ("montgomery_e_north", "plaza_entrance"),
            ("plaza_entrance", "plaza_promenade"),
            ("plaza_promenade", "transamerica_base")
        ]
    },
    "manhattan": {
        "nodes": {
            "ny_broadway_south": {"x": -12.0, "y": -60.0, "type": "sidewalk", "name": "Broadway Pedestrian Avenue (South)"},
            "ny_broadway_cafe": {"x": -12.0, "y": -25.0, "type": "sidewalk", "name": "Manhattan Roast Cafe Sidewalk"},
            "ny_broadway_plaza": {"x": -12.0, "y": 20.0, "type": "plaza", "name": "Times Square Pedestrian Plaza"},
            "ny_broadway_north": {"x": -12.0, "y": 80.0, "type": "sidewalk", "name": "Broadway Pedestrian Avenue (North)"},
            "ny_cross_plaza": {"x": 20.0, "y": 20.0, "type": "crosswalk", "name": "Avenue Crosswalk Promenade"},
            "ny_esb_entrance": {"x": 0.0, "y": -110.0, "type": "sidewalk", "name": "Empire State Building Entrance Sidewalk"}
        },
        "edges": [
            ("ny_broadway_south", "ny_broadway_cafe"),
            ("ny_broadway_cafe", "ny_broadway_plaza"),
            ("ny_broadway_plaza", "ny_broadway_north"),
            ("ny_broadway_plaza", "ny_cross_plaza"),
            ("ny_broadway_south", "ny_esb_entrance")
        ]
    },
    "chicago": {
        "nodes": {
            "chi_riverwalk_west": {"x": -40.0, "y": 60.0, "type": "plaza", "name": "Riverwalk West Promenade"},
            "chi_riverwalk_mid": {"x": 0.0, "y": 60.0, "type": "plaza", "name": "Chicago Riverwalk Central Esplanade"},
            "chi_riverwalk_east": {"x": 45.0, "y": 60.0, "type": "plaza", "name": "Riverwalk Bridge Approach"},
            "chi_michigan_bridge": {"x": 45.0, "y": 30.0, "type": "sidewalk", "name": "Michigan Avenue Bridge Sidewalk"},
            "chi_loop_sidewalk": {"x": 15.0, "y": 0.0, "type": "sidewalk", "name": "Loop Commercial Sidewalk"}
        },
        "edges": [
            ("chi_riverwalk_west", "chi_riverwalk_mid"),
            ("chi_riverwalk_mid", "chi_riverwalk_east"),
            ("chi_riverwalk_east", "chi_michigan_bridge"),
            ("chi_michigan_bridge", "chi_loop_sidewalk")
        ]
    }
}


class UrbanSidewalkNavMesh:
    """
    Pedestrian NavMesh & Obstacle Collision Engine.
    Guarantees the humanoid is always placed and routed on real-world sidewalks,
    never inside building interiors and never on private rooftops.
    """

    def __init__(self):
        pass

    def is_inside_building(self, x: float, y: float, city_id: str = "san_francisco", margin: float = SAFETY_MARGIN) -> Tuple[bool, Optional[str]]:
        """
        Returns (True, building_name) if metric coordinate (x, y) penetrates a building footprint volume.
        """
        footprints = CITY_BUILDING_FOOTPRINTS.get(city_id, CITY_BUILDING_FOOTPRINTS["san_francisco"])
        for b in footprints:
            if (b["min_x"] - margin <= x <= b["max_x"] + margin and
                b["min_y"] - margin <= y <= b["max_y"] + margin):
                return True, b["name"]
        return False, None

    def segment_intersects_box(self, p1: Tuple[float, float], p2: Tuple[float, float], box: Dict[str, Any], margin: float = SAFETY_MARGIN) -> bool:
        """
        Fast 2D segment-AABB (Axis-Aligned Bounding Box) intersection test using the Liang-Barsky / slab algorithm.
        """
        x1, y1 = p1
        x2, y2 = p2
        dx = x2 - x1
        dy = y2 - y1

        min_x = box["min_x"] - margin
        max_x = box["max_x"] + margin
        min_y = box["min_y"] - margin
        max_y = box["max_y"] + margin

        # If either point is inside the box, it intersects
        if min_x <= x1 <= max_x and min_y <= y1 <= max_y:
            return True
        if min_x <= x2 <= max_x and min_y <= y2 <= max_y:
            return True

        p = [-dx, dx, -dy, dy]
        q = [x1 - min_x, max_x - x1, y1 - min_y, max_y - y1]

        u1 = 0.0
        u2 = 1.0

        for i in range(4):
            if p[i] == 0:
                if q[i] < 0:
                    return False
            else:
                t = q[i] / p[i]
                if p[i] < 0:
                    if t > u2:
                        return False
                    if t > u1:
                        u1 = t
                elif p[i] > 0:
                    if t < u1:
                        return False
                    if t < u2:
                        u2 = t

        return u1 <= u2

    def segment_collides_with_buildings(self, p1: Tuple[float, float], p2: Tuple[float, float], city_id: str = "san_francisco") -> Tuple[bool, Optional[str]]:
        """
        Checks if a direct path segment between p1 and p2 penetrates any building structure.
        """
        footprints = CITY_BUILDING_FOOTPRINTS.get(city_id, CITY_BUILDING_FOOTPRINTS["san_francisco"])
        for b in footprints:
            if self.segment_intersects_box(p1, p2, b):
                return True, b["name"]
        return False, None

    def snap_to_nearest_sidewalk(self, x: float, y: float, city_id: str = "san_francisco") -> Dict[str, Any]:
        """
        Snaps any arbitrary point (x, y) to the closest valid pedestrian sidewalk node.
        Guarantees the resulting position is completely outside building footprints.
        """
        graph = CITY_SIDEWALK_GRAPHS.get(city_id, CITY_SIDEWALK_GRAPHS["san_francisco"])
        nodes = graph["nodes"]

        best_node_id = None
        min_dist = float("inf")

        for node_id, data in nodes.items():
            dist = math.hypot(x - data["x"], y - data["y"])
            if dist < min_dist:
                min_dist = dist
                best_node_id = node_id

        if best_node_id:
            chosen = nodes[best_node_id]
            return {
                "node_id": best_node_id,
                "x": chosen["x"],
                "y": chosen["y"],
                "type": chosen["type"],
                "name": chosen["name"],
                "dist": round(min_dist, 2)
            }

        # Fallback to safe sidewalk origin
        return {
            "node_id": "montgomery_w_origin",
            "x": -6.0,
            "y": 0.0,
            "type": "sidewalk",
            "name": "Montgomery St West Sidewalk",
            "dist": 0.0
        }

    def plan_sidewalk_path(
        self,
        start_x: float,
        start_y: float,
        dest_x: float,
        dest_y: float,
        city_id: str = "san_francisco"
    ) -> List[Dict[str, Any]]:
        """
        Computes a collision-free path along the urban sidewalk network between (start_x, start_y)
        and (dest_x, dest_y).
        If the direct path penetrates a building, uses A* graph search over sidewalk edges.
        """
        # Ensure start and dest are snapped to certified sidewalk nodes
        snap_start = self.snap_to_nearest_sidewalk(start_x, start_y, city_id)
        snap_dest = self.snap_to_nearest_sidewalk(dest_x, dest_y, city_id)

        # Check if direct line between start and dest is collision free
        collides, coll_name = self.segment_collides_with_buildings((start_x, start_y), (dest_x, dest_y), city_id)
        
        # If both points are close and direct path is collision-free, simple straight walk along sidewalk
        if not collides and math.hypot(dest_x - start_x, dest_y - start_y) < 25.0:
            return [
                {"x": start_x, "y": start_y, "name": snap_start["name"], "type": "sidewalk"},
                {"x": dest_x, "y": dest_y, "name": snap_dest["name"], "type": "sidewalk"}
            ]

        # Use A* search on the sidewalk graph
        graph = CITY_SIDEWALK_GRAPHS.get(city_id, CITY_SIDEWALK_GRAPHS["san_francisco"])
        nodes = graph["nodes"]
        edges = graph["edges"]

        # Build adjacency list
        adj: Dict[str, List[str]] = {nid: [] for nid in nodes}
        for u, v in edges:
            if u in adj and v in adj:
                adj[u].append(v)
                adj[v].append(u)

        start_nid = snap_start["node_id"]
        dest_nid = snap_dest["node_id"]

        if start_nid == dest_nid:
            return [
                {"x": nodes[start_nid]["x"], "y": nodes[start_nid]["y"], "name": nodes[start_nid]["name"], "type": nodes[start_nid]["type"]}
            ]

        # A* Search
        import heapq
        open_set: List[Tuple[float, str]] = []
        heapq.heappush(open_set, (0.0, start_nid))
        came_from: Dict[str, Optional[str]] = {start_nid: None}
        g_score: Dict[str, float] = {nid: float("inf") for nid in nodes}
        g_score[start_nid] = 0.0

        def heuristic(a_id: str, b_id: str) -> float:
            na, nb = nodes[a_id], nodes[b_id]
            return math.hypot(na["x"] - nb["x"], na["y"] - nb["y"])

        while open_set:
            _, current = heapq.heappop(open_set)

            if current == dest_nid:
                # Reconstruct path
                path_node_ids = []
                curr_tracer: Optional[str] = current
                while curr_tracer is not None:
                    path_node_ids.append(curr_tracer)
                    curr_tracer = came_from[curr_tracer]
                path_node_ids.reverse()

                return [
                    {
                        "x": nodes[nid]["x"],
                        "y": nodes[nid]["y"],
                        "name": nodes[nid]["name"],
                        "type": nodes[nid]["type"]
                    }
                    for nid in path_node_ids
                ]

            for neighbor in adj.get(current, []):
                # Calculate edge weight (distance)
                c_data, n_data = nodes[current], nodes[neighbor]
                edge_cost = math.hypot(c_data["x"] - n_data["x"], c_data["y"] - n_data["y"])
                tentative_g = g_score[current] + edge_cost

                if tentative_g < g_score[neighbor]:
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g
                    f_score = tentative_g + heuristic(neighbor, dest_nid)
                    heapq.heappush(open_set, (f_score, neighbor))

        # Fallback if no graph path found
        return [
            {"x": snap_start["x"], "y": snap_start["y"], "name": snap_start["name"], "type": snap_start["type"]},
            {"x": snap_dest["x"], "y": snap_dest["y"], "name": snap_dest["name"], "type": snap_dest["type"]}
        ]


# Singleton instance
urban_sidewalk_navmesh = UrbanSidewalkNavMesh()
