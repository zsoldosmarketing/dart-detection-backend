import requests
import base64
import cv2
import numpy as np
from typing import Optional, Tuple, List, Dict, Any
import os


ROBOFLOW_API_KEY = os.environ.get("ROBOFLOW_API_KEY", "")

DART_TIP_MODEL_ID = os.environ.get("ROBOFLOW_DART_MODEL", "darts-r9zqx/1")
BOARD_MODEL_ID = os.environ.get("ROBOFLOW_BOARD_MODEL", "dartboard-detection-uiamz/1")

ROBOFLOW_INFER_URL = "https://detect.roboflow.com"


def _encode_image_base64(image: np.ndarray, quality: int = 85) -> str:
    _, buffer = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return base64.b64encode(buffer).decode('utf-8')


def detect_dart_tip_roboflow(
    image: np.ndarray,
    confidence_threshold: float = 0.35
) -> Tuple[Optional[Tuple[int, int]], float, List[Dict]]:
    if not ROBOFLOW_API_KEY:
        return None, 0.0, []

    img_b64 = _encode_image_base64(image, quality=85)

    url = f"{ROBOFLOW_INFER_URL}/{DART_TIP_MODEL_ID}"
    params = {
        "api_key": ROBOFLOW_API_KEY,
        "confidence": int(confidence_threshold * 100),
        "overlap": 30,
        "format": "json",
    }

    try:
        response = requests.post(
            url,
            params=params,
            data=img_b64,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=8
        )
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"[Roboflow] dart tip request failed: {e}")
        return None, 0.0, []

    predictions = data.get("predictions", [])
    if not predictions:
        return None, 0.0, []

    best = max(predictions, key=lambda p: p.get("confidence", 0))
    conf = best.get("confidence", 0.0)

    if conf < confidence_threshold:
        return None, conf, predictions

    x = int(best.get("x", 0))
    y = int(best.get("y", 0))

    return (x, y), conf, predictions


def detect_board_roboflow(
    image: np.ndarray,
    confidence_threshold: float = 0.40
) -> Optional[Dict[str, Any]]:
    if not ROBOFLOW_API_KEY:
        return None

    img_b64 = _encode_image_base64(image, quality=85)

    url = f"{ROBOFLOW_INFER_URL}/{BOARD_MODEL_ID}"
    params = {
        "api_key": ROBOFLOW_API_KEY,
        "confidence": int(confidence_threshold * 100),
        "overlap": 30,
        "format": "json",
    }

    try:
        response = requests.post(
            url,
            params=params,
            data=img_b64,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=8
        )
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"[Roboflow] board request failed: {e}")
        return None

    predictions = data.get("predictions", [])
    if not predictions:
        return None

    best = max(predictions, key=lambda p: p.get("confidence", 0))
    conf = best.get("confidence", 0.0)

    if conf < confidence_threshold:
        return None

    x = int(best.get("x", 0))
    y = int(best.get("y", 0))
    w = int(best.get("width", 0))
    h = int(best.get("height", 0))

    return {
        "cx": x,
        "cy": y,
        "width": w,
        "height": h,
        "radius": max(w, h) // 2,
        "confidence": conf,
        "raw": best
    }


def detect_dart_in_canonical_roboflow(
    before: np.ndarray,
    after: np.ndarray,
    confidence_threshold: float = 0.35
) -> Tuple[Optional[Tuple[int, int]], float]:
    tip_after, conf_after, preds_after = detect_dart_tip_roboflow(after, confidence_threshold)
    tip_before, conf_before, preds_before = detect_dart_tip_roboflow(before, confidence_threshold)

    if tip_after is None:
        return None, 0.0

    if tip_before is not None:
        dx = abs(tip_after[0] - tip_before[0])
        dy = abs(tip_after[1] - tip_before[1])
        if dx < 15 and dy < 15:
            return None, 0.0

    return tip_after, conf_after


def is_available() -> bool:
    return bool(ROBOFLOW_API_KEY)
