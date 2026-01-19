from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import cv2
import numpy as np
from PIL import Image
import io
import math
from typing import Optional, List, Tuple, Dict
from pydantic import BaseModel
from advanced_calibration import AdvancedDartboardCalibration, CalibrationResult as AdvCalibResult
from advanced_detection import AdvancedDartDetection, DartDetection, DetectionResult as AdvDetResult
from image_preprocessing import ImagePreprocessor

app = FastAPI(
    title="Advanced Dart Detection API",
    description="High-precision dart detection with automatic calibration",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DARTBOARD_SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

RADIUS_RATIOS = {
    "double_bull": 0.032,
    "single_bull": 0.080,
    "inner_triple": 0.582,
    "outer_triple": 0.629,
    "inner_double": 0.953,
    "outer_double": 1.0,
}

calibration = {
    "center_x": None,
    "center_y": None,
    "radius": None,
    "rotation_offset": -9.0,
    "auto_calibrated": False,
}

calibrator = AdvancedDartboardCalibration()
detector = None

class CalibrationData(BaseModel):
    center_x: int
    center_y: int
    radius: int
    rotation_offset: Optional[float] = -9

class SingleDartResult(BaseModel):
    score: str
    confidence: float
    position: Optional[dict] = None

class MultiDartResult(BaseModel):
    darts: List[dict]
    total_confidence: float
    method: str
    message: str

class EllipseDataModel(BaseModel):
    center_x: int
    center_y: int
    axis_major: float
    axis_minor: float
    angle: float

class AutoCalibrationResult(BaseModel):
    success: bool
    center_x: Optional[int] = None
    center_y: Optional[int] = None
    radius: Optional[int] = None
    radius_x: Optional[int] = None
    radius_y: Optional[int] = None
    rotation_offset: Optional[float] = None
    confidence: float = 0.0
    method: str = ""
    message: str = ""
    ellipse: Optional[EllipseDataModel] = None
    is_angled: bool = False
    suggested_zoom: float = 1.0
    board_visible_percent: float = 100.0


def detect_dartboard_circles(image: np.ndarray) -> List[Tuple[int, int, int]]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (9, 9), 2)

    height, width = gray.shape
    min_radius = int(min(width, height) * 0.08)
    max_radius = int(min(width, height) * 0.48)

    all_circles = []

    param_sets = [
        (1.0, 80, 35),
        (1.2, 100, 40),
        (1.5, 80, 30),
        (1.0, 60, 25),
        (2.0, 50, 25),
        (1.2, 50, 20),
        (1.5, 40, 20),
        (1.0, 40, 18),
        (0.8, 50, 25),
    ]

    for dp, p1, p2 in param_sets:
        circles = cv2.HoughCircles(
            blurred,
            cv2.HOUGH_GRADIENT,
            dp=dp,
            minDist=min_radius,
            param1=p1,
            param2=p2,
            minRadius=min_radius,
            maxRadius=max_radius
        )

        if circles is not None:
            for c in circles[0]:
                all_circles.append((int(c[0]), int(c[1]), int(c[2])))

    if not all_circles:
        return []

    return all_circles


