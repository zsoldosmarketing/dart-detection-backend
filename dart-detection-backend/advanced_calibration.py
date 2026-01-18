import cv2
import numpy as np
import math
from typing import Optional, Tuple
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

    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        enhanced = cv2.merge([l, a, b])
        enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
        return enhanced

    def find_dartboard_by_colors(self, image: np.ndarray) -> Optional[Tuple[int, int, int, float]]:
        enhanced = self.preprocess_image(image)
        hsv = cv2.cvtColor(enhanced, cv2.COLOR_BGR2HSV)
        height, width = image.shape[:2]

        lower_red1 = np.array([0, 70, 50])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([165, 70, 50])
        upper_red2 = np.array([180, 255, 255])

        lower_green = np.array([35, 50, 40])
        upper_green = np.array([85, 255, 255])

        mask_red1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask_red2 = cv2.inRange(hsv, lower_red2, upper_red2)
        mask_red = cv2.bitwise_or(mask_red1, mask_red2)
        mask_green = cv2.inRange(hsv, lower_green, upper_green)

        mask_colors = cv2.bitwise_or(mask_red, mask_green)

        kernel = np.ones((5, 5), np.uint8)
        mask_colors = cv2.morphologyEx(mask_colors, cv2.MORPH_CLOSE, kernel)
        mask_colors = cv2.morphologyEx(mask_colors, cv2.MORPH_OPEN, kernel)

        contours, _ = cv2.findContours(mask_colors, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if not contours:
            return None

        all_points = []
        for contour in contours:
            if cv2.contourArea(contour) > 100:
                all_points.extend(contour.reshape(-1, 2).tolist())

        if len(all_points) < 50:
            return None

        points_array = np.array(all_points)

        min_x, min_y = points_array.min(axis=0)
        max_x, max_y = points_array.max(axis=0)

        center_x = int((min_x + max_x) / 2)
        center_y = int((min_y + max_y) / 2)

        distances = np.sqrt((points_array[:, 0] - center_x)**2 + (points_array[:, 1] - center_y)**2)

        radius = int(np.percentile(distances, 95))

        confidence = 0.7
        if len(all_points) > 500:
            confidence += 0.1
        if radius > 50:
            confidence += 0.1

        return (center_x, center_y, radius, confidence)

    def find_dartboard_by_circles(self, image: np.ndarray) -> Optional[Tuple[int, int, int, float]]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (9, 9), 2)
        height, width = gray.shape

        min_radius = int(min(width, height) * 0.1)
        max_radius = int(min(width, height) * 0.45)

        circles = cv2.HoughCircles(
            blurred,
            cv2.HOUGH_GRADIENT,
            dp=1.2,
            minDist=min_radius,
            param1=100,
            param2=30,
            minRadius=min_radius,
            maxRadius=max_radius
        )

        if circles is None:
            circles = cv2.HoughCircles(
                blurred,
                cv2.HOUGH_GRADIENT,
                dp=1.5,
                minDist=min_radius // 2,
                param1=80,
                param2=25,
                minRadius=min_radius // 2,
                maxRadius=max_radius
            )

        if circles is None:
            return None

        circles = np.uint16(np.around(circles))

        enhanced = self.preprocess_image(image)
        hsv = cv2.cvtColor(enhanced, cv2.COLOR_BGR2HSV)

        lower_red1 = np.array([0, 50, 40])
        upper_red1 = np.array([12, 255, 255])
        lower_red2 = np.array([165, 50, 40])
        upper_red2 = np.array([180, 255, 255])
        lower_green = np.array([35, 40, 30])
        upper_green = np.array([85, 255, 255])

        mask_red = cv2.bitwise_or(
            cv2.inRange(hsv, lower_red1, upper_red1),
            cv2.inRange(hsv, lower_red2, upper_red2)
        )
        mask_green = cv2.inRange(hsv, lower_green, upper_green)
        mask_board = cv2.bitwise_or(mask_red, mask_green)

        best_circle = None
        best_score = 0

        for circle in circles[0]:
            cx, cy, r = int(circle[0]), int(circle[1]), int(circle[2])

            mask_circle = np.zeros((height, width), dtype=np.uint8)
            cv2.circle(mask_circle, (cx, cy), r, 255, -1)

            overlap = cv2.bitwise_and(mask_board, mask_circle)
            overlap_pixels = np.count_nonzero(overlap)
            circle_pixels = np.count_nonzero(mask_circle)

            if circle_pixels == 0:
                continue

            overlap_ratio = overlap_pixels / circle_pixels

            center_dist = math.sqrt((cx - width/2)**2 + (cy - height/2)**2)
            max_dist = math.sqrt((width/2)**2 + (height/2)**2)
            centrality = 1 - (center_dist / max_dist)

            score = overlap_ratio * 0.7 + centrality * 0.3

            if score > best_score and overlap_ratio > 0.05:
                best_score = score
                best_circle = (cx, cy, r)

        if best_circle is None:
            return None

        confidence = min(0.9, 0.5 + best_score * 0.5)
        return (best_circle[0], best_circle[1], best_circle[2], confidence)

    def find_bull_center(self, image: np.ndarray, estimated_center: Tuple[int, int], estimated_radius: int) -> Optional[Tuple[int, int]]:
        enhanced = self.preprocess_image(image)
        hsv = cv2.cvtColor(enhanced, cv2.COLOR_BGR2HSV)

        cx, cy = estimated_center
        search_radius = int(estimated_radius * 0.15)

        lower_red1 = np.array([0, 100, 80])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([165, 100, 80])
        upper_red2 = np.array([180, 255, 255])

        mask_red = cv2.bitwise_or(
            cv2.inRange(hsv, lower_red1, upper_red1),
            cv2.inRange(hsv, lower_red2, upper_red2)
        )

        height, width = image.shape[:2]
        mask_search = np.zeros((height, width), dtype=np.uint8)
        cv2.circle(mask_search, (cx, cy), search_radius, 255, -1)

        mask_bull = cv2.bitwise_and(mask_red, mask_search)

        kernel = np.ones((3, 3), np.uint8)
        mask_bull = cv2.morphologyEx(mask_bull, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(mask_bull, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if not contours:
            return None

        best_contour = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(best_contour)

        if area < 50:
            return None

        M = cv2.moments(best_contour)
        if M["m00"] == 0:
            return None

        bull_x = int(M["m10"] / M["m00"])
        bull_y = int(M["m01"] / M["m00"])

        return (bull_x, bull_y)

    def refine_radius_from_center(self, image: np.ndarray, center: Tuple[int, int], initial_radius: int) -> int:
        cx, cy = center
        enhanced = self.preprocess_image(image)
        hsv = cv2.cvtColor(enhanced, cv2.COLOR_BGR2HSV)
        height, width = image.shape[:2]

        lower_red1 = np.array([0, 50, 40])
        upper_red1 = np.array([12, 255, 255])
        lower_red2 = np.array([165, 50, 40])
        upper_red2 = np.array([180, 255, 255])
        lower_green = np.array([35, 40, 30])
        upper_green = np.array([85, 255, 255])

        mask_red = cv2.bitwise_or(
            cv2.inRange(hsv, lower_red1, upper_red1),
            cv2.inRange(hsv, lower_red2, upper_red2)
        )
        mask_green = cv2.inRange(hsv, lower_green, upper_green)
        mask_board = cv2.bitwise_or(mask_red, mask_green)

        kernel = np.ones((3, 3), np.uint8)
        mask_board = cv2.morphologyEx(mask_board, cv2.MORPH_CLOSE, kernel)

        radii_found = []
        num_angles = 36

        for i in range(num_angles):
            angle_rad = 2 * math.pi * i / num_angles

            for r in range(int(initial_radius * 1.3), int(initial_radius * 0.5), -2):
                px = int(cx + r * math.cos(angle_rad))
                py = int(cy + r * math.sin(angle_rad))

                if not (0 <= px < width and 0 <= py < height):
                    continue

                if mask_board[py, px] > 0:
                    radii_found.append(r)
                    break

        if len(radii_found) < 10:
            return initial_radius

        radii_found = sorted(radii_found)
        q1 = len(radii_found) // 4
        q3 = 3 * len(radii_found) // 4
        filtered = radii_found[q1:q3+1]

        if not filtered:
            return initial_radius

        return int(np.median(filtered))

    def detect_ellipse_shape(self, image: np.ndarray, center: Tuple[int, int], radius: int) -> Optional[EllipseData]:
        enhanced = self.preprocess_image(image)
        hsv = cv2.cvtColor(enhanced, cv2.COLOR_BGR2HSV)
        height, width = image.shape[:2]

        lower_red1 = np.array([0, 50, 40])
        upper_red1 = np.array([12, 255, 255])
        lower_red2 = np.array([165, 50, 40])
        upper_red2 = np.array([180, 255, 255])
        lower_green = np.array([35, 40, 30])
        upper_green = np.array([85, 255, 255])

        mask_red = cv2.bitwise_or(
            cv2.inRange(hsv, lower_red1, upper_red1),
            cv2.inRange(hsv, lower_red2, upper_red2)
        )
        mask_green = cv2.inRange(hsv, lower_green, upper_green)
        mask_board = cv2.bitwise_or(mask_red, mask_green)

        kernel = np.ones((7, 7), np.uint8)
        mask_board = cv2.morphologyEx(mask_board, cv2.MORPH_CLOSE, kernel)

        cx, cy = center
        edge_points = []
        num_angles = 72

        for i in range(num_angles):
            angle_rad = 2 * math.pi * i / num_angles

            for r in range(int(radius * 1.2), int(radius * 0.7), -2):
                px = int(cx + r * math.cos(angle_rad))
                py = int(cy + r * math.sin(angle_rad))

                if not (0 <= px < width and 0 <= py < height):
                    continue

                if mask_board[py, px] > 0:
                    edge_points.append([px, py])
                    break

        if len(edge_points) < 20:
            return None

        edge_array = np.array(edge_points, dtype=np.float32)

        try:
            ellipse = cv2.fitEllipse(edge_array)
            (ex, ey), (axis1, axis2), angle = ellipse

            axis_major = max(axis1, axis2) / 2
            axis_minor = min(axis1, axis2) / 2

            if axis_major == 0:
                return None

            aspect_ratio = axis_minor / axis_major

            if aspect_ratio < 0.7:
                return EllipseData(
                    center_x=int(ex),
                    center_y=int(ey),
                    axis_major=int(axis_major),
                    axis_minor=int(axis_minor),
                    angle=angle
                )
        except cv2.error:
            pass

        return None

    def calibrate_multi_method(self, image: np.ndarray) -> CalibrationResult:
        height, width = image.shape[:2]

        color_result = self.find_dartboard_by_colors(image)

        if color_result:
            cx, cy, radius, conf = color_result
        else:
            circle_result = self.find_dartboard_by_circles(image)
            if circle_result:
                cx, cy, radius, conf = circle_result
            else:
                return CalibrationResult(
                    success=False,
                    confidence=0.0,
                    method="Failed",
                    message="Nem talaltam darttablat. Probald jobb megvilagitassal."
                )

        bull_pos = self.find_bull_center(image, (cx, cy), radius)
        if bull_pos:
            cx, cy = bull_pos
            conf = min(0.95, conf + 0.1)

        refined_radius = self.refine_radius_from_center(image, (cx, cy), radius)
        if abs(refined_radius - radius) < radius * 0.3:
            radius = refined_radius

        ellipse = self.detect_ellipse_shape(image, (cx, cy), radius)
        is_angled = ellipse is not None

        if is_angled and ellipse:
            dist_to_ellipse_center = math.sqrt((cx - ellipse.center_x)**2 + (cy - ellipse.center_y)**2)
            if dist_to_ellipse_center < radius * 0.1:
                radius = ellipse.axis_major

        rotation_offset = -9.0

        method_name = "Color + Hough"
        if bull_pos:
            method_name += " + Bull"
        if is_angled:
            method_name += " + Ellipse"

        angle_info = ""
        if is_angled and ellipse:
            angle_info = f" (szogben: {ellipse.angle:.0f}deg)"

        return CalibrationResult(
            success=True,
            center_x=cx,
            center_y=cy,
            radius=radius,
            rotation_offset=rotation_offset,
            confidence=conf,
            method=method_name,
            message=f"Tabla OK! ({conf*100:.0f}%){angle_info}",
            ellipse=ellipse,
            is_angled=is_angled
        )
