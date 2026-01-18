import cv2
import numpy as np
import math
from typing import Optional, Tuple, List
from dataclasses import dataclass

@dataclass
class EllipseData:
    center_x: int
    center_y: int
    axis_major: int
    axis_minor: int
    angle: float

@dataclass
class CalibrationResult:
    success: bool
    center_x: Optional[int] = None
    center_y: Optional[int] = None
    radius: Optional[int] = None
    rotation_offset: Optional[float] = None
    confidence: float = 0.0
    method: str = ""
    message: str = ""
    ellipse: Optional[EllipseData] = None
    is_angled: bool = False

DARTBOARD_SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

class AdvancedDartboardCalibration:
    def __init__(self):
        pass

    def find_concentric_circles(self, image: np.ndarray) -> List[Tuple[int, int, int]]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 1.5)
        height, width = gray.shape

        min_r = int(min(width, height) * 0.02)
        max_r = int(min(width, height) * 0.48)

        all_circles = []

        param_sets = [
            (1.2, 50, 30),
            (1.5, 40, 25),
            (1.0, 60, 35),
            (2.0, 30, 20),
        ]

        for dp, p1, p2 in param_sets:
            circles = cv2.HoughCircles(
                blurred,
                cv2.HOUGH_GRADIENT,
                dp=dp,
                minDist=min_r,
                param1=p1,
                param2=p2,
                minRadius=min_r,
                maxRadius=max_r
            )

            if circles is not None:
                for c in circles[0]:
                    all_circles.append((int(c[0]), int(c[1]), int(c[2])))

        return all_circles

    def find_center_by_concentric_circles(self, circles: List[Tuple[int, int, int]],
                                          image_width: int, image_height: int) -> Optional[Tuple[int, int, int, float]]:
        if len(circles) < 2:
            return None

        center_votes = {}
        grid_size = 20

        for cx, cy, r in circles:
            grid_x = cx // grid_size
            grid_y = cy // grid_size
            key = (grid_x, grid_y)

            if key not in center_votes:
                center_votes[key] = []
            center_votes[key].append((cx, cy, r))

        best_key = None
        best_count = 0

        for key, items in center_votes.items():
            if len(items) > best_count:
                best_count = len(items)
                best_key = key

        if best_key is None or best_count < 2:
            return None

        circles_at_center = center_votes[best_key]

        avg_cx = int(np.mean([c[0] for c in circles_at_center]))
        avg_cy = int(np.mean([c[1] for c in circles_at_center]))

        radii = sorted([c[2] for c in circles_at_center])
        outer_radius = radii[-1]

        confidence = min(0.95, 0.5 + best_count * 0.1)

        return (avg_cx, avg_cy, outer_radius, confidence)

    def find_center_by_edge_density(self, image: np.ndarray) -> Optional[Tuple[int, int, int, float]]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        height, width = gray.shape

        edges = cv2.Canny(gray, 50, 150)

        kernel = np.ones((3, 3), np.uint8)
        edges = cv2.dilate(edges, kernel, iterations=1)

        grid_size = 30
        best_score = 0
        best_pos = None

        for y in range(grid_size, height - grid_size, grid_size // 2):
            for x in range(grid_size, width - grid_size, grid_size // 2):
                score = 0

                for radius in range(20, min(width, height) // 2, 15):
                    ring_mask = np.zeros((height, width), dtype=np.uint8)
                    cv2.circle(ring_mask, (x, y), radius + 3, 255, 6)

                    ring_edges = cv2.bitwise_and(edges, ring_mask)
                    edge_count = np.count_nonzero(ring_edges)

                    circumference = 2 * math.pi * radius
                    if circumference > 0:
                        density = edge_count / circumference
                        if density > 0.1:
                            score += density

                if score > best_score:
                    best_score = score
                    best_pos = (x, y)

        if best_pos is None:
            return None

        cx, cy = best_pos

        max_radius = 0
        for radius in range(min(width, height) // 2, 20, -5):
            ring_mask = np.zeros((height, width), dtype=np.uint8)
            cv2.circle(ring_mask, (cx, cy), radius, 255, 8)

            ring_edges = cv2.bitwise_and(edges, ring_mask)
            edge_count = np.count_nonzero(ring_edges)

            circumference = 2 * math.pi * radius
            density = edge_count / circumference if circumference > 0 else 0

            if density > 0.15:
                max_radius = radius
                break

        if max_radius == 0:
            max_radius = min(width, height) // 3

        confidence = min(0.85, best_score / 50)

        return (cx, cy, max_radius, confidence)

    def find_center_by_radial_symmetry(self, image: np.ndarray) -> Optional[Tuple[int, int, int, float]]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        height, width = gray.shape

        blurred = cv2.GaussianBlur(gray, (5, 5), 1)
        grad_x = cv2.Sobel(blurred, cv2.CV_64F, 1, 0, ksize=3)
        grad_y = cv2.Sobel(blurred, cv2.CV_64F, 0, 1, ksize=3)

        magnitude = np.sqrt(grad_x**2 + grad_y**2)
        threshold = np.percentile(magnitude, 80)

        vote_map = np.zeros((height, width), dtype=np.float32)

        step = 3
        for y in range(0, height, step):
            for x in range(0, width, step):
                if magnitude[y, x] < threshold:
                    continue

                gx = grad_x[y, x]
                gy = grad_y[y, x]
                mag = math.sqrt(gx*gx + gy*gy)

                if mag < 1:
                    continue

                gx /= mag
                gy /= mag

                for dist in range(10, min(width, height) // 2, 5):
                    vote_x = int(x - gx * dist)
                    vote_y = int(y - gy * dist)

                    if 0 <= vote_x < width and 0 <= vote_y < height:
                        vote_map[vote_y, vote_x] += 1

                    vote_x2 = int(x + gx * dist)
                    vote_y2 = int(y + gy * dist)

                    if 0 <= vote_x2 < width and 0 <= vote_y2 < height:
                        vote_map[vote_y2, vote_x2] += 1

        vote_map = cv2.GaussianBlur(vote_map, (21, 21), 5)

        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(vote_map)
        cx, cy = max_loc

        edges = cv2.Canny(gray, 50, 150)
        max_radius = 0

        for radius in range(min(width, height) // 2, 30, -5):
            ring_mask = np.zeros((height, width), dtype=np.uint8)
            cv2.circle(ring_mask, (cx, cy), radius, 255, 6)

            ring_edges = cv2.bitwise_and(edges, ring_mask)
            edge_count = np.count_nonzero(ring_edges)
            circumference = 2 * math.pi * radius

            if circumference > 0 and edge_count / circumference > 0.12:
                max_radius = radius
                break

        if max_radius == 0:
            max_radius = min(width, height) // 3

        confidence = min(0.9, max_val / 1000)

        return (cx, cy, max_radius, confidence)

    def refine_center_with_symmetry(self, image: np.ndarray,
                                    initial_center: Tuple[int, int],
                                    radius: int) -> Tuple[int, int]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        height, width = gray.shape
        cx, cy = initial_center

        search_range = max(10, radius // 10)
        best_symmetry = 0
        best_center = (cx, cy)

        for dy in range(-search_range, search_range + 1, 2):
            for dx in range(-search_range, search_range + 1, 2):
                test_cx = cx + dx
                test_cy = cy + dy

                if not (radius < test_cx < width - radius and radius < test_cy < height - radius):
                    continue

                symmetry_score = 0
                num_samples = 36

                for i in range(num_samples):
                    angle = 2 * math.pi * i / num_samples
                    sample_radius = radius * 0.7

                    x1 = int(test_cx + sample_radius * math.cos(angle))
                    y1 = int(test_cy + sample_radius * math.sin(angle))
                    x2 = int(test_cx - sample_radius * math.cos(angle))
                    y2 = int(test_cy - sample_radius * math.sin(angle))

                    if (0 <= x1 < width and 0 <= y1 < height and
                        0 <= x2 < width and 0 <= y2 < height):
                        diff = abs(int(gray[y1, x1]) - int(gray[y2, x2]))
                        symmetry_score += 255 - diff

                if symmetry_score > best_symmetry:
                    best_symmetry = symmetry_score
                    best_center = (test_cx, test_cy)

        return best_center

    def find_outer_edge(self, image: np.ndarray, center: Tuple[int, int],
                        initial_radius: int) -> int:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        height, width = gray.shape
        cx, cy = center

        edges = cv2.Canny(gray, 30, 100)

        radii_scores = []
        min_r = int(initial_radius * 0.6)
        max_r = int(min(initial_radius * 1.4, min(cx, cy, width - cx, height - cy) - 5))

        for r in range(min_r, max_r, 2):
            score = 0
            num_points = max(36, int(2 * math.pi * r / 10))

            for i in range(num_points):
                angle = 2 * math.pi * i / num_points
                px = int(cx + r * math.cos(angle))
                py = int(cy + r * math.sin(angle))

                if 0 <= px < width and 0 <= py < height:
                    if edges[py, px] > 0:
                        score += 1

            radii_scores.append((r, score))

        if not radii_scores:
            return initial_radius

        radii_scores.sort(key=lambda x: x[1], reverse=True)
        top_radii = radii_scores[:5]

        double_ring_expected = initial_radius * 0.95
        best_radius = initial_radius

        for r, score in top_radii:
            if abs(r - double_ring_expected) < initial_radius * 0.15:
                best_radius = r
                break

        if best_radius == initial_radius and top_radii:
            best_radius = top_radii[0][0]

        return best_radius

    def detect_20_segment(self, image: np.ndarray, center: Tuple[int, int],
                          radius: int) -> float:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        height, width = gray.shape
        cx, cy = center

        edges = cv2.Canny(gray, 50, 150)

        best_offset = -9.0
        best_score = 0

        for offset in range(-18, 18, 1):
            score = 0

            for seg in range(20):
                angle = math.radians(seg * 18 + 9 + offset)

                for r_ratio in [0.4, 0.5, 0.6, 0.7, 0.8]:
                    r = int(radius * r_ratio)
                    px = int(cx + r * math.sin(angle))
                    py = int(cy - r * math.cos(angle))

                    if 0 <= px < width and 0 <= py < height:
                        if edges[py, px] > 0:
                            score += 1

            if score > best_score:
                best_score = score
                best_offset = offset

        return float(best_offset)

    def validate_dartboard(self, image: np.ndarray, center: Tuple[int, int],
                           radius: int) -> Tuple[bool, float]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        height, width = gray.shape
        cx, cy = center

        edges = cv2.Canny(gray, 50, 150)

        ring_scores = []
        ring_ratios = [0.03, 0.08, 0.58, 0.63, 0.95, 1.0]

        for ratio in ring_ratios:
            r = int(radius * ratio)
            if r < 5:
                continue

            score = 0
            num_points = max(20, int(2 * math.pi * r / 8))

            for i in range(num_points):
                angle = 2 * math.pi * i / num_points
                px = int(cx + r * math.cos(angle))
                py = int(cy + r * math.sin(angle))

                if 0 <= px < width and 0 <= py < height:
                    if edges[py, px] > 0:
                        score += 1

            ring_scores.append(score / num_points if num_points > 0 else 0)

        radial_score = 0
        for seg in range(20):
            angle = math.radians(seg * 18)

            edge_count = 0
            for r_ratio in np.linspace(0.1, 0.9, 20):
                r = int(radius * r_ratio)
                px = int(cx + r * math.sin(angle))
                py = int(cy - r * math.cos(angle))

                if 0 <= px < width and 0 <= py < height:
                    if edges[py, px] > 0:
                        edge_count += 1

            if edge_count >= 3:
                radial_score += 1

        ring_confidence = np.mean(ring_scores) if ring_scores else 0
        radial_confidence = radial_score / 20

        total_confidence = ring_confidence * 0.6 + radial_confidence * 0.4
        is_valid = total_confidence > 0.1 and (ring_confidence > 0.05 or radial_confidence > 0.3)

        return is_valid, min(0.95, total_confidence * 2)

    def calibrate_multi_method(self, image: np.ndarray) -> CalibrationResult:
        height, width = image.shape[:2]

        results = []

        circles = self.find_concentric_circles(image)
        if circles:
            concentric_result = self.find_center_by_concentric_circles(circles, width, height)
            if concentric_result:
                results.append(("concentric", concentric_result))

        radial_result = self.find_center_by_radial_symmetry(image)
        if radial_result:
            results.append(("radial", radial_result))

        edge_result = self.find_center_by_edge_density(image)
        if edge_result:
            results.append(("edge", edge_result))

        if not results:
            return CalibrationResult(
                success=False,
                confidence=0.0,
                method="Failed",
                message="Nem talaltam darttablat. Ellenorizd a kamera poziciot es megvilagitast."
            )

        best_result = None
        best_validation_score = 0
        best_method = ""

        for method_name, (cx, cy, radius, conf) in results:
            refined_center = self.refine_center_with_symmetry(image, (cx, cy), radius)
            refined_radius = self.find_outer_edge(image, refined_center, radius)

            is_valid, validation_score = self.validate_dartboard(image, refined_center, refined_radius)

            total_score = conf * 0.4 + validation_score * 0.6

            if total_score > best_validation_score:
                best_validation_score = total_score
                best_result = (refined_center[0], refined_center[1], refined_radius, total_score)
                best_method = method_name

        if best_result is None:
            return CalibrationResult(
                success=False,
                confidence=0.0,
                method="Failed",
                message="Nem sikerult validalni a tablat. Probald mas szogbol."
            )

        cx, cy, radius, confidence = best_result

        rotation_offset = self.detect_20_segment(image, (cx, cy), radius)

        is_valid, final_conf = self.validate_dartboard(image, (cx, cy), radius)

        if not is_valid:
            return CalibrationResult(
                success=False,
                center_x=cx,
                center_y=cy,
                radius=radius,
                confidence=final_conf,
                method=best_method,
                message=f"Tabla talalva de nem biztos ({final_conf*100:.0f}%). Allitsd be a kamerat."
            )

        return CalibrationResult(
            success=True,
            center_x=cx,
            center_y=cy,
            radius=radius,
            rotation_offset=rotation_offset,
            confidence=final_conf,
            method=best_method,
            message=f"Tabla kalibrálva! ({final_conf*100:.0f}%) - Mehet a dobas!",
            ellipse=None,
            is_angled=False
        )
