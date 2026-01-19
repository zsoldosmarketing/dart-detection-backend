import cv2
import numpy as np
import math
from typing import Optional, Tuple
from dataclasses import dataclass

@dataclass
class CalibrationResult:
    success: bool
    center_x: Optional[int]
    center_y: Optional[int]
    radius: Optional[int]
    rotation_offset: float
    confidence: float
    method: str
    message: str
    ellipse: Optional[dict] = None
    is_angled: bool = False

DARTBOARD_SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

class AdvancedDartboardCalibration:
    def __init__(self):
        self.circle_cache = {}

    def calibrate_multi_method(self, image: np.ndarray) -> CalibrationResult:
        return self.calibrate_dartboard(image, use_advanced=True)

    def detect_ellipse_contour(self, image: np.ndarray) -> Optional[Tuple[int, int, int, dict, float]]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (7, 7), 0)

        edges = cv2.Canny(blurred, 30, 100)

        kernel = np.ones((3, 3), np.uint8)
        edges = cv2.dilate(edges, kernel, iterations=1)
        edges = cv2.erode(edges, kernel, iterations=1)

        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        height, width = image.shape[:2]
        min_area = (min(width, height) * 0.2) ** 2 * math.pi
        max_area = (min(width, height) * 0.7) ** 2 * math.pi

        best_ellipse = None
        best_score = 0

        for contour in contours:
            if len(contour) >= 5:
                area = cv2.contourArea(contour)
                if min_area <= area <= max_area:
                    try:
                        ellipse = cv2.fitEllipse(contour)
                        (cx, cy), (ma, mi), angle = ellipse

                        if ma > 0 and mi > 0 and mi > 20 and ma > 20:
                            ratio = min(ma, mi) / max(ma, mi)

                            if ratio > 0.3:
                                area_ratio = area / (math.pi * ma * mi / 4)

                                center_x_norm = abs(cx - width/2) / (width/2)
                                center_y_norm = abs(cy - height/2) / (height/2)
                                center_score = 1.0 - (center_x_norm + center_y_norm) / 2

                                score = ratio * 0.5 + area_ratio * 0.3 + center_score * 0.2

                                if score > best_score:
                                    best_score = score
                                    avg_radius = int((ma + mi) / 4)
                                    ellipse_data = {
                                        "center_x": int(cx),
                                        "center_y": int(cy),
                                        "axis_major": float(ma),
                                        "axis_minor": float(mi),
                                        "angle": float(angle),
                                        "ratio": float(ratio)
                                    }
                                    confidence = min(0.95, score * 1.2)
                                    best_ellipse = (int(cx), int(cy), avg_radius, ellipse_data, confidence)
                    except:
                        continue

        return best_ellipse

    def detect_circles_adaptive(self, image: np.ndarray, method: str = "standard") -> list:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (9, 9), 2)

        height, width = image.shape[:2]
        min_radius = int(min(width, height) * 0.15)
        max_radius = int(min(width, height) * 0.45)

        if method == "standard":
            circles = cv2.HoughCircles(
                blurred,
                cv2.HOUGH_GRADIENT,
                dp=1.2,
                minDist=int(min(width, height) * 0.5),
                param1=50,
                param2=30,
                minRadius=min_radius,
                maxRadius=max_radius
            )
        elif method == "sensitive":
            circles = cv2.HoughCircles(
                blurred,
                cv2.HOUGH_GRADIENT,
                dp=1.2,
                minDist=int(min(width, height) * 0.4),
                param1=40,
                param2=25,
                minRadius=min_radius,
                maxRadius=max_radius
            )
        elif method == "relaxed":
            circles = cv2.HoughCircles(
                blurred,
                cv2.HOUGH_GRADIENT,
                dp=1.5,
                minDist=int(min(width, height) * 0.3),
                param1=30,
                param2=20,
                minRadius=min_radius,
                maxRadius=max_radius
            )
        else:
            circles = None

        if circles is not None:
            circles = np.uint16(np.around(circles))
            return [(int(x), int(y), int(r)) for x, y, r in circles[0, :]]
        return []

    def detect_color_segmentation(self, image: np.ndarray) -> Optional[Tuple[int, int, int]]:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

        lower_red1 = np.array([0, 30, 30])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([160, 30, 30])
        upper_red2 = np.array([180, 255, 255])

        mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
        red_mask = mask1 | mask2

        lower_green = np.array([35, 30, 30])
        upper_green = np.array([85, 255, 255])
        green_mask = cv2.inRange(hsv, lower_green, upper_green)

        combined_mask = red_mask | green_mask
        kernel = np.ones((5, 5), np.uint8)
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel)
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, kernel)

        contours, _ = cv2.findContours(combined_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if not contours:
            return None

        largest_contour = max(contours, key=cv2.contourArea)

        if len(largest_contour) >= 5:
            ellipse = cv2.fitEllipse(largest_contour)
            (cx, cy), (ma, mi), _ = ellipse
            avg_radius = int((ma + mi) / 4)
            return (int(cx), int(cy), avg_radius)

        return None

    def score_detection(self, image: np.ndarray, cx: int, cy: int, radius: int) -> float:
        height, width = image.shape[:2]

        center_x_norm = abs(cx - width/2) / (width/2)
        center_y_norm = abs(cy - height/2) / (height/2)
        center_score = 1.0 - (center_x_norm + center_y_norm) / 2

        expected_radius = min(width, height) * 0.3
        size_diff = abs(radius - expected_radius) / expected_radius
        size_score = max(0, 1.0 - size_diff)

        mask = np.zeros((height, width), dtype=np.uint8)
        cv2.circle(mask, (cx, cy), radius, 255, 2)

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)

        overlap = cv2.bitwise_and(edges, mask)
        edge_score = min(1.0, np.sum(overlap > 0) / (2 * math.pi * radius) * 2)

        total_score = (center_score * 0.3 + size_score * 0.3 + edge_score * 0.4)
        return max(0.0, min(1.0, total_score))

    def detect_20_segment(self, image: np.ndarray, center: Tuple[int, int], radius: int) -> float:
        cx, cy = center
        sample_radius = int(radius * 0.9)

        angle_20 = 0
        max_contrast = 0

        for test_angle in range(0, 360, 2):
            rad = math.radians(test_angle)
            x1 = int(cx + sample_radius * math.sin(rad))
            y1 = int(cy - sample_radius * math.cos(rad))

            x2 = int(cx + sample_radius * math.sin(rad + math.radians(18)))
            y2 = int(cy - sample_radius * math.cos(rad + math.radians(18)))

            if 0 <= x1 < image.shape[1] and 0 <= y1 < image.shape[0]:
                if 0 <= x2 < image.shape[1] and 0 <= y2 < image.shape[0]:
                    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
                    val1 = gray[y1, x1]
                    val2 = gray[y2, x2]
                    contrast = abs(int(val1) - int(val2))

                    if contrast > max_contrast:
                        max_contrast = contrast
                        angle_20 = test_angle

        dartboard_20_angle = 0
        rotation_offset = (dartboard_20_angle - angle_20) % 360

        return rotation_offset

    def calibrate_dartboard(self, image: np.ndarray, use_advanced: bool = True) -> CalibrationResult:
        if image is None or image.size == 0:
            return CalibrationResult(
                success=False,
                center_x=None,
                center_y=None,
                radius=None,
                rotation_offset=0.0,
                confidence=0.0,
                method="error",
                message="Hibas kep"
            )

        height, width = image.shape[:2]
        if width < 100 or height < 100:
            return CalibrationResult(
                success=False,
                center_x=None,
                center_y=None,
                radius=None,
                rotation_offset=0.0,
                confidence=0.0,
                method="error",
                message="Tul kicsi kep"
            )

        candidates = []

        if use_advanced:
            ellipse_result = self.detect_ellipse_contour(image)
            if ellipse_result:
                cx, cy, r, ellipse_data, ellipse_conf = ellipse_result
                score = self.score_detection(image, cx, cy, r)
                final_score = (score + ellipse_conf) / 2
                candidates.append((cx, cy, r, final_score, "ellipse", ellipse_data, True))

        methods_to_try = ["standard", "sensitive", "relaxed"] if use_advanced else ["standard"]

        for method in methods_to_try:
            circles = self.detect_circles_adaptive(image, method)
            for cx, cy, r in circles:
                score = self.score_detection(image, cx, cy, r)
                candidates.append((cx, cy, r, score, f"hough_{method}", None, False))

        if use_advanced:
            color_result = self.detect_color_segmentation(image)
            if color_result:
                cx, cy, r = color_result
                score = self.score_detection(image, cx, cy, r)
                candidates.append((cx, cy, r, score, "color_seg", None, False))

        if not candidates:
            cx, cy = width // 2, height // 2
            radius = int(min(width, height) * 0.35)
            rotation_offset = 0.0

            return CalibrationResult(
                success=True,
                center_x=cx,
                center_y=cy,
                radius=radius,
                rotation_offset=rotation_offset,
                confidence=0.5,
                method="fallback_center",
                message="Tabla kozepen beallitva (50%) - Allitsd be pontosabban!",
                ellipse=None,
                is_angled=False
            )

        candidates.sort(key=lambda x: x[3], reverse=True)
        best_result = candidates[0]

        cx, cy, radius, confidence, best_method, ellipse_data, is_angled = best_result

        rotation_offset = self.detect_20_segment(image, (cx, cy), radius)

        final_confidence = max(0.5, min(0.95, confidence * 1.3))

        if is_angled:
            message = f"Tabla kalibrálva ferdeből! ({final_confidence*100:.0f}%) - Mehet a dobas!"
        else:
            message = f"Tabla kalibrálva! ({final_confidence*100:.0f}%) - Mehet a dobas!"

        return CalibrationResult(
            success=True,
            center_x=cx,
            center_y=cy,
            radius=radius,
            rotation_offset=rotation_offset,
            confidence=final_confidence,
            method=best_method,
            message=message,
            ellipse=ellipse_data,
            is_angled=is_angled
        )
