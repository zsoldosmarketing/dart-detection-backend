from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import cv2
import numpy as np
from PIL import Image
import io
import math
import base64
from typing import Optional, List, Tuple, Dict, Any
from pydantic import BaseModel
import json

from image_preprocessing import ImagePreprocessor
from advanced_calibration import AdvancedDartboardCalibration, CalibrationResult
from advanced_detection import AdvancedDartDetection
from roboflow_detection import (
    detect_dart_tip_roboflow,
    detect_board_roboflow,
    detect_dart_in_canonical_roboflow,
    is_available as roboflow_available,
)

app = FastAPI(
    title="Dart Detection API v4",
    description="Advanced board detection with perspective correction for side-angle cameras",
    version="4.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DARTBOARD_SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

CANONICAL_SIZE = 800
CANONICAL_CENTER = CANONICAL_SIZE // 2
CANONICAL_RADIUS = 380

RADIUS_RATIOS = {
    "double_bull": 0.032,
    "single_bull": 0.080,
    "inner_triple": 0.582,
    "outer_triple": 0.629,
    "inner_double": 0.953,
    "outer_double": 1.0,
}

calibrator = AdvancedDartboardCalibration()
preprocessor = ImagePreprocessor()

session_data: Dict[str, Any] = {
    "homography": None,
    "inverse_homography": None,
    "ellipse": None,
    "board_found": False,
    "reference_canonical": None,
    "rotation_offset": -9.0,
    "calibration_result": None,
    "is_angled": False,
    "reference_raw": None,
}


class BoardDetectResponse(BaseModel):
    board_found: bool
    confidence: float
    ellipse: Optional[Dict] = None
    homography: Optional[List[List[float]]] = None
    overlay_points: Optional[List[List[float]]] = None
    bull_center: Optional[List[float]] = None
    canonical_preview: Optional[str] = None
    debug_contour: Optional[str] = None
    message: str = ""
    is_angled: bool = False
    rotation_offset: float = -9.0
    method: str = ""


class ThrowScoreResponse(BaseModel):
    label: str
    score: int
    confidence: float
    decision: str
    tip_canonical: Optional[List[int]] = None
    tip_original: Optional[List[int]] = None
    debug: Optional[Dict] = None
    message: str = ""


def image_to_base64(img: np.ndarray, quality: int = 80) -> str:
    _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return f"data:image/jpeg;base64,{base64.b64encode(buffer).decode()}"


def preprocess_image(image: np.ndarray) -> np.ndarray:
    return preprocessor.adaptive_preprocessing(image)


def find_dartboard_advanced(image: np.ndarray) -> Tuple[Optional[CalibrationResult], np.ndarray]:
    processed = preprocess_image(image)
    result = calibrator.calibrate_multi_method(processed)

    if not result.success:
        result_raw = calibrator.calibrate_multi_method(image)
        if result_raw.success and result_raw.confidence > result.confidence:
            result = result_raw

    return result, processed


def compute_homography_from_calibration(cal: CalibrationResult, image_shape: Tuple, target_size: int = CANONICAL_SIZE) -> Tuple[Optional[np.ndarray], Optional[np.ndarray]]:
    if not cal.success or cal.center_x is None:
        return None, None

    cx = cal.center_x
    cy = cal.center_y
    rx = cal.radius_x or cal.radius
    ry = cal.radius_y or cal.radius

    angle = 0.0
    if cal.ellipse:
        angle = cal.ellipse.angle

    num_points = 24
    src_points = []
    dst_points = []

    target_center = target_size // 2
    target_radius = int(target_size * 0.475)

    angle_rad = math.radians(angle)

    for i in range(num_points):
        theta = 2 * math.pi * i / num_points

        x_ellipse = rx * math.cos(theta)
        y_ellipse = ry * math.sin(theta)

        x_rot = x_ellipse * math.cos(angle_rad) - y_ellipse * math.sin(angle_rad)
        y_rot = x_ellipse * math.sin(angle_rad) + y_ellipse * math.cos(angle_rad)

        src_x = cx + x_rot
        src_y = cy + y_rot
        src_points.append([src_x, src_y])

        dst_x = target_center + target_radius * math.cos(theta)
        dst_y = target_center + target_radius * math.sin(theta)
        dst_points.append([dst_x, dst_y])

    src_points.append([float(cx), float(cy)])
    dst_points.append([float(target_center), float(target_center)])

    if cal.is_angled:
        for ratio in [0.5, 0.75]:
            for i in range(0, num_points, 3):
                theta = 2 * math.pi * i / num_points

                x_e = rx * ratio * math.cos(theta)
                y_e = ry * ratio * math.sin(theta)

                x_r = x_e * math.cos(angle_rad) - y_e * math.sin(angle_rad)
                y_r = x_e * math.sin(angle_rad) + y_e * math.cos(angle_rad)

                src_points.append([cx + x_r, cy + y_r])
                dst_points.append([
                    target_center + target_radius * ratio * math.cos(theta),
                    target_center + target_radius * ratio * math.sin(theta)
                ])

    src_pts = np.array(src_points, dtype=np.float32)
    dst_pts = np.array(dst_points, dtype=np.float32)

    try:
        H, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 3.0)
    except cv2.error:
        H = None

    if H is None:
        try:
            H = cv2.getPerspectiveTransform(src_pts[:4], dst_pts[:4])
        except cv2.error:
            return None, None

    try:
        H_inv = np.linalg.inv(H)
    except np.linalg.LinAlgError:
        H_inv = None

    return H, H_inv