def detect_dartboard_by_color(image: np.ndarray) -> Optional[Tuple[int, int, int]]:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    lower_red1 = np.array([0, 40, 30])
    upper_red1 = np.array([15, 255, 255])
    lower_red2 = np.array([165, 40, 30])
    upper_red2 = np.array([180, 255, 255])

    lower_green = np.array([30, 40, 30])
    upper_green = np.array([90, 255, 255])

    lower_black = np.array([0, 0, 0])
    upper_black = np.array([180, 80, 80])

    lower_white = np.array([0, 0, 180])
    upper_white = np.array([180, 40, 255])

    mask_red1 = cv2.inRange(hsv, lower_red1, upper_red1)
    mask_red2 = cv2.inRange(hsv, lower_red2, upper_red2)
    mask_red = cv2.bitwise_or(mask_red1, mask_red2)
    mask_green = cv2.inRange(hsv, lower_green, upper_green)
    mask_black = cv2.inRange(hsv, lower_black, upper_black)
    mask_white = cv2.inRange(hsv, lower_white, upper_white)

    mask_board = cv2.bitwise_or(mask_red, mask_green)
    mask_board = cv2.bitwise_or(mask_board, mask_black)
    mask_board = cv2.bitwise_or(mask_board, mask_white)

    kernel = np.ones((7, 7), np.uint8)
    mask_board = cv2.morphologyEx(mask_board, cv2.MORPH_CLOSE, kernel)
    mask_board = cv2.morphologyEx(mask_board, cv2.MORPH_OPEN, kernel)

    contours, _ = cv2.findContours(mask_board, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return None

    largest_contour = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(largest_contour)

    if area < 500:
        return None

    (x, y), radius = cv2.minEnclosingCircle(largest_contour)

    circle_area = math.pi * radius * radius
    circularity = area / circle_area if circle_area > 0 else 0

    if circularity < 0.15:
        return None

    return (int(x), int(y), int(radius))


def detect_bull_center(image: np.ndarray, approx_center: Tuple[int, int], search_radius: int) -> Optional[Tuple[int, int]]:
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

    lower_red1 = np.array([0, 100, 100])
    upper_red1 = np.array([10, 255, 255])
    lower_red2 = np.array([170, 100, 100])
    upper_red2 = np.array([180, 255, 255])

    mask_red1 = cv2.inRange(hsv, lower_red1, upper_red1)
    mask_red2 = cv2.inRange(hsv, lower_red2, upper_red2)
    mask_bull = cv2.bitwise_or(mask_red1, mask_red2)

    kernel = np.ones((3, 3), np.uint8)
    mask_bull = cv2.morphologyEx(mask_bull, cv2.MORPH_OPEN, kernel)

    contours, _ = cv2.findContours(mask_bull, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    best_contour = None
    best_score = 0

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < 50:
            continue

        (cx, cy), radius = cv2.minEnclosingCircle(contour)
        if radius < 5:
            continue

        circle_area = math.pi * radius * radius
        circularity = area / circle_area if circle_area > 0 else 0

        dist_to_center = math.sqrt((cx - search_radius)**2 + (cy - search_radius)**2)
        centrality = 1 - (dist_to_center / search_radius) if search_radius > 0 else 0

        score = circularity * 0.6 + centrality * 0.4

        if score > best_score:
            best_score = score
            best_contour = contour

    if best_contour is None:
        return None

    M = cv2.moments(best_contour)
    if M["m00"] == 0:
        return None

    cx = int(M["m10"] / M["m00"]) + x1
    cy = int(M["m01"] / M["m00"]) + y1

    return (cx, cy)


def detect_rotation_offset(image: np.ndarray, center: Tuple[int, int], radius: int) -> float:
    cx, cy = center

    sample_radius = int(radius * 0.75)

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    lower_red1 = np.array([0, 70, 50])
    upper_red1 = np.array([10, 255, 255])
    lower_red2 = np.array([170, 70, 50])
    upper_red2 = np.array([180, 255, 255])

    mask_red1 = cv2.inRange(hsv, lower_red1, upper_red1)
    mask_red2 = cv2.inRange(hsv, lower_red2, upper_red2)
    mask_red = cv2.bitwise_or(mask_red1, mask_red2)

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

    sector_centers = []
    in_red = False
    start_angle = None

    for i, angle in enumerate(red_angles):
        if not in_red:
            in_red = True
            start_angle = angle
        elif i > 0 and red_angles[i] - red_angles[i-1] > 10:
            end_angle = red_angles[i-1]
            center_angle = (start_angle + end_angle) / 2
            sector_centers.append(center_angle)
            start_angle = angle

    if in_red and start_angle is not None:
        end_angle = red_angles[-1]
        center_angle = (start_angle + end_angle) / 2
        sector_centers.append(center_angle)

    if len(sector_centers) >= 2:
        expected_20_position = 0

        closest_angle = min(sector_centers, key=lambda a: min(abs(a - expected_20_position), abs(a - expected_20_position - 360), abs(a - expected_20_position + 360)))

        offset = closest_angle - expected_20_position
        if offset > 180:
            offset -= 360
        elif offset < -180:
            offset += 360

        return offset

    return -9.0


def auto_calibrate_dartboard(image: np.ndarray) -> AutoCalibrationResult:
    height, width = image.shape[:2]

    circles = detect_dartboard_circles(image)

    color_result = detect_dartboard_by_color(image)

    best_center = None
    best_radius = None
    confidence = 0.0

    if circles and color_result:
        color_x, color_y, color_r = color_result

        best_match = None
        best_dist = float('inf')

        for cx, cy, r in circles:
            dist = math.sqrt((cx - color_x)**2 + (cy - color_y)**2)
            if dist < best_dist and dist < r * 0.8:
                best_dist = dist
                best_match = (cx, cy, r)

        if best_match:
            best_center = ((best_match[0] + color_x) // 2, (best_match[1] + color_y) // 2)
            best_radius = (best_match[2] + color_r) // 2
            confidence = 0.9
        else:
            best_center = (color_x, color_y)
            best_radius = color_r
            confidence = 0.7
    elif circles:
        center_x, center_y = width // 2, height // 2
        closest = min(circles, key=lambda c: math.sqrt((c[0] - center_x)**2 + (c[1] - center_y)**2))
        best_center = (closest[0], closest[1])
        best_radius = closest[2]
        confidence = 0.6
    elif color_result:
        best_center = (color_result[0], color_result[1])
        best_radius = color_result[2]
        confidence = 0.5
    else:
        best_center = (width // 2, height // 2)
        best_radius = min(width, height) // 3
        confidence = 0.35
        return AutoCalibrationResult(
            success=True,
            center_x=best_center[0],
            center_y=best_center[1],
            radius=best_radius,
            rotation_offset=-9.0,
            confidence=confidence,
            message="Tabla kozepre allitva automatikusan. Finomhangold ha szukseges!"
        )

    bull_center = detect_bull_center(image, best_center, best_radius // 3)
    if bull_center:
        best_center = bull_center
        confidence = min(confidence + 0.1, 1.0)

    rotation = detect_rotation_offset(image, best_center, best_radius)

    return AutoCalibrationResult(
        success=True,
        center_x=best_center[0],
        center_y=best_center[1],
        radius=best_radius,
        rotation_offset=rotation,
        confidence=confidence,
        message=f"Tabla felismerve! Biztossag: {confidence*100:.0f}%"
    )


def get_segment_from_angle(angle: float) -> int:
    adjusted_angle = (angle + calibration["rotation_offset"]) % 360
    segment_index = int(adjusted_angle / 18) % 20
    return DARTBOARD_SEGMENTS[segment_index]


def get_score_from_position(x: int, y: int) -> tuple[str, float]:
    if calibration["center_x"] is None:
        return "UNCALIBRATED", 0.0

    cx, cy, r = calibration["center_x"], calibration["center_y"], calibration["radius"]

    dx = x - cx
    dy = cy - y
    distance = math.sqrt(dx * dx + dy * dy)
    distance_ratio = distance / r

    if distance_ratio > RADIUS_RATIOS["outer_double"] * 1.1:
        return "MISS", 0.9

    angle = math.degrees(math.atan2(dx, dy))
    if angle < 0:
        angle += 360

    if distance_ratio <= RADIUS_RATIOS["double_bull"]:
        return "D-BULL", 0.95
    elif distance_ratio <= RADIUS_RATIOS["single_bull"]:
        return "BULL", 0.92

    segment = get_segment_from_angle(angle)

    if RADIUS_RATIOS["inner_triple"] <= distance_ratio <= RADIUS_RATIOS["outer_triple"]:
        return f"T{segment}", 0.88
    elif RADIUS_RATIOS["inner_double"] <= distance_ratio <= RADIUS_RATIOS["outer_double"]:
        return f"D{segment}", 0.88
    else:
        return f"{segment}", 0.85


def detect_dart_tip(image: np.ndarray, reference: Optional[np.ndarray] = None) -> Optional[tuple[int, int, float]]:
    if reference is not None:
        diff = cv2.absdiff(image, reference)
        gray_diff = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray_diff, 30, 255, cv2.THRESH_BINARY)

        kernel = np.ones((5, 5), np.uint8)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)

        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if contours:
            largest = max(contours, key=cv2.contourArea)
            area = cv2.contourArea(largest)

            if area > 100:
                points = largest.reshape(-1, 2)

                if calibration["center_x"] is not None:
                    cx, cy = calibration["center_x"], calibration["center_y"]
                    distances = np.sqrt((points[:, 0] - cx)**2 + (points[:, 1] - cy)**2)
                    tip_idx = np.argmin(distances)
                    tip_x, tip_y = points[tip_idx]
                    confidence = min(0.95, 0.5 + (area / 5000))
                    return int(tip_x), int(tip_y), confidence

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    lower_metal = np.array([0, 0, 150])
    upper_metal = np.array([180, 50, 255])
    metal_mask = cv2.inRange(hsv, lower_metal, upper_metal)

    kernel = np.ones((3, 3), np.uint8)
    metal_mask = cv2.morphologyEx(metal_mask, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(metal_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    dart_candidates = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if 50 < area < 2000:
            x, y, w, h = cv2.boundingRect(contour)
            aspect_ratio = max(w, h) / min(w, h) if min(w, h) > 0 else 0

            if aspect_ratio > 1.5:
                M = cv2.moments(contour)
                if M["m00"] > 0:
                    cx = int(M["m10"] / M["m00"])
                    cy = int(M["m01"] / M["m00"])
                    dart_candidates.append((cx, cy, area))

    if dart_candidates:
        best = max(dart_candidates, key=lambda x: x[2])
        confidence = min(0.8, 0.4 + (best[2] / 2000))
        return best[0], best[1], confidence

    return None


reference_image: Optional[np.ndarray] = None


@app.get("/")
async def root():
    return {"status": "ok", "message": "Dart Detection API is running"}


@app.get("/health")
async def health():
    return {"status": "healthy", "calibrated": calibration["center_x"] is not None}


@app.post("/calibrate")
async def calibrate(data: CalibrationData):
    calibration["center_x"] = data.center_x
    calibration["center_y"] = data.center_y
    calibration["radius"] = data.radius
    calibration["rotation_offset"] = data.rotation_offset
    calibration["auto_calibrated"] = False

    return {
        "status": "calibrated",
        "calibration": calibration
    }


@app.post("/auto-calibrate", response_model=AutoCalibrationResult)
async def auto_calibrate(
    file: UploadFile = File(...),
    use_advanced: bool = Query(True, description="Use advanced multi-method calibration")
):
    global detector
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    preprocessed = ImagePreprocessor.adaptive_preprocessing(image)

    if use_advanced:
        result = calibrator.calibrate_multi_method(preprocessed)

        if not result.success:
            result = calibrator.calibrate_multi_method(image)

        if not result.success:
            simple_result = auto_calibrate_dartboard(preprocessed)
            if simple_result.success:
                from advanced_calibration import CalibrationResult as AdvCalibResult
                result = AdvCalibResult(
                    success=True,
                    center_x=simple_result.center_x,
                    center_y=simple_result.center_y,
                    radius=simple_result.radius,
                    rotation_offset=simple_result.rotation_offset,
                    confidence=simple_result.confidence,
                    method="fallback_simple",
                    message=simple_result.message
                )

        if not result.success:
            simple_result = auto_calibrate_dartboard(image)
            if simple_result.success:
                from advanced_calibration import CalibrationResult as AdvCalibResult
                result = AdvCalibResult(
                    success=True,
                    center_x=simple_result.center_x,
                    center_y=simple_result.center_y,
                    radius=simple_result.radius,
                    rotation_offset=simple_result.rotation_offset,
                    confidence=simple_result.confidence,
                    method="fallback_simple_raw",
                    message=simple_result.message
                )

        if not result.success:
            height, width = image.shape[:2]
            center_x = width // 2
            center_y = height // 2
            radius = min(width, height) // 3

            from advanced_calibration import CalibrationResult as AdvCalibResult
            result = AdvCalibResult(
                success=True,
                center_x=center_x,
                center_y=center_y,
                radius=radius,
                rotation_offset=-9.0,
                confidence=0.4,
                method="center_fallback",
                message="Tabla kozepre igazitva. Allitsd pontosabban ha szukseges!"
            )

        if result.success:
            calibration["center_x"] = result.center_x
            calibration["center_y"] = result.center_y
            calibration["radius"] = result.radius
            calibration["rotation_offset"] = result.rotation_offset
            calibration["auto_calibrated"] = True

            detector = AdvancedDartDetection(calibration)

        ellipse_model = None
        if result.ellipse:
            ellipse_model = EllipseDataModel(
                center_x=result.ellipse.center_x,
                center_y=result.ellipse.center_y,
                axis_major=result.ellipse.axis_major,
                axis_minor=result.ellipse.axis_minor,
                angle=result.ellipse.angle
            )

        radius_x = getattr(result, 'radius_x', result.radius)
        radius_y = getattr(result, 'radius_y', result.radius)
        suggested_zoom = getattr(result, 'suggested_zoom', 1.0)
        board_visible = getattr(result, 'board_visible_percent', 100.0)

        return AutoCalibrationResult(
            success=result.success,
            center_x=result.center_x,
            center_y=result.center_y,
            radius=result.radius,
            radius_x=radius_x,
            radius_y=radius_y,
            rotation_offset=result.rotation_offset,
            confidence=result.confidence,
            method=result.method,
            message=result.message,
            ellipse=ellipse_model,
            is_angled=result.is_angled,
            suggested_zoom=suggested_zoom,
            board_visible_percent=board_visible
        )
    else:
        result = auto_calibrate_dartboard(image)

        if result.success:
            calibration["center_x"] = result.center_x
            calibration["center_y"] = result.center_y
            calibration["radius"] = result.radius
            calibration["rotation_offset"] = result.rotation_offset
            calibration["auto_calibrated"] = True

            detector = AdvancedDartDetection(calibration)

        return result


@app.post("/set-reference")
async def set_reference(file: UploadFile = File(...)):
    global reference_image

    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    reference_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if reference_image is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    return {"status": "reference_set", "shape": reference_image.shape[:2]}


@app.post("/detect", response_model=SingleDartResult)
async def detect_dart(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    result = detect_dart_tip(image, reference_image)

    if result is None:
        return SingleDartResult(
            score="MISS",
            confidence=0.3,
            position=None
        )

    x, y, detection_confidence = result
    score, score_confidence = get_score_from_position(x, y)

    return SingleDartResult(
        score=score,
        confidence=detection_confidence * score_confidence,
        position={"x": x, "y": y}
    )


@app.post("/detect-multiple")
async def detect_multiple_darts(
    current: UploadFile = File(...),
    previous: Optional[UploadFile] = File(None)
):
    current_contents = await current.read()
    current_arr = np.frombuffer(current_contents, np.uint8)
    current_image = cv2.imdecode(current_arr, cv2.IMREAD_COLOR)

    if current_image is None:
        raise HTTPException(status_code=400, detail="Invalid current image")

    prev_image = None
    if previous:
        prev_contents = await previous.read()
        prev_arr = np.frombuffer(prev_contents, np.uint8)
        prev_image = cv2.imdecode(prev_arr, cv2.IMREAD_COLOR)

    ref = prev_image if prev_image is not None else reference_image
    result = detect_dart_tip(current_image, ref)

    if result is None:
        return SingleDartResult(
            score="MISS",
            confidence=0.3,
            position=None
        )

    x, y, detection_confidence = result
    score, score_confidence = get_score_from_position(x, y)

    return SingleDartResult(
        score=score,
        confidence=detection_confidence * score_confidence,
        position={"x": x, "y": y}
    )


@app.post("/detect-advanced", response_model=MultiDartResult)
async def detect_advanced(
    current: UploadFile = File(...),
    reference: Optional[UploadFile] = File(None),
    preprocess: bool = Query(True, description="Apply image preprocessing")
):
    global detector

    if detector is None:
        if calibration["center_x"] is None:
            raise HTTPException(
                status_code=400,
                detail="Elobb kalibrald a tablat az /auto-calibrate endpoint-tal"
            )
        detector = AdvancedDartDetection(calibration)

    current_contents = await current.read()
    current_arr = np.frombuffer(current_contents, np.uint8)
    current_image = cv2.imdecode(current_arr, cv2.IMREAD_COLOR)

    if current_image is None:
        raise HTTPException(status_code=400, detail="Invalid current image")

    if preprocess:
        current_image = ImagePreprocessor.adaptive_preprocessing(current_image)

    ref_image = None
    if reference:
        ref_contents = await reference.read()
        ref_arr = np.frombuffer(ref_contents, np.uint8)
        ref_image = cv2.imdecode(ref_arr, cv2.IMREAD_COLOR)

        if ref_image is not None and preprocess:
            ref_image = ImagePreprocessor.adaptive_preprocessing(ref_image)
    elif reference_image is not None:
        ref_image = reference_image

    result = detector.detect_multiple_darts(current_image, ref_image)

    darts_dict = [
        {
            "x": dart.x,
            "y": dart.y,
            "score": dart.score,
            "confidence": dart.confidence,
            "dart_id": dart.dart_id
        }
        for dart in result.darts
    ]

    return MultiDartResult(
        darts=darts_dict,
        total_confidence=result.total_confidence,
        method=result.method,
        message=result.message
    )


@app.post("/preprocess-image")
async def preprocess_image(
    file: UploadFile = File(...),
    method: str = Query("adaptive", description="Preprocessing method: adaptive, full, enhance, denoise")
):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    if method == "adaptive":
        processed = ImagePreprocessor.adaptive_preprocessing(image)
    elif method == "full":
        processed = ImagePreprocessor.full_preprocessing_pipeline(image)
    elif method == "enhance":
        processed = ImagePreprocessor.enhance_lighting(image)
    elif method == "denoise":
        processed = ImagePreprocessor.reduce_noise(image)
    else:
        raise HTTPException(status_code=400, detail="Invalid preprocessing method")

    _, buffer = cv2.imencode('.jpg', processed, [cv2.IMWRITE_JPEG_QUALITY, 95])

    return JSONResponse(
        content={
            "status": "processed",
            "method": method,
            "image_base64": buffer.tobytes().hex()
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
