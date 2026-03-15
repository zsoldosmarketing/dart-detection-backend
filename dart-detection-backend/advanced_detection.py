import cv2
import numpy as np
import math
from typing import Optional, Tuple, List, Dict, Any
from dataclasses import dataclass, field


@dataclass
class DartDetection:
    x: float
    y: float
    confidence: float
    score: str = ""
    method: str = ""


@dataclass
class DetectionResult:
    darts: List[DartDetection] = field(default_factory=list)
    method: str = ""
    confidence: float = 0.0


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
    def __init__(self, calibration_data: Dict[str, Any]):
        self.cx = float(calibration_data.get("center_x", 0))
        self.cy = float(calibration_data.get("center_y", 0))
        self.radius = float(calibration_data.get("radius", 100))
        self.rotation_offset = float(calibration_data.get("rotation_offset", -9.0))

    def detect_multiple_darts(
        self,
        after: np.ndarray,
        before: np.ndarray
    ) -> DetectionResult:
        darts = []

        diff_darts = self._detect_by_diff(before, after)
        darts.extend(diff_darts)

        color_darts = self._detect_by_dart_color(before, after)
        darts.extend(color_darts)

        merged = self._cluster_and_merge(darts)
        merged.sort(key=lambda d: d.confidence, reverse=True)

        return DetectionResult(
            darts=merged[:3],
            method="multi_method",
            confidence=merged[0].confidence if merged else 0.0
        )

    def _detect_by_diff(
        self, before: np.ndarray, after: np.ndarray
    ) -> List[DartDetection]:
        if before.shape != after.shape:
            h = min(before.shape[0], after.shape[0])
            w = min(before.shape[1], after.shape[1])
            before = cv2.resize(before, (w, h))
            after = cv2.resize(after, (w, h))

        b_blur = cv2.GaussianBlur(before, (5, 5), 1.5)
        a_blur = cv2.GaussianBlur(after, (5, 5), 1.5)

        diff = cv2.absdiff(a_blur, b_blur)
        gray = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)

        thresh_val = max(20, int(np.percentile(gray, 93)))
        _, thresh = cv2.threshold(gray, thresh_val, 255, cv2.THRESH_BINARY)

        k_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        k_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        mask = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, k_close)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, k_open)

        board_mask = np.zeros_like(mask)
        cv2.circle(board_mask, (int(self.cx), int(self.cy)), int(self.radius * 1.1), 255, -1)
        mask = cv2.bitwise_and(mask, board_mask)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        results = []

        for c in contours:
            area = cv2.contourArea(c)
            if area < 40 or area > 35000:
                continue
            pts = c.reshape(-1, 2).astype(float)
            dists = np.sqrt((pts[:, 0] - self.cx) ** 2 + (pts[:, 1] - self.cy) ** 2)
            tip_idx = np.argmin(dists)
            tx, ty = pts[tip_idx]
            tip_dist = dists[tip_idx]
            if tip_dist > self.radius * 1.08:
                continue

            x, y, w, h = cv2.boundingRect(c)
            elongation = max(w, h) / (min(w, h) + 1)
            perimeter = cv2.arcLength(c, True)
            circularity = 4 * math.pi * area / (perimeter ** 2 + 1e-5)

            conf = 0.28
            conf += min(0.20, area / 5000.0)
            if 1.2 < elongation < 7.0:
                conf += 0.10
            conf += min(0.12, circularity * 0.12)
            if tip_dist < self.radius * 0.9:
                conf += 0.08
            conf = min(0.88, conf)

            results.append(DartDetection(
                x=float(tx), y=float(ty),
                confidence=conf, method="diff"
            ))

        return results

    def _detect_by_dart_color(
        self, before: np.ndarray, after: np.ndarray
    ) -> List[DartDetection]:
        if before.shape != after.shape:
            h = min(before.shape[0], after.shape[0])
            w = min(before.shape[1], after.shape[1])
            after = cv2.resize(after, (w, h))

        h_img, w_img = after.shape[:2]
        hsv = cv2.cvtColor(after, cv2.COLOR_BGR2HSV)

        gray_m = cv2.inRange(hsv, np.array([0, 0, 80]), np.array([180, 40, 220]))
        silver_m = cv2.inRange(hsv, np.array([0, 0, 150]), np.array([180, 30, 255]))
        metal_mask = cv2.bitwise_or(gray_m, silver_m)

        diff = cv2.absdiff(after, cv2.GaussianBlur(before, (5, 5), 1.5))
        diff_gray = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
        _, diff_thresh = cv2.threshold(diff_gray, 15, 255, cv2.THRESH_BINARY)

        combined = cv2.bitwise_and(metal_mask, diff_thresh)

        board_mask = np.zeros((h_img, w_img), dtype=np.uint8)
        cv2.circle(board_mask, (int(self.cx), int(self.cy)), int(self.radius * 1.1), 255, -1)
        combined = cv2.bitwise_and(combined, board_mask)

        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, k)

        contours, _ = cv2.findContours(combined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        results = []

        for c in contours:
            area = cv2.contourArea(c)
            if area < 30 or area > 20000:
                continue
            M = cv2.moments(c)
            if M["m00"] == 0:
                continue
            ccx = M["m10"] / M["m00"]
            ccy = M["m01"] / M["m00"]
            dist = math.sqrt((ccx - self.cx) ** 2 + (ccy - self.cy) ** 2)
            if dist > self.radius * 1.05:
                continue

            x, y, w, h = cv2.boundingRect(c)
            elongation = max(w, h) / (min(w, h) + 1)
            conf = 0.25
            if 1.5 < elongation < 8.0:
                conf += 0.15
            conf += min(0.15, area / 4000.0)
            if dist < self.radius * 0.85:
                conf += 0.05
            conf = min(0.75, conf)

            results.append(DartDetection(
                x=ccx, y=ccy,
                confidence=conf, method="color"
            ))

        return results

    def _cluster_and_merge(
        self, darts: List[DartDetection], cluster_radius: float = 25.0
    ) -> List[DartDetection]:
        if not darts:
            return []

        merged = []
        used = [False] * len(darts)

        darts.sort(key=lambda d: d.confidence, reverse=True)

        for i, d in enumerate(darts):
            if used[i]:
                continue
            cluster = [d]
            used[i] = True
            for j in range(i + 1, len(darts)):
                if used[j]:
                    continue
                dist = math.sqrt((d.x - darts[j].x) ** 2 + (d.y - darts[j].y) ** 2)
                if dist < cluster_radius:
                    cluster.append(darts[j])
                    used[j] = True

            if len(cluster) == 1:
                merged.append(cluster[0])
            else:
                total_conf = sum(c.confidence for c in cluster)
                wx = sum(c.x * c.confidence for c in cluster) / total_conf
                wy = sum(c.y * c.confidence for c in cluster) / total_conf
                best_conf = max(c.confidence for c in cluster)
                boost = min(0.10, (len(cluster) - 1) * 0.04)
                methods = "+".join(set(c.method for c in cluster))
                merged.append(DartDetection(
                    x=wx, y=wy,
                    confidence=min(0.95, best_conf + boost),
                    method=methods
                ))

        return merged

    def validate_detection(self, dart: DartDetection) -> bool:
        dist = math.sqrt((dart.x - self.cx) ** 2 + (dart.y - self.cy) ** 2)
        if dist > self.radius * 1.08:
            return False
        if dart.confidence < 0.25:
            return False
        return True

    def get_score(self, dart: DartDetection) -> Tuple[str, int]:
        dx = dart.x - self.cx
        dy = self.cy - dart.y
        dist = math.sqrt(dx ** 2 + dy ** 2)
        dist_ratio = dist / (self.radius + 1e-5)

        if dist_ratio > 1.03:
            return "MISS", 0
        if dist_ratio <= RADIUS_RATIOS["double_bull"]:
            return "D-BULL", 50
        if dist_ratio <= RADIUS_RATIOS["single_bull"]:
            return "BULL", 25

        angle = math.degrees(math.atan2(dx, dy))
        if angle < 0:
            angle += 360
        adjusted = (angle + self.rotation_offset) % 360
        idx = int(adjusted / 18) % 20
        segment = DARTBOARD_SEGMENTS[idx]

        if RADIUS_RATIOS["inner_triple"] <= dist_ratio <= RADIUS_RATIOS["outer_triple"]:
            return f"T{segment}", segment * 3
        elif RADIUS_RATIOS["inner_double"] <= dist_ratio <= RADIUS_RATIOS["outer_double"]:
            return f"D{segment}", segment * 2
        else:
            return f"{segment}", segment
