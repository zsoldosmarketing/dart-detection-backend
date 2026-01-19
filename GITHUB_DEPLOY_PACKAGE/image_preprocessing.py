import cv2
import numpy as np
from typing import Tuple, Optional

class ImagePreprocessor:
    @staticmethod
    def enhance_lighting(image: np.ndarray) -> np.ndarray:
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)

        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        l = clahe.apply(l)

        enhanced = cv2.merge([l, a, b])
        enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)

        return enhanced

    @staticmethod
    def reduce_noise(image: np.ndarray) -> np.ndarray:
        denoised = cv2.fastNlMeansDenoisingColored(
            image,
            None,
            h=10,
            hColor=10,
            templateWindowSize=7,
            searchWindowSize=21
        )
        return denoised

    @staticmethod
    def sharpen_image(image: np.ndarray) -> np.ndarray:
        kernel = np.array([
            [0, -1, 0],
            [-1, 5, -1],
            [0, -1, 0]
        ])
        sharpened = cv2.filter2D(image, -1, kernel)
        return sharpened

    @staticmethod
    def correct_perspective(image: np.ndarray, corners: Optional[np.ndarray] = None) -> Tuple[np.ndarray, bool]:
        if corners is None:
            return image, False

        if len(corners) != 4:
            return image, False

        corners = corners.reshape(4, 2)

        rect = np.zeros((4, 2), dtype="float32")
        s = corners.sum(axis=1)
        rect[0] = corners[np.argmin(s)]
        rect[2] = corners[np.argmax(s)]

        diff = np.diff(corners, axis=1)
        rect[1] = corners[np.argmin(diff)]
        rect[3] = corners[np.argmax(diff)]

        (tl, tr, br, bl) = rect

        widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
        widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
        maxWidth = max(int(widthA), int(widthB))

        heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
        heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
        maxHeight = max(int(heightA), int(heightB))

        dst = np.array([
            [0, 0],
            [maxWidth - 1, 0],
            [maxWidth - 1, maxHeight - 1],
            [0, maxHeight - 1]
        ], dtype="float32")

        M = cv2.getPerspectiveTransform(rect, dst)
        warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))

        return warped, True

    @staticmethod
    def adjust_brightness_contrast(image: np.ndarray, brightness: int = 0,
                                   contrast: int = 0) -> np.ndarray:
        if brightness != 0:
            if brightness > 0:
                shadow = brightness
                highlight = 255
            else:
                shadow = 0
                highlight = 255 + brightness
            alpha_b = (highlight - shadow) / 255
            gamma_b = shadow

            image = cv2.addWeighted(image, alpha_b, image, 0, gamma_b)

        if contrast != 0:
            f = 131 * (contrast + 127) / (127 * (131 - contrast))
            alpha_c = f
            gamma_c = 127 * (1 - f)

            image = cv2.addWeighted(image, alpha_c, image, 0, gamma_c)

        return image

    @staticmethod
    def remove_shadows(image: np.ndarray) -> np.ndarray:
        rgb_planes = cv2.split(image)

        result_planes = []
        for plane in rgb_planes:
            dilated_img = cv2.dilate(plane, np.ones((7, 7), np.uint8))
            bg_img = cv2.medianBlur(dilated_img, 21)
            diff_img = 255 - cv2.absdiff(plane, bg_img)
            norm_img = cv2.normalize(diff_img, None, alpha=0, beta=255,
                                    norm_type=cv2.NORM_MINMAX, dtype=cv2.CV_8UC1)
            result_planes.append(norm_img)

        result = cv2.merge(result_planes)
        return result

    @staticmethod
    def auto_white_balance(image: np.ndarray) -> np.ndarray:
        result = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        avg_a = np.average(result[:, :, 1])
        avg_b = np.average(result[:, :, 2])

        result[:, :, 1] = result[:, :, 1] - ((avg_a - 128) * (result[:, :, 0] / 255.0) * 1.1)
        result[:, :, 2] = result[:, :, 2] - ((avg_b - 128) * (result[:, :, 0] / 255.0) * 1.1)

        result = cv2.cvtColor(result, cv2.COLOR_LAB2BGR)
        return result

    @staticmethod
    def full_preprocessing_pipeline(image: np.ndarray,
                                   enhance_lighting: bool = True,
                                   denoise: bool = True,
                                   sharpen: bool = False,
                                   white_balance: bool = True,
                                   remove_shadows: bool = False) -> np.ndarray:
        processed = image.copy()

        if white_balance:
            processed = ImagePreprocessor.auto_white_balance(processed)

        if remove_shadows:
            processed = ImagePreprocessor.remove_shadows(processed)

        if enhance_lighting:
            processed = ImagePreprocessor.enhance_lighting(processed)

        if denoise:
            processed = ImagePreprocessor.reduce_noise(processed)

        if sharpen:
            processed = ImagePreprocessor.sharpen_image(processed)

        return processed

    @staticmethod
    def adaptive_preprocessing(image: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        mean_brightness = np.mean(gray)
        std_brightness = np.std(gray)

        if mean_brightness < 80:
            brightness_adjust = 30
        elif mean_brightness > 180:
            brightness_adjust = -20
        else:
            brightness_adjust = 0

        contrast_adjust = 0
        if std_brightness < 40:
            contrast_adjust = 20
        elif std_brightness > 80:
            contrast_adjust = -10

        processed = ImagePreprocessor.full_preprocessing_pipeline(
            image,
            enhance_lighting=True,
            denoise=True,
            sharpen=(std_brightness < 50),
            white_balance=True,
            remove_shadows=(mean_brightness < 100 or std_brightness > 70)
        )

        if brightness_adjust != 0 or contrast_adjust != 0:
            processed = ImagePreprocessor.adjust_brightness_contrast(
                processed,
                brightness=brightness_adjust,
                contrast=contrast_adjust
            )

        return processed
