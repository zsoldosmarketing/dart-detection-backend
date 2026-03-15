from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import io
import math
import base64
from typing import Optional, List, Tuple, Dict, Any
from pydantic import BaseModel
import json
import os

from image_preprocessing import ImagePreprocessor
from advanced_calibration import AdvancedDartboardCalibration, CalibrationResult
from advanced_detection import AdvancedDartDetection

try:
    from yolov8_detection import (
        detect_dart_tip_yolo,
        detect_board_yolo,
        detect_dart_in_canonical_yolo,
        is_available as yolo_available,
    )
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    def yolo_available(): return False

app = FastAPI(
    title="Dart Detection API v5",
    description="Precision dart detection with YOLOv8 + OpenCV sub-pixel accuracy",
    version="5.0.0"
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
    tip_canonical: Optional[List[float]] = None
    tip_original: Optional[List[float]] = None
    debug: Optional[Dict] = None
    message: str = ""


def image_to_base64(img: np.ndarray, quality: int = 85) -> str:
    _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return f"data:image/jpeg;base64,{base64.b64encode(buffer).decode()}"


def resize_for_processing(img: np.ndarray, max_dim: int = 1280) -> Tuple[np.ndarray, float]:
    h, w = img.shape[:2]
    scale = 1.0
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return img, scale


def compute_homography_from_calibration(
    cal: CalibrationResult,
    target_size: int = CANONICAL_SIZE
) -> Tuple[Optional[np.ndarray], Optional[np.ndarray]]:
    if not cal.success or cal.center_x is None:
        return None, None

    cx = float(cal.center_x)
    cy = float(cal.center_y)
    rx = float(cal.radius_x or cal.radius)
    ry = float(cal.radius_y or cal.radius)
    angle = float(cal.ellipse.angle) if cal.ellipse else 0.0

    target_center = target_size / 2.0
    target_radius = target_size * 0.475

    angle_rad = math.radians(angle)
    cos_a = math.cos(angle_rad)
    sin_a = math.sin(angle_rad)

    num_ring_points = 32
    src_pts = []
    dst_pts = []

    for i in range(num_ring_points):
        theta = 2 * math.pi * i / num_ring_points
        xe = rx * math.cos(theta)
        ye = ry * math.sin(theta)
        xr = xe * cos_a - ye * sin_a
        yr = xe * sin_a + ye * cos_a
        src_pts.append([cx + xr, cy + yr])
        dst_pts.append([
            target_center + target_radius * math.cos(theta),
            target_center + target_radius * math.sin(theta)
        ])

    src_pts.append([cx, cy])
    dst_pts.append([target_center, target_center])

    for ratio in [0.33, 0.6, 0.85]:
        for i in range(0, num_ring_points, 4):
            theta = 2 * math.pi * i / num_ring_points
            xe = rx * ratio * math.cos(theta)
            ye = ry * ratio * math.sin(theta)
            xr = xe * cos_a - ye * sin_a
            yr = xe * sin_a + ye * cos_a
            src_pts.append([cx + xr, cy + yr])
            dst_pts.append([
                target_center + target_radius * ratio * math.cos(theta),
                target_center + target_radius * ratio * math.sin(theta)
            ])

    src_arr = np.array(src_pts, dtype=np.float32)
    dst_arr = np.array(dst_pts, dtype=np.float32)

    H, mask = cv2.findHomography(src_arr, dst_arr, cv2.RANSAC, 2.0, maxIters=2000)
    if H is None:
        H, _ = cv2.findHomography(src_arr, dst_arr, 0)
    if H is None:
        return None, None

    try:
        H_inv = np.linalg.inv(H)
    except np.linalg.LinAlgError:
        H_inv = None

    return H, H_inv


def generate_overlay_points(cal: CalibrationResult, num_points: int = 128) -> List[List[float]]:
    if not cal.success or cal.center_x is None:
        return []
    cx = float(cal.center_x)
    cy = float(cal.center_y)
    rx = float(cal.radius_x or cal.radius)
    ry = float(cal.radius_y or cal.radius)
    angle = float(cal.ellipse.angle) if cal.ellipse else 0.0
    angle_rad = math.radians(angle)
    cos_a = math.cos(angle_rad)
    sin_a = math.sin(angle_rad)
    points = []
    for i in range(num_points):
        theta = 2 * math.pi * i / num_points
        xe = rx * math.cos(theta)
        ye = ry * math.sin(theta)
        xr = xe * cos_a - ye * sin_a
        yr = xe * sin_a + ye * cos_a
        points.append([cx + xr, cy + yr])
    return points


def warp_image(image: np.ndarray, H: np.ndarray, size: int = CANONICAL_SIZE) -> np.ndarray:
    return cv2.warpPerspective(
        image, H, (size, size),
        flags=cv2.INTER_LANCZOS4,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(30, 30, 30)
    )


def refine_tip_subpixel(
    canonical: np.ndarray,
    tip: Tuple[int, int],
    search_radius: int = 12
) -> Tuple[float, float]:
    x, y = tip
    h, w = canonical.shape[:2]
    x1 = max(0, x - search_radius)
    y1 = max(0, y - search_radius)
    x2 = min(w, x + search_radius)
    y2 = min(h, y + search_radius)
    roi = canonical[y1:y2, x1:x2]
    if roi.size == 0:
        return float(x), float(y)

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not contours:
        return float(x), float(y)

    best = max(contours, key=cv2.contourArea)
    M = cv2.moments(best)
    if M["m00"] > 0:
        rx = M["m10"] / M["m00"] + x1
        ry = M["m01"] / M["m00"] + y1
        if abs(rx - x) < search_radius and abs(ry - y) < search_radius:
            return rx, ry
    return float(x), float(y)


def detect_dart_in_canonical_precise(
    before: np.ndarray,
    after: np.ndarray,
) -> Tuple[Optional[Tuple[float, float]], float, np.ndarray, np.ndarray]:
    b_blur = cv2.GaussianBlur(before, (5, 5), 1.2)
    a_blur = cv2.GaussianBlur(after, (5, 5), 1.2)

    diff = cv2.absdiff(a_blur, b_blur)
    gray_diff = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)

    thresh_val = max(18, int(np.percentile(gray_diff, 92)))
    _, thresh = cv2.threshold(gray_diff, thresh_val, 255, cv2.THRESH_BINARY)

    kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel_close)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_open)

    board_mask = np.zeros_like(mask)
    cv2.circle(board_mask, (CANONICAL_CENTER, CANONICAL_CENTER), CANONICAL_RADIUS + 10, 255, -1)
    mask = cv2.bitwise_and(mask, board_mask)

    change_ratio = cv2.countNonZero(mask) / (math.pi * (CANONICAL_RADIUS + 10) ** 2)
    if change_ratio > 0.18:
        return None, 0.0, diff, mask

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not contours:
        return None, 0.0, diff, mask

    valid = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < 50 or area > 40000:
            continue
        x, y, w, h = cv2.boundingRect(c)
        aspect = max(w, h) / (min(w, h) + 1)
        if aspect > 12.0:
            continue
        pts = c.reshape(-1, 2)
        dists = np.sqrt((pts[:, 0] - CANONICAL_CENTER) ** 2 + (pts[:, 1] - CANONICAL_CENTER) ** 2)
        tip_idx = np.argmin(dists)
        tip_x, tip_y = float(pts[tip_idx][0]), float(pts[tip_idx][1])
        tip_dist = dists[tip_idx]
        if tip_dist > CANONICAL_RADIUS + 5:
            continue

        perimeter = cv2.arcLength(c, True)
        circularity = 4 * math.pi * area / (perimeter ** 2 + 1e-5)
        elongation = max(w, h) / (min(w, h) + 1)

        conf = 0.30
        conf += min(0.25, area / 4000.0)
        if 1.2 < elongation < 6.0:
            conf += 0.12
        conf += min(0.15, circularity * 0.15)
        if tip_dist < CANONICAL_RADIUS * 0.92:
            conf += 0.08
        if tip_dist < CANONICAL_RADIUS * 0.6:
            conf += 0.05

        valid.append((tip_x, tip_y, conf, area, c))

    if not valid:
        return None, 0.0, diff, mask

    valid.sort(key=lambda x: x[2], reverse=True)

    best_tx, best_ty, best_conf, _, best_c = valid[0]

    bx, by = refine_tip_subpixel(after, (int(best_tx), int(best_ty)), 14)

    dist_after_refine = math.sqrt((bx - CANONICAL_CENTER) ** 2 + (by - CANONICAL_CENTER) ** 2)
    if dist_after_refine < CANONICAL_RADIUS + 5:
        best_tx, best_ty = bx, by

    best_conf = min(0.97, best_conf)
    return (best_tx, best_ty), best_conf, diff, mask


