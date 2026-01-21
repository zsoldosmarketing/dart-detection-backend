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

app = FastAPI(
    title="Dart Detection API v3",
    description="Real board detection with homography and perspective correction",
    version="3.0.0"
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

session_data: Dict[str, Any] = {
    "homography": None,
    "inverse_homography": None,
    "ellipse": None,
    "board_found": False,
    "reference_canonical": None,
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


def find_dartboard_contour(image: np.ndarray) -> Tuple[Optional[np.ndarray], float, np.ndarray]:
    height, width = image.shape[:2]

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    edges = cv2.Canny(blurred, 30, 100)

    kernel = np.ones((3, 3), np.uint8)
    edges = cv2.dilate(edges, kernel, iterations=2)
    edges = cv2.erode(edges, kernel, iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

        lower_red1 = np.array([0, 50, 50])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([170, 50, 50])
        upper_red2 = np.array([180, 255, 255])
        lower_green = np.array([35, 50, 50])
        upper_green = np.array([85, 255, 255])

        mask_red1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask_red2 = cv2.inRange(hsv, lower_red2, upper_red2)
        mask_green = cv2.inRange(hsv, lower_green, upper_green)

        mask_board = cv2.bitwise_or(mask_red1, mask_red2)
        mask_board = cv2.bitwise_or(mask_board, mask_green)

        kernel = np.ones((7, 7), np.uint8)
        mask_board = cv2.morphologyEx(mask_board, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(mask_board, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    best_contour = None
    best_score = 0

    min_area = (min(width, height) * 0.15) ** 2
    max_area = (min(width, height) * 0.95) ** 2

    for contour in contours:
        area = cv2.contourArea(contour)

        if area < min_area or area > max_area:
            continue

        if len(contour) < 5:
            continue

        try:
            ellipse = cv2.fitEllipse(contour)
            (cx, cy), (w, h), angle = ellipse

            ellipse_area = math.pi * (w/2) * (h/2)
            if ellipse_area < 1:
                continue
            circularity = area / ellipse_area

            aspect_ratio = min(w, h) / max(w, h) if max(w, h) > 0 else 0

            center_dist = math.sqrt((cx - width/2)**2 + (cy - height/2)**2)
            center_score = 1 - (center_dist / (min(width, height) / 2))
            center_score = max(0, center_score)

            score = (circularity * 0.4 + aspect_ratio * 0.3 + center_score * 0.3) * (area / max_area)

            if score > best_score and circularity > 0.5 and aspect_ratio > 0.3:
                best_score = score
                best_contour = contour

        except cv2.error:
            continue

    return best_contour, best_score, edges


def find_bull_center(image: np.ndarray, ellipse_center: Tuple[float, float], search_radius: int) -> Optional[Tuple[int, int]]:
    cx, cy = int(ellipse_center[0]), int(ellipse_center[1])
    h, w = image.shape[:2]

    x1 = max(0, cx - search_radius)
    y1 = max(0, cy - search_radius)
    x2 = min(w, cx + search_radius)
    y2 = min(h, cy + search_radius)

    roi = image[y1:y2, x1:x2]
    if roi.size == 0:
        return None

    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    lower_red1 = np.array([0, 100, 80])
    upper_red1 = np.array([10, 255, 255])
    lower_red2 = np.array([170, 100, 80])
    upper_red2 = np.array([180, 255, 255])

    mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
    mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
    mask_bull = cv2.bitwise_or(mask1, mask2)

    kernel = np.ones((3, 3), np.uint8)
    mask_bull = cv2.morphologyEx(mask_bull, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(mask_bull, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    best_center = None
    best_score = 0
    roi_center = (search_radius, search_radius)

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < 30 or area > search_radius * search_radius:
            continue

        M = cv2.moments(contour)
        if M["m00"] == 0:
            continue

        bcx = int(M["m10"] / M["m00"])
        bcy = int(M["m01"] / M["m00"])

        dist = math.sqrt((bcx - roi_center[0])**2 + (bcy - roi_center[1])**2)
        centrality = 1 - (dist / search_radius) if search_radius > 0 else 0

        (_, _), radius = cv2.minEnclosingCircle(contour)
        circle_area = math.pi * radius * radius
        circularity = area / circle_area if circle_area > 0 else 0

        score = circularity * 0.5 + centrality * 0.5

        if score > best_score:
            best_score = score
            best_center = (bcx + x1, bcy + y1)

    return best_center


def compute_homography_from_ellipse(ellipse: Tuple, target_size: int = CANONICAL_SIZE) -> Tuple[np.ndarray, np.ndarray]:
    (cx, cy), (axis_w, axis_h), angle = ellipse

    num_points = 16
    src_points = []
    dst_points = []

    target_center = target_size // 2
    target_radius = int(target_size * 0.475)

    for i in range(num_points):
        theta = 2 * math.pi * i / num_points

        x_ellipse = (axis_w / 2) * math.cos(theta)
        y_ellipse = (axis_h / 2) * math.sin(theta)

        angle_rad = math.radians(angle)
        x_rot = x_ellipse * math.cos(angle_rad) - y_ellipse * math.sin(angle_rad)
        y_rot = x_ellipse * math.sin(angle_rad) + y_ellipse * math.cos(angle_rad)

        src_x = cx + x_rot
        src_y = cy + y_rot
        src_points.append([src_x, src_y])

        dst_x = target_center + target_radius * math.cos(theta)
        dst_y = target_center + target_radius * math.sin(theta)
        dst_points.append([dst_x, dst_y])

    src_pts = np.array(src_points, dtype=np.float32)
    dst_pts = np.array(dst_points, dtype=np.float32)

    H, _ = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)

    if H is None:
        H = cv2.getPerspectiveTransform(src_pts[:4], dst_pts[:4])

    H_inv = np.linalg.inv(H) if H is not None else None

    return H, H_inv


def generate_overlay_points(ellipse: Tuple, num_points: int = 64) -> List[List[float]]:
    (cx, cy), (axis_w, axis_h), angle = ellipse

    points = []
    angle_rad = math.radians(angle)

    for i in range(num_points):
        theta = 2 * math.pi * i / num_points

        x_ellipse = (axis_w / 2) * math.cos(theta)
        y_ellipse = (axis_h / 2) * math.sin(theta)

        x_rot = x_ellipse * math.cos(angle_rad) - y_ellipse * math.sin(angle_rad)
        y_rot = x_ellipse * math.sin(angle_rad) + y_ellipse * math.cos(angle_rad)

        points.append([cx + x_rot, cy + y_rot])

    return points


def generate_ring_overlay(ellipse: Tuple, ratio: float, num_points: int = 64) -> List[List[float]]:
    (cx, cy), (axis_w, axis_h), angle = ellipse

    points = []
    angle_rad = math.radians(angle)

    scaled_w = axis_w * ratio
    scaled_h = axis_h * ratio

    for i in range(num_points):
        theta = 2 * math.pi * i / num_points

        x_ellipse = (scaled_w / 2) * math.cos(theta)
        y_ellipse = (scaled_h / 2) * math.sin(theta)

        x_rot = x_ellipse * math.cos(angle_rad) - y_ellipse * math.sin(angle_rad)
        y_rot = x_ellipse * math.sin(angle_rad) + y_ellipse * math.cos(angle_rad)

        points.append([cx + x_rot, cy + y_rot])

    return points


def warp_image(image: np.ndarray, H: np.ndarray, size: int = CANONICAL_SIZE) -> np.ndarray:
    return cv2.warpPerspective(image, H, (size, size))


def detect_dart_in_canonical(before: np.ndarray, after: np.ndarray) -> Tuple[Optional[Tuple[int, int]], float, np.ndarray, np.ndarray]:
    diff = cv2.absdiff(after, before)
    gray_diff = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)

    _, thresh = cv2.threshold(gray_diff, 25, 255, cv2.THRESH_BINARY)

    kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

    board_mask = np.zeros_like(mask)
    cv2.circle(board_mask, (CANONICAL_CENTER, CANONICAL_CENTER), CANONICAL_RADIUS + 20, 255, -1)
    mask = cv2.bitwise_and(mask, board_mask)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return None, 0.0, diff, mask

    valid_contours = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if 50 < area < 50000:
            valid_contours.append((contour, area))

    if not valid_contours:
        return None, 0.0, diff, mask

    largest = max(valid_contours, key=lambda x: x[1])
    contour, area = largest

    points = contour.reshape(-1, 2)

    distances = np.sqrt((points[:, 0] - CANONICAL_CENTER)**2 + (points[:, 1] - CANONICAL_CENTER)**2)
    tip_idx = np.argmin(distances)
    tip_x, tip_y = points[tip_idx]

    confidence = min(0.95, 0.4 + (area / 5000) * 0.3)

    return (int(tip_x), int(tip_y)), confidence, diff, mask


def get_score_from_canonical_position(x: int, y: int, rotation_offset: float = -9.0) -> Tuple[str, int]:
    dx = x - CANONICAL_CENTER
    dy = CANONICAL_CENTER - y
    distance = math.sqrt(dx * dx + dy * dy)
    distance_ratio = distance / CANONICAL_RADIUS

    if distance_ratio > 1.05:
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
    return {"status": "ok", "message": "Dart Detection API v3 - Real board detection with homography", "version": "3.0.0"}


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "board_found": session_data["board_found"],
        "has_homography": session_data["homography"] is not None
    }


@app.post("/board/detect", response_model=BoardDetectResponse)
async def board_detect(
    image: UploadFile = File(...)
):
    global session_data

    contents = await image.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    contour, score, edges = find_dartboard_contour(img)

    if contour is None or len(contour) < 5:
        return BoardDetectResponse(
            board_found=False,
            confidence=0.0,
            message="No dartboard contour found. Ensure the board is visible.",
            debug_contour=image_to_base64(edges) if edges is not None else None
        )

    try:
        ellipse = cv2.fitEllipse(contour)
    except cv2.error:
        return BoardDetectResponse(
            board_found=False,
            confidence=0.0,
            message="Could not fit ellipse to contour"
        )

    (cx, cy), (axis_w, axis_h), angle = ellipse

    search_radius = int(min(axis_w, axis_h) / 4)
    bull = find_bull_center(img, (cx, cy), search_radius)

    if bull:
        dist = math.sqrt((bull[0] - cx)**2 + (bull[1] - cy)**2)
        if dist < search_radius:
            cx, cy = bull
            ellipse = ((cx, cy), (axis_w, axis_h), angle)
            score = min(0.98, score + 0.1)

    H, H_inv = compute_homography_from_ellipse(ellipse, CANONICAL_SIZE)

    if H is None:
        return BoardDetectResponse(
            board_found=False,
            confidence=0.0,
            message="Could not compute homography"
        )

    canonical = warp_image(img, H, CANONICAL_SIZE)

    session_data["homography"] = H
    session_data["inverse_homography"] = H_inv
    session_data["ellipse"] = ellipse
    session_data["board_found"] = True
    session_data["reference_canonical"] = canonical.copy()

    overlay_outer = generate_overlay_points(ellipse, 64)
    overlay_triple = generate_ring_overlay(ellipse, RADIUS_RATIOS["outer_triple"], 64)
    overlay_double_start = generate_ring_overlay(ellipse, RADIUS_RATIOS["inner_double"], 64)
    overlay_bull = generate_ring_overlay(ellipse, RADIUS_RATIOS["single_bull"], 32)

    confidence = min(0.95, score * 1.2)

    return BoardDetectResponse(
        board_found=True,
        confidence=confidence,
        ellipse={
            "cx": float(cx),
            "cy": float(cy),
            "a": float(axis_w / 2),
            "b": float(axis_h / 2),
            "angle": float(angle)
        },
        homography=H.tolist(),
        overlay_points=overlay_outer,
        bull_center=[float(cx), float(cy)],
        canonical_preview=image_to_base64(canonical, 70),
        message=f"Board detected with {confidence*100:.0f}% confidence"
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

    before_canonical = warp_image(before_img, H, CANONICAL_SIZE)
    after_canonical = warp_image(after_img, H, CANONICAL_SIZE)

    tip, confidence, diff_img, mask_img = detect_dart_in_canonical(before_canonical, after_canonical)

    if tip is None:
        return ThrowScoreResponse(
            label="MISS",
            score=0,
            confidence=0.3,
            decision="ASSIST",
            message="No dart detected. Manual input recommended.",
            debug={
                "diff_preview": image_to_base64(diff_img, 60),
                "mask_preview": image_to_base64(cv2.cvtColor(mask_img, cv2.COLOR_GRAY2BGR), 60),
                "canonical_after": image_to_base64(after_canonical, 60)
            }
        )

    label, score_value = get_score_from_canonical_position(tip[0], tip[1])

    tip_original = None
    H_inv = session_data.get("inverse_homography")
    if H_inv is not None:
        tip_homogeneous = np.array([tip[0], tip[1], 1.0])
        tip_back = H_inv @ tip_homogeneous
        tip_back = tip_back / tip_back[2]
        tip_original = [int(tip_back[0]), int(tip_back[1])]

    if confidence >= 0.7:
        decision = "AUTO"
    elif confidence >= 0.5:
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
        message=f"Detected {label} ({score_value} points) with {confidence*100:.0f}% confidence",
        debug={
            "diff_preview": image_to_base64(diff_img, 60),
            "mask_preview": image_to_base64(cv2.cvtColor(mask_img, cv2.COLOR_GRAY2BGR), 60),
            "canonical_preview": image_to_base64(debug_canonical, 60)
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

    return {
        "status": "reference_set",
        "canonical_preview": image_to_base64(canonical, 70)
    }


@app.get("/session/status")
async def session_status():
    return {
        "board_found": session_data["board_found"],
        "has_homography": session_data["homography"] is not None,
        "has_reference": session_data["reference_canonical"] is not None,
        "ellipse": {
            "cx": session_data["ellipse"][0][0],
            "cy": session_data["ellipse"][0][1],
            "a": session_data["ellipse"][1][0] / 2,
            "b": session_data["ellipse"][1][1] / 2,
            "angle": session_data["ellipse"][2]
        } if session_data["ellipse"] else None
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
    }
    return {"status": "reset", "message": "Session cleared"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
