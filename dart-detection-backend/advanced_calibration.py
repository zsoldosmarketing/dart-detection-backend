import cv2
import numpy as np
import math
from typing import Optional, List, Tuple, Dict
from dataclasses import dataclass
from scipy import ndimage
from skimage.feature import peak_local_max

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
        self.aruco_dict = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
        self.aruco_params = cv2.aruco.DetectorParameters()
        self.aruco_detector = cv2.aruco.ArucoDetector(self.aruco_dict, self.aruco_params)

    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        enhanced = cv2.merge([l, a, b])
        enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
        return enhanced

    def detect_with_aruco(self, image: np.ndarray) -> Optional[CalibrationResult]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        corners, ids, rejected = self.aruco_detector.detectMarkers(gray)

        if ids is None or len(ids) < 4:
            return None

        marker_centers = []
        for corner in corners:
            center = corner[0].mean(axis=0)
            marker_centers.append(center)

        marker_centers = np.array(marker_centers)
        center = marker_centers.mean(axis=0)

        distances = np.sqrt(((marker_centers - center) ** 2).sum(axis=1))
        radius = distances.mean() * 2.2

        return CalibrationResult(
            success=True,
            center_x=int(center[0]),
            center_y=int(center[1]),
            radius=int(radius),
            rotation_offset=self._detect_rotation_aruco(marker_centers, center),
            confidence=0.98,
            method="ArUco Markers",
            message="ArUco markerek alapjan kalibralt"
        )

    def _detect_rotation_aruco(self, markers: np.ndarray, center: np.ndarray) -> float:
        if len(markers) == 0:
            return -9.0

        angles = []
        for marker in markers:
            dx = marker[0] - center[0]
            dy = center[1] - marker[1]
            angle = math.degrees(math.atan2(dx, dy))
            if angle < 0:
                angle += 360
            angles.append(angle)

        angles = sorted(angles)
        if len(angles) >= 2:
            angle_diff = angles[1] - angles[0]
            expected_20_pos = 0
            offset = angles[0] - expected_20_pos
            if offset > 180:
                offset -= 360
            elif offset < -180:
                offset += 360
            return offset

        return -9.0

    def detect_with_hough_advanced(self, image: np.ndarray) -> Optional[CalibrationResult]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        blurred = cv2.GaussianBlur(gray, (9, 9), 2)

        edges = cv2.Canny(blurred, 50, 150, apertureSize=3)

        kernel = np.ones((3, 3), np.uint8)
        edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)

        height, width = gray.shape
        min_radius = int(min(width, height) * 0.20)
        max_radius = int(min(width, height) * 0.48)

        circles = cv2.HoughCircles(
            blurred,
            cv2.HOUGH_GRADIENT,
            dp=1.0,
            minDist=min_radius,
            param1=80,
            param2=35,
            minRadius=min_radius,
            maxRadius=max_radius
        )

        if circles is None:
            circles = cv2.HoughCircles(
                blurred,
                cv2.HOUGH_GRADIENT,
                dp=1.2,
                minDist=min_radius // 2,
                param1=60,
                param2=30,
                minRadius=min_radius // 2,
                maxRadius=max_radius
            )

        if circles is None:
            return None

        circles = np.uint16(np.around(circles))
        center_x, center_y = width // 2, height // 2

        best_circle = None
        best_score = -1

        for circle in circles[0]:
            cx, cy, r = circle

            dist_to_center = math.sqrt((cx - center_x)**2 + (cy - center_y)**2)
            centrality_score = 1 - (dist_to_center / max(width, height))

            size_score = r / max_radius

            edge_support = self._calculate_edge_support(edges, cx, cy, r)

            score = centrality_score * 0.3 + size_score * 0.3 + edge_support * 0.4

            if score > best_score:
                best_score = score
                best_circle = (cx, cy, r)

        if best_circle is None:
            return None

        cx, cy, r = best_circle

        return CalibrationResult(
            success=True,
            center_x=int(cx),
            center_y=int(cy),
            radius=int(r),
            rotation_offset=-9.0,
            confidence=min(0.85, best_score),
            method="Advanced Hough Transform",
            message=f"Kor detektalas (pontossag: {best_score*100:.1f}%)"
        )

    def _calculate_edge_support(self, edges: np.ndarray, cx: int, cy: int, radius: int) -> float:
        mask = np.zeros_like(edges)
        cv2.circle(mask, (cx, cy), radius, 255, 2)

        overlap = cv2.bitwise_and(edges, mask)
        support = np.sum(overlap > 0) / (2 * math.pi * radius)

        return min(1.0, support / 10)

    def detect_with_color_advanced(self, image: np.ndarray) -> Optional[CalibrationResult]:
        enhanced = self.preprocess_image(image)
        hsv = cv2.cvtColor(enhanced, cv2.COLOR_BGR2HSV)

        lower_red1 = np.array([0, 60, 40])
        upper_red1 = np.array([12, 255, 255])
        lower_red2 = np.array([168, 60, 40])
        upper_red2 = np.array([180, 255, 255])

        lower_green = np.array([35, 50, 40])
        upper_green = np.array([85, 255, 255])

        lower_black = np.array([0, 0, 0])
        upper_black = np.array([180, 255, 60])

        lower_cream = np.array([15, 20, 150])
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

        kernel = np.ones((9, 9), np.uint8)
        mask_board = cv2.morphologyEx(mask_board, cv2.MORPH_CLOSE, kernel)
        mask_board = cv2.morphologyEx(mask_board, cv2.MORPH_OPEN, kernel)

        contours, _ = cv2.findContours(mask_board, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if not contours:
            return None

        largest_contour = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest_contour)

        if area < 1500:
            return None

        (x, y), radius = cv2.minEnclosingCircle(largest_contour)

        ellipse_data = None
        is_angled = False

        if len(largest_contour) >= 5:
            ellipse = cv2.fitEllipse(largest_contour)
            (ex, ey), (axis1, axis2), angle = ellipse
            axis_major = max(axis1, axis2)
            axis_minor = min(axis1, axis2)

            aspect_ratio = axis_minor / axis_major if axis_major > 0 else 1

            if aspect_ratio < 0.85:
                is_angled = True
                ellipse_data = EllipseData(
                    center_x=int(ex),
                    center_y=int(ey),
                    axis_major=int(axis_major / 2),
                    axis_minor=int(axis_minor / 2),
                    angle=angle
                )
                radius = axis_major / 2

        M = cv2.moments(largest_contour)
        if M["m00"] > 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
        else:
            cx, cy = int(x), int(y)

        if ellipse_data:
            cx = ellipse_data.center_x
            cy = ellipse_data.center_y

        circle_area = math.pi * radius * radius
        circularity = area / circle_area if circle_area > 0 else 0

        confidence = min(0.88, circularity * 0.5 + 0.35)

        if is_angled:
            confidence = min(0.92, confidence + 0.1)

        angle_info = ""
        if is_angled and ellipse_data:
            angle_info = f" (szogben: {ellipse_data.angle:.0f}°)"

        return CalibrationResult(
            success=True,
            center_x=cx,
            center_y=cy,
            radius=int(radius),
            rotation_offset=-9.0,
            confidence=confidence,
            method="Advanced Color Detection",
            message=f"Szin alapu detektalas{angle_info}",
            ellipse=ellipse_data,
            is_angled=is_angled
        )

    def detect_with_ellipse(self, image: np.ndarray) -> Optional[CalibrationResult]:
        enhanced = self.preprocess_image(image)
        gray = cv2.cvtColor(enhanced, cv2.COLOR_BGR2GRAY)

        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 30, 100)

        kernel = np.ones((3, 3), np.uint8)
        edges = cv2.dilate(edges, kernel, iterations=2)
        edges = cv2.erode(edges, kernel, iterations=1)

        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if not contours:
            return None

        height, width = gray.shape
        min_area = (min(width, height) * 0.15) ** 2 * math.pi
        max_area = (min(width, height) * 0.5) ** 2 * math.pi

        best_ellipse = None
        best_score = 0

        for contour in contours:
            if len(contour) < 5:
                continue

            area = cv2.contourArea(contour)
            if area < min_area or area > max_area:
                continue

            try:
                ellipse = cv2.fitEllipse(contour)
                (ex, ey), (axis1, axis2), angle = ellipse

                axis_major = max(axis1, axis2)
                axis_minor = min(axis1, axis2)

                if axis_major < 50 or axis_minor < 30:
                    continue

                aspect_ratio = axis_minor / axis_major
                if aspect_ratio < 0.3 or aspect_ratio > 1.0:
                    continue

                ellipse_area = math.pi * (axis1 / 2) * (axis2 / 2)
                fill_ratio = area / ellipse_area if ellipse_area > 0 else 0

                dist_to_center = math.sqrt((ex - width/2)**2 + (ey - height/2)**2)
                centrality = 1 - (dist_to_center / max(width, height))

                score = fill_ratio * 0.4 + centrality * 0.3 + (axis_major / max(width, height)) * 0.3

                if score > best_score:
                    best_score = score
                    best_ellipse = ellipse

            except cv2.error:
                continue

        if best_ellipse is None:
            return None

        (ex, ey), (axis1, axis2), angle = best_ellipse
        axis_major = max(axis1, axis2)
        axis_minor = min(axis1, axis2)

        ellipse_data = EllipseData(
            center_x=int(ex),
            center_y=int(ey),
            axis_major=int(axis_major / 2),
            axis_minor=int(axis_minor / 2),
            angle=angle
        )

        aspect_ratio = axis_minor / axis_major
        is_angled = aspect_ratio < 0.85

        return CalibrationResult(
            success=True,
            center_x=int(ex),
            center_y=int(ey),
            radius=int(axis_major / 2),
            rotation_offset=-9.0,
            confidence=min(0.85, best_score),
            method="Ellipse Detection",
            message=f"Ellipszis detektalas (arany: {aspect_ratio:.2f})",
            ellipse=ellipse_data,
            is_angled=is_angled
        )

    def detect_bull_precise(self, image: np.ndarray, approx_center: Tuple[int, int],
                           search_radius: int) -> Optional[Tuple[int, int, float]]:
        x, y = approx_center
        h, w = image.shape[:2]

        x1 = max(0, x - search_radius)
        y1 = max(0, y - search_radius)
        x2 = min(w, x + search_radius)
        y2 = min(h, y + search_radius)

        roi = image[y1:y2, x1:x2]
        if roi.size == 0:
            return None

        hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

        lower_red1 = np.array([0, 120, 100])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([170, 120, 100])
        upper_red2 = np.array([180, 255, 255])

        mask_red1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask_red2 = cv2.inRange(hsv, lower_red2, upper_red2)
        mask_bull = cv2.bitwise_or(mask_red1, mask_red2)

        kernel = np.ones((3, 3), np.uint8)
        mask_bull = cv2.morphologyEx(mask_bull, cv2.MORPH_CLOSE, kernel)
        mask_bull = cv2.morphologyEx(mask_bull, cv2.MORPH_OPEN, kernel)

        contours, _ = cv2.findContours(mask_bull, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        best_contour = None
        best_score = 0

        for contour in contours:
            area = cv2.contourArea(contour)
            if area < 100:
                continue

            M = cv2.moments(contour)
            if M["m00"] == 0:
                continue

            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])

            (_, _), radius = cv2.minEnclosingCircle(contour)
            if radius < 8:
                continue

            circle_area = math.pi * radius * radius
            circularity = area / circle_area if circle_area > 0 else 0

            dist_to_center = math.sqrt((cx - search_radius)**2 + (cy - search_radius)**2)
            centrality = 1 - (dist_to_center / search_radius) if search_radius > 0 else 0

            score = circularity * 0.5 + centrality * 0.5

            if score > best_score and circularity > 0.6:
                best_score = score
                best_contour = contour

        if best_contour is None:
            return None

        M = cv2.moments(best_contour)
        if M["m00"] == 0:
            return None

        cx = int(M["m10"] / M["m00"]) + x1
        cy = int(M["m01"] / M["m00"]) + y1

        return (cx, cy, min(0.95, best_score))

    def detect_rotation_advanced(self, image: np.ndarray, center: Tuple[int, int],
                                radius: int) -> Tuple[float, float]:
        cx, cy = center

        enhanced = self.preprocess_image(image)
        hsv = cv2.cvtColor(enhanced, cv2.COLOR_BGR2HSV)

        lower_red1 = np.array([0, 80, 50])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([170, 80, 50])
        upper_red2 = np.array([180, 255, 255])

        mask_red1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask_red2 = cv2.inRange(hsv, lower_red2, upper_red2)
        mask_red = cv2.bitwise_or(mask_red1, mask_red2)

        sample_radius = int(radius * 0.75)

        red_intensity = []
        for angle_deg in range(0, 360):
            angle_rad = math.radians(angle_deg)
            px = int(cx + sample_radius * math.sin(angle_rad))
            py = int(cy - sample_radius * math.cos(angle_rad))

            if 0 <= px < mask_red.shape[1] and 0 <= py < mask_red.shape[0]:
                intensity = mask_red[py, px]
                red_intensity.append(intensity)
            else:
                red_intensity.append(0)

        red_intensity = np.array(red_intensity)
        smoothed = ndimage.gaussian_filter1d(red_intensity, sigma=3, mode='wrap')

        peaks = []
        threshold = smoothed.max() * 0.5
        in_peak = False
        peak_start = 0

        for i in range(len(smoothed)):
            if smoothed[i] > threshold and not in_peak:
                in_peak = True
                peak_start = i
            elif smoothed[i] <= threshold and in_peak:
                peak_center = (peak_start + i - 1) / 2
                peaks.append(peak_center)
                in_peak = False

        if in_peak:
            peak_center = (peak_start + len(smoothed) - 1) / 2
            peaks.append(peak_center)

        if len(peaks) < 10:
            return -9.0, 0.3

        if len(peaks) >= 2:
            expected_20_position = 0
            closest_peak = min(peaks, key=lambda p: min(
                abs(p - expected_20_position),
                abs(p - expected_20_position - 360),
                abs(p - expected_20_position + 360)
            ))

            offset = closest_peak - expected_20_position
            if offset > 180:
                offset -= 360
            elif offset < -180:
                offset += 360

            confidence = min(0.9, len(peaks) / 20 * 0.8 + 0.1)
            return offset, confidence

        return -9.0, 0.3

    def calibrate_multi_method(self, image: np.ndarray) -> CalibrationResult:
        results = []

        aruco_result = self.detect_with_aruco(image)
        if aruco_result and aruco_result.success:
            results.append(aruco_result)

        hough_result = self.detect_with_hough_advanced(image)
        if hough_result and hough_result.success:
            results.append(hough_result)

        color_result = self.detect_with_color_advanced(image)
        if color_result and color_result.success:
            results.append(color_result)

        ellipse_result = self.detect_with_ellipse(image)
        if ellipse_result and ellipse_result.success:
            results.append(ellipse_result)

        if not results:
            return CalibrationResult(
                success=False,
                confidence=0.0,
                method="Failed",
                message="Nem talaltam darttablat. Probald mas szogbol vagy jobb megvilagitassal."
            )

        angled_results = [r for r in results if r.is_angled and r.ellipse]
        has_angled = len(angled_results) > 0

        if has_angled:
            best_angled = max(angled_results, key=lambda r: r.confidence)
            result = best_angled
            result.confidence = min(0.95, result.confidence + 0.05)
            result.message = f"Szogbol kalibralt ({result.method})"
        elif len(results) == 1:
            result = results[0]
        else:
            weighted_cx = sum(r.center_x * r.confidence for r in results)
            weighted_cy = sum(r.center_y * r.confidence for r in results)
            weighted_radius = sum(r.radius * r.confidence for r in results)
            total_confidence = sum(r.confidence for r in results)

            final_cx = int(weighted_cx / total_confidence)
            final_cy = int(weighted_cy / total_confidence)
            final_radius = int(weighted_radius / total_confidence)

            methods = ", ".join(set(r.method for r in results))

            best_ellipse = None
            for r in results:
                if r.ellipse:
                    best_ellipse = r.ellipse
                    break

            result = CalibrationResult(
                success=True,
                center_x=final_cx,
                center_y=final_cy,
                radius=final_radius,
                rotation_offset=-9.0,
                confidence=min(0.95, total_confidence / len(results)),
                method=f"Multi-method ({methods})",
                message=f"Tobbszoros modszerrel kalibralt ({len(results)} modszer)",
                ellipse=best_ellipse,
                is_angled=any(r.is_angled for r in results)
            )

        bull_result = self.detect_bull_precise(
            image,
            (result.center_x, result.center_y),
            result.radius // 3
        )

        if bull_result:
            cx, cy, bull_confidence = bull_result
            result.center_x = cx
            result.center_y = cy
            result.confidence = min(0.98, result.confidence + bull_confidence * 0.1)
            result.message += " + pontos bull kozeppont"

        rotation, rot_confidence = self.detect_rotation_advanced(
            image,
            (result.center_x, result.center_y),
            result.radius
        )
        result.rotation_offset = rotation
        result.confidence = min(0.99, result.confidence * 0.8 + rot_confidence * 0.2)

        return result
