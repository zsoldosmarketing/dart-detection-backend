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

    def find_dartboard_contour(self, image: np.ndarray) -> Optional[np.ndarray]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        edges = cv2.Canny(blurred, 30, 100)
        kernel = np.ones((3, 3), np.uint8)
        edges = cv2.dilate(edges, kernel, iterations=2)
        edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=2)

        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if not contours:
            return None

        height, width = image.shape[:2]
        img_area = width * height
        min_area = img_area * 0.05
        max_area = img_area * 0.95

        valid_contours = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if min_area < area < max_area and len(contour) >= 5:
                perimeter = cv2.arcLength(contour, True)
                circularity = 4 * math.pi * area / (perimeter * perimeter) if perimeter > 0 else 0
                if circularity > 0.3:
                    valid_contours.append((contour, area, circularity))

        if not valid_contours:
            return None

        valid_contours.sort(key=lambda x: x[1], reverse=True)
        return valid_contours[0][0]

    def find_dartboard_by_color(self, image: np.ndarray) -> Optional[np.ndarray]:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

        lower_red1 = np.array([0, 70, 50])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([160, 70, 50])
        upper_red2 = np.array([180, 255, 255])
        mask_red = cv2.inRange(hsv, lower_red1, upper_red1) | cv2.inRange(hsv, lower_red2, upper_red2)

        lower_green = np.array([35, 70, 50])
        upper_green = np.array([85, 255, 255])
        mask_green = cv2.inRange(hsv, lower_green, upper_green)

        combined = mask_red | mask_green

        kernel = np.ones((5, 5), np.uint8)
        combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=4)
        combined = cv2.morphologyEx(combined, cv2.MORPH_OPEN, kernel, iterations=2)

        contours, _ = cv2.findContours(combined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if not contours:
            return None

        largest = max(contours, key=cv2.contourArea)
        if len(largest) >= 5:
            return largest
        return None

    def find_playing_area(self, image: np.ndarray) -> Optional[Tuple[int, int, int, int, float]]:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

        lower_red1 = np.array([0, 80, 60])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([165, 80, 60])
        upper_red2 = np.array([180, 255, 255])
        mask_red = cv2.inRange(hsv, lower_red1, upper_red1) | cv2.inRange(hsv, lower_red2, upper_red2)

        lower_green = np.array([40, 80, 60])
        upper_green = np.array([80, 255, 255])
        mask_green = cv2.inRange(hsv, lower_green, upper_green)

        combined = mask_red | mask_green

        kernel = np.ones((7, 7), np.uint8)
        combined = cv2.dilate(combined, kernel, iterations=3)
        combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=5)

        contours, _ = cv2.findContours(combined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if not contours:
            return None

        height, width = image.shape[:2]
        img_area = width * height

        best_contour = None
        best_score = 0

        for contour in contours:
            area = cv2.contourArea(contour)
            if area < img_area * 0.02:
                continue

            if len(contour) < 5:
                continue

            try:
                ellipse = cv2.fitEllipse(contour)
                (cx, cy), (ma, mi), angle = ellipse

                if ma <= 0 or mi <= 0:
                    continue

                ratio = min(ma, mi) / max(ma, mi)
                if ratio < 0.5:
                    continue

                ellipse_area = math.pi * ma * mi / 4
                fill_ratio = area / ellipse_area if ellipse_area > 0 else 0

                center_dist = math.sqrt((cx - width/2)**2 + (cy - height/2)**2)
                max_dist = math.sqrt((width/2)**2 + (height/2)**2)
                center_score = 1 - (center_dist / max_dist)

                score = ratio * 0.3 + fill_ratio * 0.4 + center_score * 0.3

                if score > best_score:
                    best_score = score
                    best_contour = contour
            except:
                continue

        if best_contour is None or len(best_contour) < 5:
            return None

        try:
            ellipse = cv2.fitEllipse(best_contour)
            (cx, cy), (ma, mi), angle = ellipse
            radius_x = int(ma / 2)
            radius_y = int(mi / 2)
            return (int(cx), int(cy), radius_x, radius_y, angle)
        except:
            return None

    def detect_bull_center(self, image: np.ndarray, approx_center: Tuple[int, int], search_radius: int) -> Optional[Tuple[int, int]]:
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

        lower_red1 = np.array([0, 80, 80])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([170, 80, 80])
        upper_red2 = np.array([180, 255, 255])

        mask = cv2.inRange(hsv, lower_red1, upper_red1) | cv2.inRange(hsv, lower_red2, upper_red2)

        kernel = np.ones((3, 3), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        best_contour = None
        best_score = 0
        roi_center = (search_radius, search_radius)

        for contour in contours:
            area = cv2.contourArea(contour)
            if area < 30:
                continue

            (cont_cx, cont_cy), radius = cv2.minEnclosingCircle(contour)
            if radius < 3:
                continue

            circle_area = math.pi * radius * radius
            circularity = area / circle_area if circle_area > 0 else 0

            dist_to_center = math.sqrt((cont_cx - roi_center[0])**2 + (cont_cy - roi_center[1])**2)
            max_dist = search_radius
            centrality = 1 - (dist_to_center / max_dist) if max_dist > 0 else 0

            score = circularity * 0.5 + centrality * 0.5

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

        red_sectors = []
        current_start = None

        for angle_deg in range(0, 360, 1):
            angle_rad = math.radians(angle_deg)
            px = int(cx + sample_radius * math.sin(angle_rad))
            py = int(cy - sample_radius * math.cos(angle_rad))

            if 0 <= px < mask_red.shape[1] and 0 <= py < mask_red.shape[0]:
                is_red = mask_red[py, px] > 0

                if is_red and current_start is None:
                    current_start = angle_deg
                elif not is_red and current_start is not None:
                    sector_center = (current_start + angle_deg - 1) / 2
                    sector_width = angle_deg - 1 - current_start
                    if 10 < sector_width < 25:
                        red_sectors.append(sector_center)
                    current_start = None

        if current_start is not None:
            sector_center = (current_start + 359) / 2
            sector_width = 359 - current_start
            if 10 < sector_width < 25:
                red_sectors.append(sector_center)

        if len(red_sectors) >= 5:
            target_angle = 0
            closest = min(red_sectors, key=lambda a: min(abs(a - target_angle), 360 - abs(a - target_angle)))
            offset = closest - target_angle
            if offset > 180:
                offset -= 360
            elif offset < -180:
                offset += 360
            return offset

        return -9.0

    def calculate_board_visibility(self, image: np.ndarray, center: Tuple[int, int], radius_x: int, radius_y: int) -> float:
        h, w = image.shape[:2]
        cx, cy = center

        margin = 5

        top_visible = cy - radius_y >= margin
        bottom_visible = cy + radius_y <= h - margin
        left_visible = cx - radius_x >= margin
        right_visible = cx + radius_x <= w - margin

        visible_sides = sum([top_visible, bottom_visible, left_visible, right_visible])

        if visible_sides == 4:
            return 100.0
        elif visible_sides == 3:
            return 85.0
        elif visible_sides == 2:
            return 65.0
        elif visible_sides == 1:
            return 40.0
        else:
            return 20.0

    def calculate_suggested_zoom(self, image: np.ndarray, center: Tuple[int, int], radius_x: int, radius_y: int) -> float:
        h, w = image.shape[:2]
        cx, cy = center

        board_width = radius_x * 2 * 1.15
        board_height = radius_y * 2 * 1.15

        zoom_x = w / board_width
        zoom_y = h / board_height

        suggested_zoom = min(zoom_x, zoom_y)

        suggested_zoom = max(1.0, min(2.5, suggested_zoom))

        return round(suggested_zoom, 2)

    def calibrate_dartboard(self, image: np.ndarray) -> CalibrationResult:
        if image is None or image.size == 0:
            return CalibrationResult(
                success=False,
                center_x=None,
                center_y=None,
                radius=None,
                radius_x=None,
                radius_y=None,
                rotation_offset=0.0,
                confidence=0.0,
                method="error",
                message="Ervenytelen kep"
            )

        height, width = image.shape[:2]

        best_result = None
        best_confidence = 0

        playing_area = self.find_playing_area(image)
        if playing_area:
            cx, cy, rx, ry, angle = playing_area
            ratio = min(rx, ry) / max(rx, ry) if max(rx, ry) > 0 else 1
            is_angled = ratio < 0.92
            avg_radius = int((rx + ry) / 2)

            center_dist = math.sqrt((cx - width/2)**2 + (cy - height/2)**2)
            max_dist = math.sqrt((width/2)**2 + (height/2)**2)
            center_score = 1 - (center_dist / max_dist)

            confidence = (ratio * 0.3 + center_score * 0.4 + 0.3)
            confidence = min(0.95, confidence * 1.1)

            if confidence > best_confidence:
                best_confidence = confidence
                best_result = {
                    "center_x": cx,
                    "center_y": cy,
                    "radius": avg_radius,
                    "radius_x": rx,
                    "radius_y": ry,
                    "angle": angle,
                    "is_angled": is_angled,
                    "method": "playing_area_color",
                    "confidence": confidence
                }

        color_contour = self.find_dartboard_by_color(image)
        if color_contour is not None and len(color_contour) >= 5:
            try:
                ellipse = cv2.fitEllipse(color_contour)
                (ecx, ecy), (ma, mi), angle = ellipse

                if ma > 0 and mi > 0:
                    ratio = min(ma, mi) / max(ma, mi)
                    is_angled = ratio < 0.92

                    radius_x = int(ma / 2)
                    radius_y = int(mi / 2)
                    avg_radius = int((radius_x + radius_y) / 2)

                    area = cv2.contourArea(color_contour)
                    ellipse_area = math.pi * ma * mi / 4
                    fill_ratio = area / ellipse_area if ellipse_area > 0 else 0

                    center_dist = math.sqrt((ecx - width/2)**2 + (ecy - height/2)**2)
                    max_dist = math.sqrt((width/2)**2 + (height/2)**2)
                    center_score = 1 - (center_dist / max_dist)

                    confidence = (ratio * 0.25 + fill_ratio * 0.35 + center_score * 0.4)
                    confidence = min(0.92, confidence * 1.1)

                    if confidence > best_confidence:
                        best_confidence = confidence
                        best_result = {
                            "center_x": int(ecx),
                            "center_y": int(ecy),
                            "radius": avg_radius,
                            "radius_x": radius_x,
                            "radius_y": radius_y,
                            "angle": angle,
                            "is_angled": is_angled,
                            "method": "color_detection",
                            "confidence": confidence
                        }
            except Exception:
                pass

        if best_result is None:
            center_x = width // 2
            center_y = height // 2
            radius = int(min(width, height) * 0.35)

            return CalibrationResult(
                success=True,
                center_x=center_x,
                center_y=center_y,
                radius=radius,
                radius_x=radius,
                radius_y=radius,
                rotation_offset=-9.0,
                confidence=0.4,
                method="fallback_center",
                message="Tabla kozepre igazitva (40%) - Allitsd pontosabban!",
                ellipse=EllipseData(
                    center_x=center_x,
                    center_y=center_y,
                    axis_major=float(radius * 2),
                    axis_minor=float(radius * 2),
                    angle=0.0
                ),
                is_angled=False,
                suggested_zoom=1.0,
                board_visible_percent=100.0
            )

        center = (best_result["center_x"], best_result["center_y"])
        search_radius = best_result["radius"] // 4

        bull_center = self.detect_bull_center(image, center, search_radius)
        if bull_center:
            dist = math.sqrt((bull_center[0] - center[0])**2 + (bull_center[1] - center[1])**2)
            if dist < search_radius:
                best_result["center_x"] = bull_center[0]
                best_result["center_y"] = bull_center[1]
                best_result["confidence"] = min(0.98, best_result["confidence"] + 0.05)

        rotation_offset = self.detect_rotation_offset(
            image,
            (best_result["center_x"], best_result["center_y"]),
            best_result["radius"]
        )

        visibility = self.calculate_board_visibility(
            image,
            (best_result["center_x"], best_result["center_y"]),
            best_result["radius_x"],
            best_result["radius_y"]
        )

        suggested_zoom = self.calculate_suggested_zoom(
            image,
            (best_result["center_x"], best_result["center_y"]),
            best_result["radius_x"],
            best_result["radius_y"]
        )

        ellipse_data = EllipseData(
            center_x=best_result["center_x"],
            center_y=best_result["center_y"],
            axis_major=float(best_result["radius_x"] * 2),
            axis_minor=float(best_result["radius_y"] * 2),
            angle=float(best_result["angle"])
        )

        if best_result["is_angled"]:
            message = f"Tabla kalibrálva szogbol! ({best_result['confidence']*100:.0f}%)"
        else:
            message = f"Tabla kalibrálva! ({best_result['confidence']*100:.0f}%)"

        if visibility < 100:
            message += f" - Tabla {visibility:.0f}% lathato"

        return CalibrationResult(
            success=True,
            center_x=best_result["center_x"],
            center_y=best_result["center_y"],
            radius=best_result["radius"],
            radius_x=best_result["radius_x"],
            radius_y=best_result["radius_y"],
            rotation_offset=rotation_offset,
            confidence=best_result["confidence"],
            method=best_result["method"],
            message=message,
            ellipse=ellipse_data,
            is_angled=best_result["is_angled"],
            suggested_zoom=suggested_zoom,
            board_visible_percent=visibility
        )
