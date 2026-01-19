#!/usr/bin/env python3
"""
Quick test script to verify calibration works
"""
import cv2
import numpy as np
from advanced_calibration import AdvancedDartboardCalibration
from image_preprocessing import ImagePreprocessor

def test_calibration():
    print("=" * 60)
    print("TESTING DARTBOARD CALIBRATION")
    print("=" * 60)

    calibrator = AdvancedDartboardCalibration()

    test_image = np.zeros((800, 800, 3), dtype=np.uint8)
    test_image[:] = (200, 200, 200)

    cv2.circle(test_image, (400, 400), 300, (0, 0, 255), 20)
    cv2.circle(test_image, (400, 400), 250, (0, 255, 0), 15)
    cv2.circle(test_image, (400, 400), 200, (255, 255, 255), -1)
    cv2.circle(test_image, (400, 400), 180, (0, 0, 0), 30)
    cv2.circle(test_image, (400, 400), 100, (255, 255, 255), -1)
    cv2.circle(test_image, (400, 400), 80, (0, 255, 0), 15)
    cv2.circle(test_image, (400, 400), 20, (0, 0, 255), -1)

    for i in range(20):
        angle = np.radians(i * 18)
        x1 = int(400 + 50 * np.sin(angle))
        y1 = int(400 - 50 * np.cos(angle))
        x2 = int(400 + 300 * np.sin(angle))
        y2 = int(400 - 300 * np.cos(angle))
        cv2.line(test_image, (x1, y1), (x2, y2), (0, 0, 0), 2)

    print("\n1. Testing with SYNTHETIC dartboard image...")
    result = calibrator.calibrate_multi_method(test_image)

    print(f"   Success: {result.success}")
    print(f"   Method: {result.method}")
    print(f"   Center: ({result.center_x}, {result.center_y})")
    print(f"   Radius: {result.radius}")
    print(f"   Confidence: {result.confidence:.2f}")
    print(f"   Message: {result.message}")

    print("\n2. Testing with PREPROCESSED synthetic image...")
    preprocessed = ImagePreprocessor.adaptive_preprocessing(test_image)
    result2 = calibrator.calibrate_multi_method(preprocessed)

    print(f"   Success: {result2.success}")
    print(f"   Method: {result2.method}")
    print(f"   Confidence: {result2.confidence:.2f}")

    print("\n3. Testing with BLANK image (should fallback to center)...")
    blank = np.ones((600, 800, 3), dtype=np.uint8) * 128
    result3 = calibrator.calibrate_multi_method(blank)

    print(f"   Success: {result3.success}")
    print(f"   Method: {result3.method}")
    print(f"   Center: ({result3.center_x}, {result3.center_y})")
    print(f"   Radius: {result3.radius}")
    print(f"   Confidence: {result3.confidence:.2f}")

    print("\n" + "=" * 60)
    if result.success and result2.success and result3.success:
        print("✓ ALL TESTS PASSED! Calibration works correctly.")
    else:
        print("✗ SOME TESTS FAILED!")
    print("=" * 60)

    return result.success and result2.success and result3.success

if __name__ == "__main__":
    import sys
    success = test_calibration()
    sys.exit(0 if success else 1)
