import cv2
import numpy as np
import math
from typing import Optional, Tuple, List
from dataclasses import dataclass

@dataclass
class EllipseData:
    center_x: int
    center_y: int
    axis_major: float
    axis_minor: float
    angle: float

@dataclass
class CalibrationResult:
    success: bool
    center_x: Optional[int]
    center_y: Optional[int]
    radius: Optional[int]
    radius_x: Optional[int]
    radius_y: Optional[int]
    rotation_offset: float
    confidence: float
    method: str
    message: str
    ellipse: Optional[EllipseData] = None
    is_angled: bool = False
    suggested_zoom: float = 1.0
    board_visible_percent: float = 100.0

DARTBOARD_SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

class AdvancedDartboardCalibration:
    def __init__(self):
        self.last_calibration = None

    def calibrate_multi_method(self, image: np.ndarray) -> CalibrationResult:
        return self.calibrate_dartboard(image)

    def detect_red_green_mask(self, image: np.ndarray) -> np.ndarray:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

        lower_red1 = np.array([0, 50, 50])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([160, 50, 50])
        upper_red2 = np.array([180, 255, 255])

        lower_green = np.array([35, 50, 50])
        upper_green = np.array([85, 255, 255])

        mask_red1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask_red2 = cv2.inRange(hsv, lower_red2, upper_red2)
        mask_red = cv2.bitwise_or(mask_red1, mask_red2)

        mask_green = cv2.inRange(hsv, lower_green, upper_green)

        combined = cv2.bitwise_or(mask_red, mask_green)

        kernel = np.ones((5, 5), np.uint8)
        combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=3)
        combined = cv2.morphologyEx(combined, cv2.MORPH_OPEN, kernel, iterations=1)

        return combined

    def detect_black_white_sectors(self, image: np.ndarray) -> np.ndarray:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        lower_black = np.array([0, 0, 0])
        upper_black = np.array([180, 100, 60])
        mask_black = cv2.inRange(hsv, lower_black, upper_black)

        lower_white = np.array([0, 0, 160])
        upper_white = np.array([180, 50, 255])
        mask_white = cv2.inRange(hsv, lower_white, upper_white)

        combined = cv2.bitwise_or(mask_black, mask_white)

        kernel = np.ones((3, 3), np.uint8)
        combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=2)

        return combined

    def find_board_by_colored_sectors(self, image: np.ndarray) -> Optional[Tuple[int, int, int, int, float]]:
        colored_mask = self.detect_red_green_mask(image)

        kernel = np.ones((11, 11), np.uint8)
        dilated = cv2.dilate(colored_mask, kernel, iterations=5)
        filled = cv2.morphologyEx(dilated, cv2.MORPH_CLOSE, kernel, iterations=5)

        contours, _ = cv2.findContours(filled, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if not contours:
            return None

        height, width = image.shape[:2]

        best_result = None
        best_score = 0

        for contour in contours:
            area = cv2.contourArea(contour)

            if area < (min(width, height) * 0.1) ** 2:
                continue

            if len(contour) < 5:
                continue

            hull = cv2.convexHull(contour)

            if len(hull) < 5:
                continue

            try:
                ellipse = cv2.fitEllipse(hull)
                (cx, cy), (ma, mi), angle = ellipse

                if ma <= 0 or mi <= 0:
                    continue

                ratio = min(ma, mi) / max(ma, mi)
                if ratio < 0.4:
                    continue

                hull_area = cv2.contourArea(hull)
                ellipse_area = math.pi * ma * mi / 4
                fill_ratio = hull_area / ellipse_area if ellipse_area > 0 else 0

                center_dist = math.sqrt((cx - width/2)**2 + (cy - height/2)**2)
                max_dist = math.sqrt((width/2)**2 + (height/2)**2)
                center_score = 1 - (center_dist / max_dist)

                size_ratio = max(ma, mi) / min(width, height)
                size_score = 1.0 if 0.3 < size_ratio < 0.9 else 0.5

                score = ratio * 0.25 + fill_ratio * 0.25 + center_score * 0.25 + size_score * 0.25

                if score > best_score:
                    best_score = score
                    radius_x = int(ma / 2)
                    radius_y = int(mi / 2)
                    best_result = (int(cx), int(cy), radius_x, radius_y, angle, score)

            except Exception:
                continue

        if best_result:
            return best_result[:5]
        return None

    def find_board_by_edges(self, image: np.ndarray) -> Optional[Tuple[int, int, int, int, float]]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        edges = cv2.Canny(blurred, 50, 150)

        kernel = np.ones((3, 3), np.uint8)
        edges = cv2.dilate(edges, kernel, iterations=2)
        edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=3)

        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if not contours:
            return None

        height, width = image.shape[:2]

        best_result = None
        best_score = 0

        for contour in contours:
            area = cv2.contourArea(contour)

            if area < (min(width, height) * 0.15) ** 2:
                continue

            if len(contour) < 5:
                continue

            perimeter = cv2.arcLength(contour, True)
            circularity = 4 * math.pi * area / (perimeter * perimeter) if perimeter > 0 else 0

            if circularity < 0.3:
                continue

            try:
                ellipse = cv2.fitEllipse(contour)
                (cx, cy), (ma, mi), angle = ellipse

                if ma <= 0 or mi <= 0:
                    continue

                ratio = min(ma, mi) / max(ma, mi)
                if ratio < 0.4:
                    continue

                center_dist = math.sqrt((cx - width/2)**2 + (cy - height/2)**2)
                max_dist = math.sqrt((width/2)**2 + (height/2)**2)
                center_score = 1 - (center_dist / max_dist)

                score = ratio * 0.3 + circularity * 0.4 + center_score * 0.3

                if score > best_score:
                    best_score = score
                    radius_x = int(ma / 2)
                    radius_y = int(mi / 2)
                    best_result = (int(cx), int(cy), radius_x, radius_y, angle)

            except Exception:
                continue

        return best_result

    def find_bull_center(self, image: np.ndarray, approx_center: Tuple[int, int], search_radius: int) -> Optional[Tuple[int, int]]:
        cx, cy = approx_center
        h, w = image.shape[:2]

        x1 = max(0, cx - search_radius)
        y1 = max(0, cy - search_radius)
        x2 = min(w, cx + search_radius)
        y2 = min(h, cy + search_radius)

        roi = image[y1:y2, x1:x2]
        if roi.size == 0:
            return None

        hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

        lower_red1 = np.array([0, 70, 70])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([170, 70, 70])
        upper_red2 = np.array([180, 255, 255])

        mask_red = cv2.inRange(hsv, lower_red1, upper_red1) | cv2.inRange(hsv, lower_red2, upper_red2)

        lower_green = np.array([35, 70, 70])
        upper_green = np.array([85, 255, 255])
        mask_green = cv2.inRange(hsv, lower_green, upper_green)

        bull_mask = cv2.bitwise_or(mask_red, mask_green)

        kernel = np.ones((3, 3), np.uint8)
        bull_mask = cv2.morphologyEx(bull_mask, cv2.MORPH_OPEN, kernel)
        bull_mask = cv2.morphologyEx(bull_mask, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(bull_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        best_contour = None
        best_score = 0
        roi_cx = (x2 - x1) // 2
        roi_cy = (y2 - y1) // 2

        for contour in contours:
            area = cv2.contourArea(contour)
            if area < 20:
                continue

            (cont_cx, cont_cy), radius = cv2.minEnclosingCircle(contour)
            if radius < 3:
                continue

            circle_area = math.pi * radius * radius
            circularity = area / circle_area if circle_area > 0 else 0

            dist_to_center = math.sqrt((cont_cx - roi_cx)**2 + (cont_cy - roi_cy)**2)
            centrality = 1 - (dist_to_center / search_radius) if search_radius > 0 else 0

            score = circularity * 0.4 + centrality * 0.6

            if score > best_score:
                best_score = score
                best_contour = contour

        if best_contour is None:
            return None

        M = cv2.moments(best_contour)
        if M["m00"] == 0:
            return None

        bull_x = int(M["m10"] / M["m00"]) + x1
        bull_y = int(M["m01"] / M["m00"]) + y1

        return (bull_x, bull_y)

    def detect_rotation_offset(self, image: np.ndarray, center: Tuple[int, int], radius: int) -> float:
        cx, cy = center
        sample_radius = int(radius * 0.85)

        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

        lower_red1 = np.array([0, 60, 60])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([165, 60, 60])
        upper_red2 = np.array([180, 255, 255])

        mask_red = cv2.inRange(hsv, lower_red1, upper_red1) | cv2.inRange(hsv, lower_red2, upper_red2)

        red_angles = []

        for angle_deg in range(0, 360, 2):
            angle_rad = math.radians(angle_deg)
            px = int(cx + sample_radius * math.sin(angle_rad))
            py = int(cy - sample_radius * math.cos(angle_rad))

            if 0 <= px < mask_red.shape[1] and 0 <= py < mask_red.shape[0]:
                if mask_red[py, px] > 0:
                    red_angles.append(angle_deg)

        if len(red_angles) < 10:
            return -9.0

        sectors = []
        current_start = None

        for i, angle in enumerate(sorted(red_angles)):
            if current_start is None:
                current_start = angle
            elif i > 0 and angle - red_angles[i-1] > 5:
                sector_center = (current_start + red_angles[i-1]) / 2
                sectors.append(sector_center)
                current_start = angle

        if current_start is not None:
            sectors.append((current_start + red_angles[-1]) / 2)

        if len(sectors) >= 5:
            closest = min(sectors, key=lambda a: min(abs(a), abs(a - 360)))
            offset = closest
            if offset > 180:
                offset -= 360
            return offset

        return -9.0

    def calculate_visibility(self, image: np.ndarray, cx: int, cy: int, rx: int, ry: int) -> float:
        h, w = image.shape[:2]

        top_ok = cy - ry > 5
        bottom_ok = cy + ry < h - 5
        left_ok = cx - rx > 5
        right_ok = cx + rx < w - 5

        visible = sum([top_ok, bottom_ok, left_ok, right_ok])

        return visible * 25.0

    def calibrate_dartboard(self, image: np.ndarray) -> CalibrationResult:
        if image is None or image.size == 0:
            return CalibrationResult(
                success=False, center_x=None, center_y=None, radius=None,
                radius_x=None, radius_y=None, rotation_offset=0.0,
                confidence=0.0, method="error", message="Invalid image"
            )

        height, width = image.shape[:2]

        best_result = None
        best_confidence = 0.0

        color_result = self.find_board_by_colored_sectors(image)
        if color_result:
            cx, cy, rx, ry, angle = color_result
            ratio = min(rx, ry) / max(rx, ry) if max(rx, ry) > 0 else 1
            confidence = ratio * 0.5 + 0.4
            confidence = min(0.95, confidence)

            if confidence > best_confidence:
                best_confidence = confidence
                best_result = {
                    "center_x": cx, "center_y": cy,
                    "radius_x": rx, "radius_y": ry,
                    "angle": angle, "method": "color_sectors",
                    "confidence": confidence
                }

        edge_result = self.find_board_by_edges(image)
        if edge_result:
            cx, cy, rx, ry, angle = edge_result
            ratio = min(rx, ry) / max(rx, ry) if max(rx, ry) > 0 else 1
            confidence = ratio * 0.4 + 0.3
            confidence = min(0.85, confidence)

            if confidence > best_confidence:
                best_confidence = confidence
                best_result = {
                    "center_x": cx, "center_y": cy,
                    "radius_x": rx, "radius_y": ry,
                    "angle": angle, "method": "edge_detection",
                    "confidence": confidence
                }

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (9, 9), 2)

        min_r = int(min(width, height) * 0.1)
        max_r = int(min(width, height) * 0.45)

        circles = cv2.HoughCircles(
            blurred, cv2.HOUGH_GRADIENT, dp=1.2,
            minDist=int(min(width, height) * 0.3),
            param1=50, param2=30,
            minRadius=min_r, maxRadius=max_r
        )

        if circles is not None:
            for circle in circles[0]:
                cx, cy, r = int(circle[0]), int(circle[1]), int(circle[2])

                center_dist = math.sqrt((cx - width/2)**2 + (cy - height/2)**2)
                center_score = 1 - (center_dist / (math.sqrt((width/2)**2 + (height/2)**2)))

                confidence = center_score * 0.5 + 0.3
                confidence = min(0.75, confidence)

                if confidence > best_confidence:
                    best_confidence = confidence
                    best_result = {
                        "center_x": cx, "center_y": cy,
                        "radius_x": r, "radius_y": r,
                        "angle": 0, "method": "hough_circle",
                        "confidence": confidence
                    }

        if best_result is None:
            return CalibrationResult(
                success=False,
                center_x=width // 2,
                center_y=height // 2,
                radius=int(min(width, height) * 0.3),
                radius_x=int(min(width, height) * 0.3),
                radius_y=int(min(width, height) * 0.3),
                rotation_offset=-9.0,
                confidence=0.2,
                method="fallback",
                message="Tabla nem talalhato - hasznalj jobb megvilagitast!",
                ellipse=None,
                is_angled=False,
                suggested_zoom=1.0,
                board_visible_percent=50.0
            )

        cx = best_result["center_x"]
        cy = best_result["center_y"]
        rx = best_result["radius_x"]
        ry = best_result["radius_y"]
        angle = best_result["angle"]
        method = best_result["method"]
        confidence = best_result["confidence"]

        avg_radius = (rx + ry) // 2
        search_radius = avg_radius // 4

        bull = self.find_bull_center(image, (cx, cy), search_radius)
        if bull:
            dist = math.sqrt((bull[0] - cx)**2 + (bull[1] - cy)**2)
            if dist < search_radius:
                cx, cy = bull
                confidence = min(0.98, confidence + 0.1)
                method += "+bull"

        rotation = self.detect_rotation_offset(image, (cx, cy), avg_radius)

        visibility = self.calculate_visibility(image, cx, cy, rx, ry)

        is_angled = (min(rx, ry) / max(rx, ry)) < 0.9 if max(rx, ry) > 0 else False

        ellipse_data = EllipseData(
            center_x=cx, center_y=cy,
            axis_major=float(rx * 2), axis_minor=float(ry * 2),
            angle=float(angle)
        )

        zoom = 1.0
        if visibility >= 90:
            board_size = max(rx, ry) * 2
            zoom = min(2.0, min(width, height) / (board_size * 1.2))
            zoom = max(1.0, zoom)

        status = "szogbol" if is_angled else "frontalisan"
        message = f"Tabla kalibrálva {status}! ({confidence*100:.0f}%)"

        return CalibrationResult(
            success=True,
            center_x=cx,
            center_y=cy,
            radius=avg_radius,
            radius_x=rx,
            radius_y=ry,
            rotation_offset=rotation,
            confidence=confidence,
            method=method,
            message=message,
            ellipse=ellipse_data,
            is_angled=is_angled,
            suggested_zoom=round(zoom, 2),
            board_visible_percent=visibility
        )