def generate_overlay_points(cal: CalibrationResult, num_points: int = 64) -> List[List[float]]:
    if not cal.success or cal.center_x is None:
        return []

    cx = cal.center_x
    cy = cal.center_y
    rx = cal.radius_x or cal.radius
    ry = cal.radius_y or cal.radius

    angle = 0.0
    if cal.ellipse:
        angle = cal.ellipse.angle

    points = []
    angle_rad = math.radians(angle)

    for i in range(num_points):
        theta = 2 * math.pi * i / num_points

        x_e = rx * math.cos(theta)
        y_e = ry * math.sin(theta)

        x_rot = x_e * math.cos(angle_rad) - y_e * math.sin(angle_rad)
        y_rot = x_e * math.sin(angle_rad) + y_e * math.cos(angle_rad)

        points.append([cx + x_rot, cy + y_rot])

    return points


def warp_image(image: np.ndarray, H: np.ndarray, size: int = CANONICAL_SIZE) -> np.ndarray:
    return cv2.warpPerspective(image, H, (size, size))


def detect_dart_in_canonical(before: np.ndarray, after: np.ndarray) -> Tuple[Optional[Tuple[int, int]], float, np.ndarray, np.ndarray]:
    before_proc = cv2.GaussianBlur(before, (3, 3), 0)
    after_proc = cv2.GaussianBlur(after, (3, 3), 0)

    diff = cv2.absdiff(after_proc, before_proc)
    gray_diff = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)

    _, thresh = cv2.threshold(gray_diff, 20, 255, cv2.THRESH_BINARY)

    kernel_small = np.ones((3, 3), np.uint8)
    kernel_med = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel_med)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_small)

    board_mask = np.zeros_like(mask)
    cv2.circle(board_mask, (CANONICAL_CENTER, CANONICAL_CENTER), CANONICAL_RADIUS + 15, 255, -1)
    mask = cv2.bitwise_and(mask, board_mask)

    total_change = cv2.countNonZero(mask)
    board_area = math.pi * (CANONICAL_RADIUS + 15) ** 2
    change_ratio = total_change / board_area

    if change_ratio > 0.15:
        return None, 0.0, diff, mask

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return None, 0.0, diff, mask

    valid_contours = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < 80:
            continue
        if area > 30000:
            continue

        x, y, w, h = cv2.boundingRect(contour)
        aspect = max(w, h) / (min(w, h) + 1)
        if aspect > 8.0:
            continue

        valid_contours.append((contour, area))

    if not valid_contours:
        return None, 0.0, diff, mask

    valid_contours.sort(key=lambda x: x[1], reverse=True)

    best_tip = None
    best_confidence = 0.0

    for contour, area in valid_contours[:3]:
        points = contour.reshape(-1, 2)
        distances = np.sqrt((points[:, 0] - CANONICAL_CENTER) ** 2 + (points[:, 1] - CANONICAL_CENTER) ** 2)
        tip_idx = np.argmin(distances)
        tip_x, tip_y = points[tip_idx]

        tip_dist = distances[tip_idx]
        if tip_dist > CANONICAL_RADIUS + 10:
            continue

        perimeter = cv2.arcLength(contour, True)
        circularity = 4 * math.pi * area / (perimeter * perimeter) if perimeter > 0 else 0

        x, y, w, h = cv2.boundingRect(contour)
        aspect = max(w, h) / (min(w, h) + 1)

        conf = 0.3
        conf += min(0.2, area / 3000)
        conf += min(0.15, circularity * 0.2)
        if 1.5 < aspect < 4.0:
            conf += 0.1
        if tip_dist < CANONICAL_RADIUS * 0.9:
            conf += 0.1

        if conf > best_confidence:
            best_confidence = conf
            best_tip = (int(tip_x), int(tip_y))

    if best_tip is None:
        return None, 0.0, diff, mask

    best_confidence = min(0.95, best_confidence)

    return best_tip, best_confidence, diff, mask


