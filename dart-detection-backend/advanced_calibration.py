import cv2
import numpy as np
import math
from typing import Optional, Tuple, List
from dataclasses import dataclass, field


@dataclass
class EllipseData:
    center_x: float
    center_y: float
    axis_major: float
    axis_minor: float
    angle: float


@dataclass
class CalibrationResult:
    success: bool
    center_x: Optional[float]
    center_y: Optional[float]
    radius: Optional[float]
    radius_x: Optional[float]
    radius_y: Optional[float]
    rotation_offset: float
    confidence: float
    method: str
    message: str
    ellipse: Optional[EllipseData] = None
    is_angled: bool = False
    suggested_zoom: float = 1.0
    board_visible_percent: float = 100.0


DARTBOARD_SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

BOARD_WIRE_SCALE = 1.18


class AdvancedDartboardCalibration:
    def __init__(self):
        self.last_calibration: Optional[CalibrationResult] = None

    def calibrate_multi_method(self, image: np.ndarray) -> CalibrationResult:
        return self.calibrate_dartboard(image)

    def _red_green_mask(self, image: np.ndarray) -> np.ndarray:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        r1 = cv2.inRange(hsv, np.array([0, 60, 60]), np.array([12, 255, 255]))
        r2 = cv2.inRange(hsv, np.array([158, 60, 60]), np.array([180, 255, 255]))
        g = cv2.inRange(hsv, np.array([38, 60, 60]), np.array([88, 255, 255]))
        mask = cv2.bitwise_or(cv2.bitwise_or(r1, r2), g)
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k, iterations=3)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, k, iterations=1)
        return mask

    def _black_wire_mask(self, image: np.ndarray) -> np.ndarray:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        black = cv2.inRange(hsv, np.array([0, 0, 0]), np.array([180, 80, 55]))
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        black = cv2.morphologyEx(black, cv2.MORPH_CLOSE, k)
        return black

    def _fit_ellipse_to_contour(
        self, contour: np.ndarray, image_shape: Tuple[int, int]
    ) -> Optional[Tuple[float, float, float, float, float, float]]:
        if len(contour) < 5:
            return None
        h, w = image_shape[:2]
        try:
            hull = cv2.convexHull(contour)
            if len(hull) < 5:
                return None
            (cx, cy), (ma, mi), angle = cv2.fitEllipse(hull)
            if ma <= 0 or mi <= 0:
                return None
            ratio = min(ma, mi) / max(ma, mi)
            if ratio < 0.35:
                return None
            area = cv2.contourArea(hull)
            ellipse_area = math.pi * ma * mi / 4.0
            fill = area / (ellipse_area + 1e-5)
            center_dist = math.sqrt((cx - w / 2) ** 2 + (cy - h / 2) ** 2)
            max_dist = math.sqrt((w / 2) ** 2 + (h / 2) ** 2)
            center_score = max(0.0, 1.0 - center_dist / (max_dist + 1e-5))
            size_ratio = max(ma, mi) / max(min(w, h), 1)
            size_score = 1.0 if 0.25 < size_ratio < 0.95 else 0.4
            score = ratio * 0.30 + min(1.0, fill) * 0.20 + center_score * 0.30 + size_score * 0.20
            return cx, cy, ma / 2, mi / 2, angle, score
        except Exception:
            return None

    def _method_color_sectors(
        self, image: np.ndarray
    ) -> Optional[Tuple[float, float, float, float, float, float]]:
        mask = self._red_green_mask(image)
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
        filled = cv2.dilate(mask, k, iterations=6)
        filled = cv2.morphologyEx(filled, cv2.MORPH_CLOSE, k, iterations=4)
        contours, _ = cv2.findContours(filled, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None
        h, w = image.shape[:2]
        min_area = (min(w, h) * 0.08) ** 2
        best = None
        best_score = 0.0
        for c in contours:
            if cv2.contourArea(c) < min_area:
                continue
            r = self._fit_ellipse_to_contour(c, image.shape)
            if r and r[5] > best_score:
                best_score = r[5]
                best = r
        return best

    def _method_edge_ellipse(
        self, image: np.ndarray
    ) -> Optional[Tuple[float, float, float, float, float, float]]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (5, 5), 1.0)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)
        edges = cv2.Canny(gray, 40, 120)
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        edges = cv2.dilate(edges, k, iterations=2)
        edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, k, iterations=4)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        if not contours:
            return None
        h, w = image.shape[:2]
        min_area = (min(w, h) * 0.12) ** 2
        best = None
        best_score = 0.0
        for c in contours:
            area = cv2.contourArea(c)
            if area < min_area:
                continue
            perimeter = cv2.arcLength(c, True)
            circularity = 4 * math.pi * area / (perimeter ** 2 + 1e-5)
            if circularity < 0.25:
                continue
            r = self._fit_ellipse_to_contour(c, image.shape)
            if r:
                score = r[5] * (0.6 + circularity * 0.4)
                if score > best_score:
                    best_score = score
                    best = (*r[:5], score)
        return best

    def _method_hough_circles(
        self, image: np.ndarray
    ) -> Optional[Tuple[float, float, float, float, float, float]]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (9, 9), 2.0)
        h, w = image.shape[:2]
        min_r = int(min(w, h) * 0.08)
        max_r = int(min(w, h) * 0.48)
        circles = cv2.HoughCircles(
            gray, cv2.HOUGH_GRADIENT, dp=1.2,
            minDist=int(min(w, h) * 0.25),
            param1=60, param2=28,
            minRadius=min_r, maxRadius=max_r
        )
        if circles is None:
            return None
        best = None
        best_score = 0.0
        for cx, cy, r in circles[0]:
            center_dist = math.sqrt((cx - w / 2) ** 2 + (cy - h / 2) ** 2)
            center_score = max(0.0, 1.0 - center_dist / (math.sqrt((w / 2) ** 2 + (h / 2) ** 2) + 1e-5))
            size_score = 1.0 if 0.2 < r / min(w, h) < 0.5 else 0.5
            score = center_score * 0.6 + size_score * 0.4
            if score > best_score:
                best_score = score
                best = (float(cx), float(cy), float(r), float(r), 0.0, score * 0.7)
        return best

    def _method_template_rings(
        self, image: np.ndarray
    ) -> Optional[Tuple[float, float, float, float, float, float]]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (3, 3), 0.8)
        h, w = image.shape[:2]
        min_r = int(min(w, h) * 0.10)
        max_r = int(min(w, h) * 0.46)
        best = None
        best_score = -1.0

        for r in range(min_r, max_r, max(1, (max_r - min_r) // 20)):
            ring = np.zeros((h, w), dtype=np.uint8)
            cv2.circle(ring, (w // 2, h // 2), r, 255, max(2, r // 20))
            result = cv2.matchTemplate(gray, ring, cv2.TM_CCOEFF_NORMED)
            if result.size == 0:
                continue
            _, max_val, _, max_loc = cv2.minMaxLoc(result)
            if max_val > best_score:
                best_score = max_val
                cx = max_loc[0] + w // 2
                cy = max_loc[1] + h // 2
                best = (float(cx), float(cy), float(r), float(r), 0.0, float(max_val) * 0.65)

        return best

    def _refine_bull_center(
        self,
        image: np.ndarray,
        approx_cx: float,
        approx_cy: float,
        board_radius: float
    ) -> Tuple[float, float, float]:
        sr = int(board_radius * 0.12)
        h, w = image.shape[:2]
        x1 = max(0, int(approx_cx) - sr)
        y1 = max(0, int(approx_cy) - sr)
        x2 = min(w, int(approx_cx) + sr)
        y2 = min(h, int(approx_cy) + sr)
        roi = image[y1:y2, x1:x2]
        if roi.size == 0:
            return approx_cx, approx_cy, 0.0

        hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
        r1 = cv2.inRange(hsv, np.array([0, 80, 80]), np.array([12, 255, 255]))
        r2 = cv2.inRange(hsv, np.array([165, 80, 80]), np.array([180, 255, 255]))
        g = cv2.inRange(hsv, np.array([38, 80, 80]), np.array([88, 255, 255]))
        bull_mask = cv2.bitwise_or(cv2.bitwise_or(r1, r2), g)
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        bull_mask = cv2.morphologyEx(bull_mask, cv2.MORPH_OPEN, k)
        bull_mask = cv2.morphologyEx(bull_mask, cv2.MORPH_CLOSE, k)

        contours, _ = cv2.findContours(bull_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return approx_cx, approx_cy, 0.0

        roi_cx = (x2 - x1) / 2.0
        roi_cy = (y2 - y1) / 2.0
        best_c = None
        best_s = -1.0
        for c in contours:
            area = cv2.contourArea(c)
            if area < 15:
                continue
            M = cv2.moments(c)
            if M["m00"] == 0:
                continue
            ccx = M["m10"] / M["m00"]
            ccy = M["m01"] / M["m00"]
            dist = math.sqrt((ccx - roi_cx) ** 2 + (ccy - roi_cy) ** 2)
            score = area * 0.3 + max(0.0, 1.0 - dist / sr) * 0.7
            if score > best_s:
                best_s = score
                best_c = (ccx + x1, ccy + y1)

        if best_c is None:
            return approx_cx, approx_cy, 0.0

        dist = math.sqrt((best_c[0] - approx_cx) ** 2 + (best_c[1] - approx_cy) ** 2)
        if dist > sr * 0.85:
            return approx_cx, approx_cy, 0.0

        return best_c[0], best_c[1], min(0.15, best_s * 0.02)

    def _detect_rotation_offset(
        self,
        image: np.ndarray,
        cx: float,
        cy: float,
        radius: float
    ) -> float:
        sample_r = int(radius * 0.80)
        if sample_r < 10:
            return -9.0

        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        r1 = cv2.inRange(hsv, np.array([0, 60, 60]), np.array([12, 255, 255]))
        r2 = cv2.inRange(hsv, np.array([158, 60, 60]), np.array([180, 255, 255]))
        red_mask = cv2.bitwise_or(r1, r2)

        red_angles = []
        h_img, w_img = image.shape[:2]
        for deg in range(0, 360, 2):
            rad = math.radians(deg)
            px = int(cx + sample_r * math.sin(rad))
            py = int(cy - sample_r * math.cos(rad))
            if 0 <= px < w_img and 0 <= py < h_img:
                if red_mask[py, px] > 0:
                    red_angles.append(deg)

        if len(red_angles) < 8:
            return -9.0

        sectors = []
        if red_angles:
            current_start = red_angles[0]
            prev = red_angles[0]
            for ang in red_angles[1:]:
                if ang - prev > 6:
                    sectors.append((current_start + prev) / 2.0)
                    current_start = ang
                prev = ang
            sectors.append((current_start + red_angles[-1]) / 2.0)

        if len(sectors) < 4:
            return -9.0

        expected_spacing = 360.0 / 20
        best_offset = -9.0
        best_err = float("inf")

        for base in sectors:
            for expected_deg in range(0, 360, int(expected_spacing)):
                offset = (base - expected_deg) % 360
                if offset > 180:
                    offset -= 360
                err_sum = 0.0
                for s in sectors:
                    aligned = (s - offset) % 360
                    closest = round(aligned / expected_spacing) * expected_spacing
                    err_sum += abs(aligned - closest) ** 2
                if err_sum < best_err:
                    best_err = err_sum
                    best_offset = offset

        return float(best_offset)

    def _calculate_visibility(
        self,
        image: np.ndarray,
        cx: float,
        cy: float,
        rx: float,
        ry: float
    ) -> float:
        h, w = image.shape[:2]
        top = (cy - ry) > 5
        bottom = (cy + ry) < (h - 5)
        left = (cx - rx) > 5
        right = (cx + rx) < (w - 5)
        return sum([top, bottom, left, right]) * 25.0

    def calibrate_dartboard(self, image: np.ndarray) -> CalibrationResult:
        if image is None or image.size == 0:
            return CalibrationResult(
                success=False, center_x=None, center_y=None, radius=None,
                radius_x=None, radius_y=None, rotation_offset=0.0,
                confidence=0.0, method="error", message="Invalid image"
            )

        h, w = image.shape[:2]
        candidates = []

        color_r = self._method_color_sectors(image)
        if color_r:
            candidates.append(("color_sectors", color_r, 1.15))

        edge_r = self._method_edge_ellipse(image)
        if edge_r:
            candidates.append(("edge_ellipse", edge_r, 1.0))

        hough_r = self._method_hough_circles(image)
        if hough_r:
            candidates.append(("hough_circle", hough_r, 0.85))

        if not candidates:
            return CalibrationResult(
                success=False,
                center_x=float(w // 2), center_y=float(h // 2),
                radius=float(int(min(w, h) * 0.30)),
                radius_x=float(int(min(w, h) * 0.30)),
                radius_y=float(int(min(w, h) * 0.30)),
                rotation_offset=-9.0,
                confidence=0.12,
                method="fallback",
                message="Board not found - check lighting and positioning",
                is_angled=False,
                suggested_zoom=1.0,
                board_visible_percent=50.0
            )

        best_method, best_r, weight = max(candidates, key=lambda c: c[1][5] * c[2])
        cx, cy, rx, ry, angle, raw_conf = best_r
        confidence = min(0.96, raw_conf * weight)

        cx_refined, cy_refined, bull_bonus = self._refine_bull_center(
            image, cx, cy, max(rx, ry)
        )
        if bull_bonus > 0:
            cx, cy = cx_refined, cy_refined
            confidence = min(0.98, confidence + bull_bonus)
            best_method += "+bull"

        avg_r = (rx + ry) / 2.0
        rotation = self._detect_rotation_offset(image, cx, cy, avg_r)

        full_rx = rx * BOARD_WIRE_SCALE
        full_ry = ry * BOARD_WIRE_SCALE
        full_avg = avg_r * BOARD_WIRE_SCALE

        is_angled = (min(full_rx, full_ry) / (max(full_rx, full_ry) + 1e-5)) < 0.88
        visibility = self._calculate_visibility(image, cx, cy, full_rx, full_ry)

        zoom = 1.0
        if visibility >= 90:
            board_size = max(full_rx, full_ry) * 2
            zoom = min(2.0, min(w, h) / (board_size * 1.2))
            zoom = max(1.0, zoom)

        ellipse_data = EllipseData(
            center_x=cx, center_y=cy,
            axis_major=full_rx * 2, axis_minor=full_ry * 2,
            angle=float(angle)
        )

        view_type = "angled" if is_angled else "frontal"
        message = f"Board calibrated ({view_type}) {confidence * 100:.0f}% via {best_method}"

        result = CalibrationResult(
            success=True,
            center_x=cx,
            center_y=cy,
            radius=full_avg,
            radius_x=full_rx,
            radius_y=full_ry,
            rotation_offset=rotation,
            confidence=confidence,
            method=best_method,
            message=message,
            ellipse=ellipse_data,
            is_angled=is_angled,
            suggested_zoom=round(zoom, 2),
            board_visible_percent=visibility
        )
        self.last_calibration = result
        return result