def get_score_from_canonical_position(
    x: float, y: float, rotation_offset: float = -9.0
) -> Tuple[str, int]:
    dx = x - CANONICAL_CENTER
    dy = CANONICAL_CENTER - y
    distance = math.sqrt(dx * dx + dy * dy)
    distance_ratio = distance / CANONICAL_RADIUS

    if distance_ratio > 1.03:
        return "MISS", 0

    if distance_ratio <= RADIUS_RATIOS["double_bull"]:
        return "D-BULL", 50
    if distance_ratio <= RADIUS_RATIOS["single_bull"]:
        return "BULL", 25

    angle = math.degrees(math.atan2(dx, dy))
    if angle < 0:
        angle += 360

    adjusted = (angle + rotation_offset) % 360
    segment_index = int(adjusted / 18) % 20
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
        "message": "Dart Detection API v5 - Precision YOLOv8 + OpenCV",
        "version": "5.0.0",
        "yolo_available": yolo_available() if YOLO_AVAILABLE else False,
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "board_found": session_data["board_found"],
        "has_homography": session_data["homography"] is not None,
        "is_angled": session_data.get("is_angled", False),
        "yolo_enabled": yolo_available() if YOLO_AVAILABLE else False,
    }


@app.post("/board/detect", response_model=BoardDetectResponse)
async def board_detect(image: UploadFile = File(...)):
    global session_data

    contents = await image.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    img, scale = resize_for_processing(img, 1280)

    if YOLO_AVAILABLE and yolo_available():
        yolo_board = detect_board_yolo(img, confidence_threshold=0.45)
        if yolo_board and yolo_board["confidence"] > 0.55:
            print(f"[YOLOv8] Board at ({yolo_board['cx']}, {yolo_board['cy']}) conf={yolo_board['confidence']:.3f}")

    processed = preprocessor.adaptive_preprocessing(img)
    cal_result = calibrator.calibrate_multi_method(processed)

    if not cal_result.success:
        cal_result = calibrator.calibrate_multi_method(img)

    if not cal_result.success:
        return BoardDetectResponse(
            board_found=False,
            confidence=cal_result.confidence,
            message=cal_result.message,
            method=cal_result.method
        )

    H, H_inv = compute_homography_from_calibration(cal_result)

    if H is None:
        return BoardDetectResponse(
            board_found=False,
            confidence=0.0,
            message="Homography calculation failed - try better lighting or positioning"
        )

    canonical = warp_image(img, H)

    session_data.update({
        "homography": H,
        "inverse_homography": H_inv,
        "board_found": True,
        "reference_canonical": canonical.copy(),
        "reference_raw": img.copy(),
        "rotation_offset": cal_result.rotation_offset,
        "calibration_result": cal_result,
        "is_angled": cal_result.is_angled,
        "ellipse": (
            (float(cal_result.center_x), float(cal_result.center_y)),
            (float((cal_result.radius_x or cal_result.radius) * 2),
             float((cal_result.radius_y or cal_result.radius) * 2)),
            float(cal_result.ellipse.angle) if cal_result.ellipse else 0.0
        )
    })

    r_x = float(cal_result.radius_x or cal_result.radius)
    r_y = float(cal_result.radius_y or cal_result.radius)
    ellipse_data = {
        "cx": float(cal_result.center_x),
        "cy": float(cal_result.center_y),
        "a": r_x,
        "b": r_y,
        "angle": float(cal_result.ellipse.angle) if cal_result.ellipse else 0.0
    }

    overlay = generate_overlay_points(cal_result, 128)

    return BoardDetectResponse(
        board_found=True,
        confidence=min(0.97, cal_result.confidence),
        ellipse=ellipse_data,
        homography=H.tolist(),
        overlay_points=overlay,
        bull_center=[float(cal_result.center_x), float(cal_result.center_y)],
        canonical_preview=image_to_base64(canonical, 80),
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
        raise HTTPException(status_code=400, detail="No homography - call /board/detect first")

    before_img = cv2.imdecode(np.frombuffer(await before.read(), np.uint8), cv2.IMREAD_COLOR)
    after_img = cv2.imdecode(np.frombuffer(await after.read(), np.uint8), cv2.IMREAD_COLOR)

    if before_img is None or after_img is None:
        raise HTTPException(status_code=400, detail="Invalid image(s)")

    before_img, _ = resize_for_processing(before_img, 1280)
    after_img, _ = resize_for_processing(after_img, 1280)

    if before_img.shape != after_img.shape:
        h = min(before_img.shape[0], after_img.shape[0])
        w = min(before_img.shape[1], after_img.shape[1])
        before_img = cv2.resize(before_img, (w, h))
        after_img = cv2.resize(after_img, (w, h))

    before_can = warp_image(before_img, H)
    after_can = warp_image(after_img, H)

    rotation_offset = session_data.get("rotation_offset", -9.0)
    tip = None
    confidence = 0.0
    detection_method = "none"

    if YOLO_AVAILABLE and yolo_available():
        yolo_tip, yolo_conf = detect_dart_in_canonical_yolo(before_can, after_can, 0.35)
        if yolo_tip is not None and yolo_conf >= 0.35:
            tip = (float(yolo_tip[0]), float(yolo_tip[1]))
            confidence = yolo_conf
            detection_method = "yolov8"
            print(f"[YOLOv8] Dart at {tip} conf={confidence:.3f}")

    if tip is None:
        cv_tip, cv_conf, diff_img, mask_img = detect_dart_in_canonical_precise(before_can, after_can)
        if cv_tip is not None and cv_conf >= 0.30:
            tip = (float(cv_tip[0]), float(cv_tip[1]))
            confidence = cv_conf
            detection_method = "cv_subpixel"
    else:
        diff_img = cv2.absdiff(after_can, before_can)
        _, mask_img = cv2.threshold(cv2.cvtColor(diff_img, cv2.COLOR_BGR2GRAY), 18, 255, cv2.THRESH_BINARY)

    if tip is None:
        cal = session_data.get("calibration_result")
        if cal and cal.success:
            cal_data = {
                "center_x": cal.center_x, "center_y": cal.center_y,
                "radius": cal.radius, "rotation_offset": cal.rotation_offset
            }
            detector = AdvancedDartDetection(cal_data)
            result = detector.detect_multiple_darts(after_img, before_img)
            if result.darts:
                best = result.darts[0]
                if detector.validate_detection(best):
                    tip_h = np.array([best.x, best.y, 1.0], dtype=np.float32)
                    tc = H @ tip_h
                    tc /= tc[2]
                    tip = (float(tc[0]), float(tc[1]))
                    confidence = best.confidence * 0.80
                    detection_method = "advanced_cv"

    if tip is None:
        diff_img_fb = cv2.absdiff(after_can, before_can)
        _, mask_img_fb = cv2.threshold(
            cv2.cvtColor(diff_img_fb, cv2.COLOR_BGR2GRAY), 18, 255, cv2.THRESH_BINARY
        )
        return ThrowScoreResponse(
            label="MISS",
            score=0,
            confidence=0.15,
            decision="RETRY",
            message="No dart detected. Try again or enter manually.",
            debug={
                "diff_preview": image_to_base64(diff_img_fb, 75),
                "mask_preview": image_to_base64(cv2.cvtColor(mask_img_fb, cv2.COLOR_GRAY2BGR), 75),
                "canonical_after": image_to_base64(after_can, 75)
            }
        )

    label, score_value = get_score_from_canonical_position(tip[0], tip[1], rotation_offset)

    tip_original = None
    H_inv = session_data.get("inverse_homography")
    if H_inv is not None:
        try:
            th = np.array([tip[0], tip[1], 1.0])
            tb = H_inv @ th
            tb /= tb[2]
            tip_original = [float(tb[0]), float(tb[1])]
        except Exception:
            pass

    if confidence >= 0.72:
        decision = "AUTO"
    elif confidence >= 0.45:
        decision = "ASSIST"
    else:
        decision = "RETRY"

    debug_img = after_can.copy()
    cv2.circle(debug_img, (int(tip[0]), int(tip[1])), 10, (0, 255, 0), 2)
    cv2.circle(debug_img, (int(tip[0]), int(tip[1])), 3, (0, 255, 0), -1)
    cv2.circle(debug_img, (CANONICAL_CENTER, CANONICAL_CENTER), 6, (0, 0, 255), -1)
    cv2.circle(debug_img, (CANONICAL_CENTER, CANONICAL_CENTER), CANONICAL_RADIUS, (255, 200, 0), 1)
    for ratio, color in [
        (RADIUS_RATIOS["double_bull"], (255, 50, 50)),
        (RADIUS_RATIOS["single_bull"], (255, 100, 50)),
        (RADIUS_RATIOS["inner_triple"], (50, 200, 50)),
        (RADIUS_RATIOS["outer_triple"], (50, 200, 50)),
        (RADIUS_RATIOS["inner_double"], (50, 50, 255)),
        (RADIUS_RATIOS["outer_double"], (50, 50, 255)),
    ]:
        r = int(CANONICAL_RADIUS * ratio)
        cv2.circle(debug_img, (CANONICAL_CENTER, CANONICAL_CENTER), r, color, 1)

    return ThrowScoreResponse(
        label=label,
        score=score_value,
        confidence=confidence,
        decision=decision,
        tip_canonical=[tip[0], tip[1]],
        tip_original=tip_original,
        message=f"{label} ({score_value}pts) [{confidence * 100:.0f}%] via {detection_method}",
        debug={
            "diff_preview": image_to_base64(diff_img, 75),
            "mask_preview": image_to_base64(cv2.cvtColor(mask_img, cv2.COLOR_GRAY2BGR), 75),
            "canonical_preview": image_to_base64(debug_img, 80)
        }
    )


@app.post("/set-reference")
async def set_reference(image: UploadFile = File(...)):
    global session_data
    if session_data.get("homography") is None:
        raise HTTPException(status_code=400, detail="No homography - call /board/detect first")

    contents = await image.read()
    img = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    img, _ = resize_for_processing(img, 1280)
    canonical = warp_image(img, session_data["homography"])
    session_data["reference_canonical"] = canonical
    session_data["reference_raw"] = img.copy()

    return {"status": "reference_set", "canonical_preview": image_to_base64(canonical, 80)}


@app.get("/session/status")
async def session_status():
    cal = session_data.get("calibration_result")
    ell = session_data.get("ellipse")
    return {
        "board_found": session_data["board_found"],
        "has_homography": session_data["homography"] is not None,
        "has_reference": session_data["reference_canonical"] is not None,
        "is_angled": session_data.get("is_angled", False),
        "rotation_offset": session_data.get("rotation_offset", -9.0),
        "method": cal.method if cal else None,
        "yolo_enabled": yolo_available() if YOLO_AVAILABLE else False,
        "ellipse": {
            "cx": ell[0][0], "cy": ell[0][1],
            "a": ell[1][0] / 2, "b": ell[1][1] / 2,
            "angle": ell[2]
        } if ell else None
    }


@app.post("/reset")
async def reset_session():
    global session_data
    session_data = {
        "homography": None, "inverse_homography": None,
        "ellipse": None, "board_found": False,
        "reference_canonical": None, "rotation_offset": -9.0,
        "calibration_result": None, "is_angled": False, "reference_raw": None,
    }
    return {"status": "reset"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