def detect_dart_advanced(before: np.ndarray, after: np.ndarray, calibration_data: Dict) -> Tuple[Optional[Tuple[int, int]], float, str, np.ndarray, np.ndarray]:
    detector = AdvancedDartDetection(calibration_data)
    result = detector.detect_multiple_darts(after, before)

    diff = cv2.absdiff(after, before)
    gray_diff = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
    _, mask = cv2.threshold(gray_diff, 20, 255, cv2.THRESH_BINARY)

    if not result.darts:
        return None, 0.0, "none", diff, mask

    best_dart = result.darts[0]

    if not detector.validate_detection(best_dart):
        return None, 0.0, "invalid", diff, mask

    return (best_dart.x, best_dart.y), best_dart.confidence, best_dart.score, diff, mask


def get_score_from_canonical_position(x: int, y: int, rotation_offset: float = -9.0) -> Tuple[str, int]:
    dx = x - CANONICAL_CENTER
    dy = CANONICAL_CENTER - y
    distance = math.sqrt(dx * dx + dy * dy)
    distance_ratio = distance / CANONICAL_RADIUS

    if distance_ratio > 1.03:
        return "MISS", 0

    angle = math.degrees(math.atan2(dx, dy))
    if angle < 0:
        angle += 360

    if distance_ratio <= RADIUS_RATIOS["double_bull"]:
        return "D-BULL", 50
    elif distance_ratio <= RADIUS_RATIOS["single_bull"]:
        return "BULL", 25

    adjusted_angle = (angle + rotation_offset) % 360
    segment_index = int(adjusted_angle / 18) % 20
    segment = DARTBOARD_SEGMENTS[segment_index]

    if RADIUS_RATIOS["inner_triple"] <= distance_ratio <= RADIUS_RATIOS["outer_triple"]:
        return f"T{segment}", segment * 3
    elif RADIUS_RATIOS["inner_double"] <= distance_ratio <= RADIUS_RATIOS["outer_double"]:
        return f"D{segment}", segment * 2
    else:
        return f"{segment}", segment


@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "Dart Detection API v4 - Advanced side-angle camera support",
        "version": "4.0.0"
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "board_found": session_data["board_found"],
        "has_homography": session_data["homography"] is not None,
        "is_angled": session_data.get("is_angled", False),
        "roboflow_enabled": roboflow_available(),
    }


