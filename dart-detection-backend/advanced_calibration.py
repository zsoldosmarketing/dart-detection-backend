import cv2
import numpy as np
import math
from typing import Optional, List, Tuple
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

    def find_bull_center(self, image: np.ndarray) -> Optional[Tuple[int, int, float]]:
        enhanced = self.preprocess_image(image)
        hsv = cv2.cvtColor(enhanced, cv2.COLOR_BGR2HSV)

        lower_red1 = np.array([0, 100, 80])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([165, 100, 80])
        upper_red2 = np.array([180, 255, 255])

        mask_red1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask_red2 = cv2.inRange(hsv, lower_red2, upper_red2)
        mask_red = cv2.bitwise_or(mask_red1, mask_red2)

        kernel = np.ones((5, 5), np.uint8)
        mask_red = cv2.morphologyEx(mask_red, cv2.MORPH_CLOSE, kernel)
        mask_red = cv2.morphologyEx(mask_red, cv2.MORPH_OPEN, kernel)

        contours, _ = cv2.findContours(mask_red, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        height, width = image.shape[:2]
        center_x, center_y = width // 2, height // 2

        best_contour = None
        best_score = 0

        for contour in contours:
            area = cv2.contourArea(contour)
            if area < 200 or area > width * height * 0.05:
                continue

            (cx, cy), radius = cv2.minEnclosingCircle(contour)

            if radius < 10 or radius > min(width, height) * 0.1:
                continue

            circle_area = math.pi * radius * radius
            circularity = area / circle_area if circle_area > 0 else 0

            if circularity < 0.5:
                continue

            dist_to_center = math.sqrt((cx - center_x)**2 + (cy - center_y)**2)
            max_dist = math.sqrt(center_x**2 + center_y**2)
            centrality = 1 - (dist_to_center / max_dist)

            score = circularity * 0.6 + centrality * 0.4

            if score > best_score:
                best_score = score
                best_contour = contour

        if best_contour is None:
            return None

        M = cv2.moments(best_contour)
        if M["m00"] == 0:
            return None

        cx = int(M["m10"] / M["m00"])
        cy = int(M["m01"] / M["m00"])

        return (cx, cy, best_score)

    def find_dartboard_boundary(self, image: np.ndarray, center: Tuple[int, int]) -> Optional[int]:
        cx, cy = center
        enhanced = self.preprocess_image(image)
        hsv = cv2.cvtColor(enhanced, cv2.COLOR_BGR2HSV)
        gray = cv2.cvtColor(enhanced, cv2.COLOR_BGR2GRAY)

        lower_red1 = np.array([0, 60, 50])
        upper_red1 = np.array([12, 255, 255])
        lower_red2 = np.array([165, 60, 50])
        upper_red2 = np.array([180, 255, 255])

        lower_green = np.array([35, 50, 40])
        upper_green = np.array([85, 255, 255])

        lower_black = np.array([0, 0, 0])
        upper_black = np.array([180, 100, 60])

        lower_cream = np.array([10, 20, 140])
        upper_cream = np.array([35, 100, 255])

        mask_red1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask_red2 = cv2.inRange(hsv, lower_red2, upper_red2)
        mask_red = cv2.bitwise_or(mask_red1, mask_red2)
        mask_green = cv2.inRange(hsv, lower_green, upper_green)
        mask_black = cv2.inRange(hsv, lower_black, upper_black)
        mask_cream = cv2.inRange(hsv, lower_cream, upper_cream)

        mask_board = cv2.bitwise_or(mask_red, mask_green)
        mask_board = cv2.bitwise_or(mask_board, mask_black)
        mask_board = cv2.bitwise_or(mask_board, mask_cream)

        kernel = np.ones((7, 7), np.uint8)
        mask_board = cv2.morphologyEx(mask_board, cv2.MORPH_CLOSE, kernel)
        mask_board = cv2.morphologyEx(mask_board, cv2.MORPH_OPEN, kernel)

        height, width = image.shape[:2]
        max_possible_radius = int(min(width, height) * 0.48)
        min_possible_radius = int(min(width, height) * 0.08)

        radii_samples = []
        num_angles = 72

        for angle_deg in range(0, 360, 360 // num_angles):
            angle_rad = math.radians(angle_deg)

            found_boundary = False
            for r in range(max_possible_radius, min_possible_radius, -3):
                px = int(cx + r * math.cos(angle_rad))
                py = int(cy + r * math.sin(angle_rad))

                if not (0 <= px < width and 0 <= py < height):
                    continue

                if mask_board[py, px] > 0:
                    for inner_r in range(r, min_possible_radius, -2):
                        inner_px = int(cx + inner_r * math.cos(angle_rad))
                        inner_py = int(cy + inner_r * math.sin(angle_rad))

                        if not (0 <= inner_px < width and 0 <= inner_py < height):
                            continue

                        if mask_board[inner_py, inner_px] > 0:
                            radii_samples.append(inner_r)
                            found_boundary = True
                            break

                    if found_boundary:
                        break

        if len(radii_samples) < 20:
            return self.find_radius_by_hough(image, center)

        radii_samples = sorted(radii_samples)
        q1_idx = len(radii_samples) // 4
        q3_idx = 3 * len(radii_samples) // 4
        filtered_radii = radii_samples[q1_idx:q3_idx]

        if not filtered_radii:
            filtered_radii = radii_samples

        radius = int(np.median(filtered_radii))

        return radius

    def find_radius_by_hough(self, image: np.ndarray, center: Tuple[int, int]) -> Optional[int]:
        cx, cy = center
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
            param1=80,
            param2=40,
            minRadius=min_radius,
            maxRadius=max_radius
        )

        if circles is None:
            circles = cv2.HoughCircles(
                blurred,
                cv2.HOUGH_GRADIENT,
                dp=1.5,
                minDist=min_radius // 2,
                param1=60,
                param2=30,
                minRadius=min_radius // 2,
                maxRadius=max_radius
            )

        if circles is None:
            return None

        circles = np.uint16(np.around(circles))

        best_circle = None
        best_dist = float('inf')

        for circle in circles[0]:
            circle_cx, circle_cy, r = circle
            dist = math.sqrt((circle_cx - cx)**2 + (circle_cy - cy)**2)

            if dist < best_dist and dist < r * 0.3:
                best_dist = dist
                best_circle = r

        return int(best_circle) if best_circle else None

    def find_outer_double_ring(self, image: np.ndarray, center: Tuple[int, int], estimated_radius: int) -> Optional[int]:
        cx, cy = center
        enhanced = self.preprocess_image(image)
        hsv = cv2.cvtColor(enhanced, cv2.COLOR_BGR2HSV)

        lower_red1 = np.array([0, 80, 60])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([165, 80, 60])
        upper_red2 = np.array([180, 255, 255])

        lower_green = np.array([35, 60, 50])
        upper_green = np.array([85, 255, 255])

        mask_red1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask_red2 = cv2.inRange(hsv, lower_red2, upper_red2)
        mask_red = cv2.bitwise_or(mask_red1, mask_red2)
        mask_green = cv2.inRange(hsv, lower_green, upper_green)

        mask_double = cv2.bitwise_or(mask_red, mask_green)

        height, width = image.shape[:2]

        search_start = int(estimated_radius * 0.85)
        search_end = int(estimated_radius * 1.15)

        best_radius = estimated_radius
        best_count = 0

        for test_radius in range(search_start, search_end, 2):
            count = 0
            samples = 0

            for angle_deg in range(0, 360, 5):
                angle_rad = math.radians(angle_deg)
                px = int(cx + test_radius * math.cos(angle_rad))
                py = int(cy + test_radius * math.sin(angle_rad))

                if 0 <= px < width and 0 <= py < height:
                    samples += 1
                    if mask_double[py, px] > 0:
                        count += 1

            if count > best_count:
                best_count = count
                best_radius = test_radius

        if best_count > 20:
            return best_radius

        return estimated_radius

    def detect_rotation_offset(self, image: np.ndarray, center: Tuple[int, int], radius: int) -> float:
        cx, cy = center
        enhanced = self.preprocess_image(image)
        hsv = cv2.cvtColor(enhanced, cv2.COLOR_BGR2HSV)

        lower_red1 = np.array([0, 70, 50])
        upper_red1 = np.array([12, 255, 255])
        lower_red2 = np.array([165, 70, 50])
        upper_red2 = np.array([180, 255, 255])

        mask_red1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask_red2 = cv2.inRange(hsv, lower_red2, upper_red2)
        mask_red = cv2.bitwise_or(mask_red1, mask_red2)

        sample_radius = int(radius * 0.75)
        height, width = image.shape[:2]

        red_sectors = []
        in_red = False
        start_angle = 0

        for angle_deg in range(0, 361):
            angle_rad = math.radians(angle_deg)
            px = int(cx + sample_radius * math.sin(angle_rad))
            py = int(cy - sample_radius * math.cos(angle_rad))

            is_red = False
            if 0 <= px < width and 0 <= py < height:
                is_red = mask_red[py, px] > 0

            if is_red and not in_red:
                in_red = True
                start_angle = angle_deg
            elif not is_red and in_red:
                in_red = False
                end_angle = angle_deg
                sector_center = (start_angle + end_angle) / 2
                sector_width = end_angle - start_angle
                if 10 < sector_width < 30:
                    red_sectors.append(sector_center)

        if len(red_sectors) < 5:
            return -9.0

        expected_20_position = 0

        best_offset = -9.0
        min_error = float('inf')

        for test_offset in range(-30, 30):
            error = 0
            for sector in red_sectors:
                adjusted = (sector - test_offset) % 360
                segment_idx = int(adjusted / 18) % 20
                segment = DARTBOARD_SEGMENTS[segment_idx]

                if segment in [20, 18, 13, 10, 2, 3, 7, 8, 14, 12]:
                    error += 1

            if error < min_error:
                min_error = error
                best_offset = test_offset

        return float(best_offset)

    def detect_ellipse(self, image: np.ndarray, center: Tuple[int, int], radius: int) -> Optional[EllipseData]:
        enhanced = self.preprocess_image(image)
        hsv = cv2.cvtColor(enhanced, cv2.COLOR_BGR2HSV)

        lower_red1 = np.array([0, 50, 40])
        upper_red1 = np.array([15, 255, 255])
        lower_red2 = np.array([160, 50, 40])
        upper_red2 = np.array([180, 255, 255])
        lower_green = np.array([30, 40, 30])
        upper_green = np.array([90, 255, 255])

        mask_red1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask_red2 = cv2.inRange(hsv, lower_red2, upper_red2)
        mask_red = cv2.bitwise_or(mask_red1, mask_red2)
        mask_green = cv2.inRange(hsv, lower_green, upper_green)
        mask_board = cv2.bitwise_or(mask_red, mask_green)

        kernel = np.ones((9, 9), np.uint8)
        mask_board = cv2.morphologyEx(mask_board, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(mask_board, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if not contours:
            return None

        cx, cy = center
        best_contour = None
        best_dist = float('inf')

        for contour in contours:
            M = cv2.moments(contour)
            if M["m00"] == 0:
                continue

            cont_cx = int(M["m10"] / M["m00"])
            cont_cy = int(M["m01"] / M["m00"])
            dist = math.sqrt((cont_cx - cx)**2 + (cont_cy - cy)**2)

            area = cv2.contourArea(contour)
            if area > 5000 and dist < best_dist:
                best_dist = dist
                best_contour = contour

        if best_contour is None or len(best_contour) < 5:
            return None

        try:
            ellipse = cv2.fitEllipse(best_contour)
            (ex, ey), (axis1, axis2), angle = ellipse

            axis_major = max(axis1, axis2) / 2
            axis_minor = min(axis1, axis2) / 2

            aspect_ratio = axis_minor / axis_major if axis_major > 0 else 1

            if aspect_ratio < 0.85:
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

        bull_result = self.find_bull_center(image)

        if bull_result is None:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            blurred = cv2.GaussianBlur(gray, (9, 9), 2)

            circles = cv2.HoughCircles(
                blurred,
                cv2.HOUGH_GRADIENT,
                dp=1.2,
                minDist=int(min(width, height) * 0.3),
                param1=80,
                param2=40,
                minRadius=int(min(width, height) * 0.15),
                maxRadius=int(min(width, height) * 0.45)
            )

            if circles is not None:
                circles = np.uint16(np.around(circles))
                center_x, center_y = width // 2, height // 2

                best_circle = min(
                    circles[0],
                    key=lambda c: math.sqrt((c[0] - center_x)**2 + (c[1] - center_y)**2)
                )

                cx, cy = int(best_circle[0]), int(best_circle[1])
                estimated_radius = int(best_circle[2])
            else:
                return CalibrationResult(
                    success=False,
                    confidence=0.0,
                    method="Failed",
                    message="Nem talaltam darttablat. Probald jobb megvilagitassal."
                )
        else:
            cx, cy, bull_confidence = bull_result
            estimated_radius = None

        if estimated_radius is None:
            estimated_radius = self.find_dartboard_boundary(image, (cx, cy))

        if estimated_radius is None:
            estimated_radius = int(min(width, height) * 0.25)
            confidence = 0.4
        else:
            confidence = 0.75

        final_radius = self.find_outer_double_ring(image, (cx, cy), estimated_radius)
        if final_radius:
            confidence = min(0.9, confidence + 0.1)
        else:
            final_radius = estimated_radius

        ellipse = self.detect_ellipse(image, (cx, cy), final_radius)
        is_angled = ellipse is not None

        if is_angled and ellipse:
            cx = ellipse.center_x
            cy = ellipse.center_y
            final_radius = ellipse.axis_major
            confidence = min(0.92, confidence + 0.05)

        rotation_offset = self.detect_rotation_offset(image, (cx, cy), final_radius)

        if rotation_offset != -9.0:
            confidence = min(0.95, confidence + 0.05)

        angle_info = ""
        if is_angled and ellipse:
            angle_info = f" (szogben: {ellipse.angle:.0f}deg)"

        return CalibrationResult(
            success=True,
            center_x=cx,
            center_y=cy,
            radius=final_radius,
            rotation_offset=rotation_offset,
            confidence=confidence,
            method="Multi-method Detection",
            message=f"Tabla OK! ({confidence*100:.0f}%){angle_info}",
            ellipse=ellipse,
            is_angled=is_angled
        )
