import cv2
import numpy as np
import math
from typing import List, Optional, Tuple, Dict
from dataclasses import dataclass
from collections import deque

@dataclass
class DartDetection:
    x: int
    y: int
    score: str
    confidence: float
    dart_id: Optional[int] = None

@dataclass
class DetectionResult:
    darts: List[DartDetection]
    total_confidence: float
    method: str
    message: str

DARTBOARD_SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

RADIUS_RATIOS = {
    "double_bull": 0.032,
    "single_bull": 0.080,
    "inner_triple": 0.582,
    "outer_triple": 0.629,
    "inner_double": 0.953,
    "outer_double": 1.0,
}

class AdvancedDartDetection:
    def __init__(self, calibration: Dict):
        self.calibration = calibration
        self.detection_history = deque(maxlen=10)
        self.next_dart_id = 0

    def preprocess_for_detection(self, image: np.ndarray) -> np.ndarray:
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        enhanced = cv2.merge([l, a, b])
        enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)

        denoised = cv2.fastNlMeansDenoisingColored(enhanced, None, 10, 10, 7, 21)
        return denoised

    def get_score_from_position(self, x: int, y: int) -> Tuple[str, float]:
        if self.calibration["center_x"] is None:
            return "UNCALIBRATED", 0.0

        cx = self.calibration["center_x"]
        cy = self.calibration["center_y"]
        r = self.calibration["radius"]

        dx = x - cx
        dy = cy - y
        distance = math.sqrt(dx * dx + dy * dy)
        distance_ratio = distance / r

        if distance_ratio > RADIUS_RATIOS["outer_double"] * 1.15:
            return "MISS", max(0.5, 0.95 - (distance_ratio - RADIUS_RATIOS["outer_double"]) * 2)

        angle = math.degrees(math.atan2(dx, dy))
        if angle < 0:
            angle += 360

        if distance_ratio <= RADIUS_RATIOS["double_bull"]:
            return "D-BULL", 0.98

        if distance_ratio <= RADIUS_RATIOS["single_bull"]:
            return "BULL", 0.96

        segment = self._get_segment_from_angle(angle)

        if RADIUS_RATIOS["inner_triple"] <= distance_ratio <= RADIUS_RATIOS["outer_triple"]:
            confidence = 0.92 - abs(distance_ratio - (RADIUS_RATIOS["inner_triple"] + RADIUS_RATIOS["outer_triple"]) / 2) * 2
            return f"T{segment}", max(0.8, confidence)

        if RADIUS_RATIOS["inner_double"] <= distance_ratio <= RADIUS_RATIOS["outer_double"]:
            confidence = 0.92 - abs(distance_ratio - (RADIUS_RATIOS["inner_double"] + RADIUS_RATIOS["outer_double"]) / 2) * 2
            return f"D{segment}", max(0.8, confidence)

        return f"{segment}", 0.88

    def _get_segment_from_angle(self, angle: float) -> int:
        adjusted_angle = (angle + self.calibration["rotation_offset"]) % 360
        segment_index = int(adjusted_angle / 18) % 20
        return DARTBOARD_SEGMENTS[segment_index]

    def detect_darts_difference(self, current_image: np.ndarray,
                               reference_image: np.ndarray) -> List[Tuple[int, int, float]]:
        curr_proc = self.preprocess_for_detection(current_image)
        ref_proc = self.preprocess_for_detection(reference_image)

        diff = cv2.absdiff(curr_proc, ref_proc)

        gray_diff = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)

        _, thresh = cv2.threshold(gray_diff, 25, 255, cv2.THRESH_BINARY)

        kernel = np.ones((3, 3), np.uint8)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=1)

        kernel_dilate = np.ones((5, 5), np.uint8)
        thresh = cv2.dilate(thresh, kernel_dilate, iterations=1)

        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        dart_candidates = []

        for contour in contours:
            area = cv2.contourArea(contour)

            if area < 80 or area > 8000:
                continue

            x, y, w, h = cv2.boundingRect(contour)
            aspect_ratio = max(w, h) / (min(w, h) + 1)

            if aspect_ratio > 5.0:
                continue

            perimeter = cv2.arcLength(contour, True)
            circularity = 4 * math.pi * area / (perimeter * perimeter) if perimeter > 0 else 0

            M = cv2.moments(contour)
            if M["m00"] == 0:
                continue

            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])

            if self.calibration["center_x"] is not None:
                board_cx = self.calibration["center_x"]
                board_cy = self.calibration["center_y"]
                board_r = self.calibration["radius"]

                dist_to_board = math.sqrt((cx - board_cx)**2 + (cy - board_cy)**2)

                if dist_to_board > board_r * 1.2:
                    continue

            points = contour.reshape(-1, 2)

            if self.calibration["center_x"] is not None:
                board_cx = self.calibration["center_x"]
                board_cy = self.calibration["center_y"]

                distances = np.sqrt((points[:, 0] - board_cx)**2 + (points[:, 1] - board_cy)**2)
                tip_idx = np.argmin(distances)
                tip_x, tip_y = points[tip_idx]
            else:
                tip_x, tip_y = cx, cy

            confidence = 0.5
            confidence += min(0.15, area / 1000)
            confidence += circularity * 0.2
            confidence += (1 / (aspect_ratio + 1)) * 0.15

            dart_candidates.append((int(tip_x), int(tip_y), min(0.95, confidence)))

        dart_candidates = self._filter_close_detections(dart_candidates)

        return dart_candidates

    def detect_darts_color(self, image: np.ndarray) -> List[Tuple[int, int, float]]:
        proc = self.preprocess_for_detection(image)

        hsv = cv2.cvtColor(proc, cv2.COLOR_BGR2HSV)
        gray = cv2.cvtColor(proc, cv2.COLOR_BGR2GRAY)

        lower_metal1 = np.array([0, 0, 160])
        upper_metal1 = np.array([180, 40, 255])
        metal_mask = cv2.inRange(hsv, lower_metal1, upper_metal1)

        lower_metal2 = np.array([0, 0, 100])
        upper_metal2 = np.array([180, 30, 180])
        metal_mask2 = cv2.inRange(hsv, lower_metal2, upper_metal2)

        edges = cv2.Canny(gray, 50, 150)

        metal_mask = cv2.bitwise_or(metal_mask, metal_mask2)
        metal_with_edges = cv2.bitwise_and(metal_mask, edges)

        kernel = np.ones((3, 3), np.uint8)
        metal_with_edges = cv2.morphologyEx(metal_with_edges, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(metal_with_edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        dart_candidates = []

        for contour in contours:
            area = cv2.contourArea(contour)

            if area < 40 or area > 3000:
                continue

            x, y, w, h = cv2.boundingRect(contour)
            aspect_ratio = max(w, h) / (min(w, h) + 1)

            if aspect_ratio < 1.3:
                continue

            M = cv2.moments(contour)
            if M["m00"] == 0:
                continue

            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])

            if self.calibration["center_x"] is not None:
                board_cx = self.calibration["center_x"]
                board_cy = self.calibration["center_y"]
                board_r = self.calibration["radius"]

                dist_to_board = math.sqrt((cx - board_cx)**2 + (cy - board_cy)**2)

                if dist_to_board > board_r * 1.2:
                    continue

            points = contour.reshape(-1, 2)

            if self.calibration["center_x"] is not None:
                board_cx = self.calibration["center_x"]
                board_cy = self.calibration["center_y"]

                distances = np.sqrt((points[:, 0] - board_cx)**2 + (points[:, 1] - board_cy)**2)
                tip_idx = np.argmin(distances)
                tip_x, tip_y = points[tip_idx]
            else:
                tip_x, tip_y = cx, cy

            confidence = 0.4 + min(0.3, area / 1000) + (aspect_ratio / 10)

            dart_candidates.append((int(tip_x), int(tip_y), min(0.85, confidence)))

        return dart_candidates

    def _filter_close_detections(self, candidates: List[Tuple[int, int, float]],
                                 min_distance: int = 30) -> List[Tuple[int, int, float]]:
        if len(candidates) <= 1:
            return candidates

        filtered = []
        candidates_sorted = sorted(candidates, key=lambda x: x[2], reverse=True)

        for candidate in candidates_sorted:
            x, y, conf = candidate
            too_close = False

            for fx, fy, fconf in filtered:
                dist = math.sqrt((x - fx)**2 + (y - fy)**2)
                if dist < min_distance:
                    too_close = True
                    break

            if not too_close:
                filtered.append(candidate)

        return filtered

    def detect_multiple_darts(self, current_image: np.ndarray,
                             reference_image: Optional[np.ndarray] = None) -> DetectionResult:
        all_candidates = []

        if reference_image is not None:
            diff_darts = self.detect_darts_difference(current_image, reference_image)
            all_candidates.extend([(x, y, conf, "difference") for x, y, conf in diff_darts])

        color_darts = self.detect_darts_color(current_image)
        all_candidates.extend([(x, y, conf * 0.9, "color") for x, y, conf in color_darts])

        if not all_candidates:
            return DetectionResult(
                darts=[],
                total_confidence=0.0,
                method="No detection",
                message="Nem talaltam dartot"
            )

        clusters = self._cluster_detections(all_candidates)

        final_darts = []
        methods_used = set()

        for cluster in clusters:
            if not cluster:
                continue

            weighted_x = sum(x * conf for x, y, conf, method in cluster)
            weighted_y = sum(y * conf for x, y, conf, method in cluster)
            total_conf = sum(conf for x, y, conf, method in cluster)

            final_x = int(weighted_x / total_conf)
            final_y = int(weighted_y / total_conf)

            avg_confidence = total_conf / len(cluster)
            multi_method_bonus = 0.1 if len(set(m for _, _, _, m in cluster)) > 1 else 0
            final_confidence = min(0.98, avg_confidence + multi_method_bonus)

            score, score_conf = self.get_score_from_position(final_x, final_y)
            final_confidence = final_confidence * 0.7 + score_conf * 0.3

            dart = DartDetection(
                x=final_x,
                y=final_y,
                score=score,
                confidence=final_confidence,
                dart_id=self.next_dart_id
            )
            self.next_dart_id += 1

            final_darts.append(dart)

            for _, _, _, method in cluster:
                methods_used.add(method)

        final_darts.sort(key=lambda d: d.confidence, reverse=True)

        if len(final_darts) > 3:
            final_darts = final_darts[:3]

        total_confidence = sum(d.confidence for d in final_darts) / max(1, len(final_darts))

        methods_str = ", ".join(methods_used)
        message = f"{len(final_darts)} dart detektalva ({methods_str})"

        return DetectionResult(
            darts=final_darts,
            total_confidence=total_confidence,
            method=methods_str,
            message=message
        )

    def _cluster_detections(self, candidates: List[Tuple[int, int, float, str]],
                           cluster_distance: int = 35) -> List[List[Tuple[int, int, float, str]]]:
        if not candidates:
            return []

        candidates_sorted = sorted(candidates, key=lambda x: x[2], reverse=True)

        clusters = []

        for candidate in candidates_sorted:
            x, y, conf, method = candidate
            added_to_cluster = False

            for cluster in clusters:
                cluster_x = sum(cx for cx, cy, cconf, cm in cluster) / len(cluster)
                cluster_y = sum(cy for cx, cy, cconf, cm in cluster) / len(cluster)

                dist = math.sqrt((x - cluster_x)**2 + (y - cluster_y)**2)

                if dist < cluster_distance:
                    cluster.append(candidate)
                    added_to_cluster = True
                    break

            if not added_to_cluster:
                clusters.append([candidate])

        return clusters

    def validate_detection(self, dart: DartDetection) -> bool:
        if self.calibration["center_x"] is None:
            return True

        cx = self.calibration["center_x"]
        cy = self.calibration["center_y"]
        r = self.calibration["radius"]

        dist = math.sqrt((dart.x - cx)**2 + (dart.y - cy)**2)

        if dist > r * 1.2:
            return False

        if dart.confidence < 0.3:
            return False

        return True