@app.post("/board/detect", response_model=BoardDetectResponse)
async def board_detect(image: UploadFile = File(...)):
    global session_data

    contents = await image.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    max_dim = 1280
    h, w = img.shape[:2]
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    if roboflow_available():
        rf_board = detect_board_roboflow(img, confidence_threshold=0.40)
        if rf_board and rf_board["confidence"] > 0.50:
            print(f"[Roboflow] Board detected at ({rf_board['cx']}, {rf_board['cy']}) conf={rf_board['confidence']:.2f}")

    cal_result, processed = find_dartboard_advanced(img)

    if not cal_result.success:
        return BoardDetectResponse(
            board_found=False,
            confidence=cal_result.confidence,
            message=cal_result.message,
            method=cal_result.method
        )

    H, H_inv = compute_homography_from_calibration(cal_result, img.shape)

    if H is None:
        return BoardDetectResponse(
            board_found=False,
            confidence=0.0,
            message="Could not compute homography from calibration"
        )

    canonical = warp_image(img, H, CANONICAL_SIZE)

    session_data["homography"] = H
    session_data["inverse_homography"] = H_inv
    session_data["board_found"] = True
    session_data["reference_canonical"] = canonical.copy()
    session_data["reference_raw"] = img.copy()
    session_data["rotation_offset"] = cal_result.rotation_offset
    session_data["calibration_result"] = cal_result
    session_data["is_angled"] = cal_result.is_angled

    ellipse_data = None
    if cal_result.ellipse:
        ellipse_data = {
            "cx": float(cal_result.center_x),
            "cy": float(cal_result.center_y),
            "a": float(cal_result.radius_x or cal_result.radius),
            "b": float(cal_result.radius_y or cal_result.radius),
            "angle": float(cal_result.ellipse.angle)
        }
        session_data["ellipse"] = (
            (float(cal_result.center_x), float(cal_result.center_y)),
            (float((cal_result.radius_x or cal_result.radius) * 2),
             float((cal_result.radius_y or cal_result.radius) * 2)),
            float(cal_result.ellipse.angle)
        )
    else:
        r = cal_result.radius or 100
        ellipse_data = {
            "cx": float(cal_result.center_x),
            "cy": float(cal_result.center_y),
            "a": float(r),
            "b": float(r),
            "angle": 0.0
        }
        session_data["ellipse"] = (
            (float(cal_result.center_x), float(cal_result.center_y)),
            (float(r * 2), float(r * 2)),
            0.0
        )

    overlay_outer = generate_overlay_points(cal_result, 64)
    confidence = min(0.95, cal_result.confidence)

    return BoardDetectResponse(
        board_found=True,
        confidence=confidence,
        ellipse=ellipse_data,
        homography=H.tolist(),
        overlay_points=overlay_outer,
        bull_center=[float(cal_result.center_x), float(cal_result.center_y)],
        canonical_preview=image_to_base64(canonical, 70),
        message=cal_result.message,
        is_angled=cal_result.is_angled,
        rotation_offset=cal_result.rotation_offset,
        method=cal_result.method
    )


@app.post("/throw/score", response_model=ThrowScoreResponse)
async def throw_score(
    before: UploadFile = File(...),
    after: UploadFile = File(...),
    homography: Optional[str] = Form(None)
):
    global session_data

    H = None
    if homography:
        try:
            H = np.array(json.loads(homography), dtype=np.float32)
        except (json.JSONDecodeError, ValueError):
            pass

    if H is None:
        H = session_data.get("homography")

    if H is None:
        raise HTTPException(
            status_code=400,
            detail="No homography available. Call /board/detect first."
        )

    before_contents = await before.read()
    after_contents = await after.read()

    before_arr = np.frombuffer(before_contents, np.uint8)
    after_arr = np.frombuffer(after_contents, np.uint8)

    before_img = cv2.imdecode(before_arr, cv2.IMREAD_COLOR)
    after_img = cv2.imdecode(after_arr, cv2.IMREAD_COLOR)

    if before_img is None or after_img is None:
        raise HTTPException(status_code=400, detail="Invalid image(s)")

    max_dim = 1280
    for arr in [before_img, after_img]:
        h, w = arr.shape[:2]
        if max(h, w) > max_dim:
            scale = max_dim / max(h, w)
            arr = cv2.resize(arr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    before_canonical = warp_image(before_img, H, CANONICAL_SIZE)
    after_canonical = warp_image(after_img, H, CANONICAL_SIZE)

    rotation_offset = session_data.get("rotation_offset", -9.0)
    detection_method = "cv_diff"
    tip = None
    confidence = 0.0

    if roboflow_available():
        rf_tip, rf_conf = detect_dart_in_canonical_roboflow(
            before_canonical, after_canonical, confidence_threshold=0.35
        )
        if rf_tip is not None and rf_conf >= 0.35:
            tip = rf_tip
            confidence = rf_conf
            detection_method = "roboflow"
            print(f"[Roboflow] Dart tip at canonical {tip} conf={confidence:.2f}")

    if tip is None:
        tip, confidence, diff_img, mask_img = detect_dart_in_canonical(before_canonical, after_canonical)
        detection_method = "cv_diff"
    else:
        diff_img = cv2.absdiff(after_canonical, before_canonical)
        mask_img = cv2.cvtColor(cv2.cvtColor(diff_img, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)
        _, mask_gray = cv2.threshold(cv2.cvtColor(diff_img, cv2.COLOR_BGR2GRAY), 20, 255, cv2.THRESH_BINARY)
        mask_img = mask_gray

    if tip is None:
        cal = session_data.get("calibration_result")
        if cal and cal.success:
            cal_data = {
                "center_x": cal.center_x,
                "center_y": cal.center_y,
                "radius": cal.radius,
                "rotation_offset": cal.rotation_offset
            }
            raw_tip, raw_conf, raw_label, _, _ = detect_dart_advanced(
                before_img, after_img, cal_data
            )
            if raw_tip is not None and raw_conf > 0.4:
                tip_h = np.array([raw_tip[0], raw_tip[1], 1.0], dtype=np.float32)
                tip_canonical = H @ tip_h
                tip_canonical = tip_canonical / tip_canonical[2]
                tip = (int(tip_canonical[0]), int(tip_canonical[1]))
                confidence = raw_conf * 0.85

    if tip is None:
        return ThrowScoreResponse(
            label="MISS",
            score=0,
            confidence=0.2,
            decision="ASSIST",
            message="No dart detected. Manual input recommended.",
            debug={
                "diff_preview": image_to_base64(diff_img, 70),
                "mask_preview": image_to_base64(cv2.cvtColor(mask_img, cv2.COLOR_GRAY2BGR), 70),
                "canonical_after": image_to_base64(after_canonical, 70)
            }
        )

    label, score_value = get_score_from_canonical_position(tip[0], tip[1], rotation_offset)

    tip_original = None
    H_inv = session_data.get("inverse_homography")
    if H_inv is not None:
        try:
            tip_homogeneous = np.array([tip[0], tip[1], 1.0])
            tip_back = H_inv @ tip_homogeneous
            tip_back = tip_back / tip_back[2]
            tip_original = [int(tip_back[0]), int(tip_back[1])]
        except Exception:
            pass

    if confidence >= 0.70:
        decision = "AUTO"
    elif confidence >= 0.45:
        decision = "ASSIST"
    else:
        decision = "RETRY"

    debug_canonical = after_canonical.copy()
    cv2.circle(debug_canonical, tip, 8, (0, 255, 0), 2)
    cv2.circle(debug_canonical, (CANONICAL_CENTER, CANONICAL_CENTER), 5, (255, 0, 0), -1)
    cv2.circle(debug_canonical, (CANONICAL_CENTER, CANONICAL_CENTER), CANONICAL_RADIUS, (255, 255, 0), 1)

    return ThrowScoreResponse(
        label=label,
        score=score_value,
        confidence=confidence,
        decision=decision,
        tip_canonical=list(tip),
        tip_original=tip_original,
        message=f"Detected {label} ({score_value} pts) [{confidence * 100:.0f}%] via {detection_method}",
        debug={
            "diff_preview": image_to_base64(diff_img, 70),
            "mask_preview": image_to_base64(cv2.cvtColor(mask_img, cv2.COLOR_GRAY2BGR), 70),
            "canonical_preview": image_to_base64(debug_canonical, 70)
        }
    )


@app.post("/set-reference")
async def set_reference(image: UploadFile = File(...)):
    global session_data

    if session_data.get("homography") is None:
        raise HTTPException(
            status_code=400,
            detail="No homography available. Call /board/detect first."
        )

    contents = await image.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    H = session_data["homography"]
    canonical = warp_image(img, H, CANONICAL_SIZE)
    session_data["reference_canonical"] = canonical
    session_data["reference_raw"] = img.copy()

    return {
        "status": "reference_set",
        "canonical_preview": image_to_base64(canonical, 70)
    }


@app.get("/session/status")
async def session_status():
    cal = session_data.get("calibration_result")
    return {
        "board_found": session_data["board_found"],
        "has_homography": session_data["homography"] is not None,
        "has_reference": session_data["reference_canonical"] is not None,
        "is_angled": session_data.get("is_angled", False),
        "rotation_offset": session_data.get("rotation_offset", -9.0),
        "method": cal.method if cal else None,
        "ellipse": {
            "cx": session_data["ellipse"][0][0],
            "cy": session_data["ellipse"][0][1],
            "a": session_data["ellipse"][1][0] / 2,
            "b": session_data["ellipse"][1][1] / 2,
            "angle": session_data["ellipse"][2]
        } if session_data.get("ellipse") else None
    }


@app.post("/reset")
async def reset_session():
    global session_data
    session_data = {
        "homography": None,
        "inverse_homography": None,
        "ellipse": None,
        "board_found": False,
        "reference_canonical": None,
        "rotation_offset": -9.0,
        "calibration_result": None,
        "is_angled": False,
        "reference_raw": None,
    }
    return {"status": "reset", "message": "Session cleared"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
