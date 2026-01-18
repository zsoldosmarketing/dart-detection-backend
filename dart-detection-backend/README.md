# Advanced Dart Detection Backend 🎯

High-precision OpenCV-based dart detection API with automatic multi-method calibration and advanced image processing.

## Features

- **Multi-Method Automatic Calibration**
  - Hough Circle Transform (advanced edge detection)
  - Color-based dartboard detection (HSV analysis)
  - ArUco marker support (highest precision)
  - Bull's-eye center refinement
  - Automatic rotation offset detection

- **Advanced Dart Detection**
  - Multi-dart simultaneous detection
  - Difference-based detection (frame comparison)
  - Color-based metal tip detection
  - Subpixel accuracy positioning
  - Confidence-weighted clustering

- **Image Preprocessing Pipeline**
  - CLAHE lighting enhancement
  - Fast non-local means denoising
  - Adaptive brightness/contrast adjustment
  - Shadow removal
  - Auto white balance
  - Sharpening

## API Endpoints

### `GET /health`
Health check - returns API and calibration status.

**Response:**
```json
{
  "status": "healthy",
  "calibrated": true
}
```

### `POST /calibrate`
Manual dartboard calibration.

**Request Body:**
```json
{
  "center_x": 320,
  "center_y": 240,
  "radius": 200,
  "rotation_offset": -9
}
```

### `POST /auto-calibrate?use_advanced=true`
**NEW!** Automatic dartboard calibration with multi-method approach.

**Query Parameters:**
- `use_advanced` (boolean): Use advanced multi-method calibration (default: true)

**Form Data:**
- `file` (image): Dartboard image

**Response:**
```json
{
  "success": true,
  "center_x": 320,
  "center_y": 240,
  "radius": 200,
  "rotation_offset": -8.5,
  "confidence": 0.95,
  "method": "Multi-method (ArUco Markers, Advanced Hough Transform)",
  "message": "Tobbszoros modszerrel kalibralt (2 modszer) + pontos bull kozeppont"
}
```

### `POST /set-reference`
Upload a reference image (empty dartboard for difference detection).

**Form Data:**
- `file` (image)

### `POST /detect`
Single dart detection (legacy endpoint).

**Form Data:**
- `file` (image)

**Response:**
```json
{
  "score": "T20",
  "confidence": 0.85,
  "position": {"x": 100, "y": 150}
}
```

### `POST /detect-multiple`
Single dart detection with previous frame comparison.

**Form Data:**
- `current` (image)
- `previous` (image, optional)

### `POST /detect-advanced?preprocess=true`
**NEW!** Advanced multi-dart detection with preprocessing.

**Query Parameters:**
- `preprocess` (boolean): Apply adaptive image preprocessing (default: true)

**Form Data:**
- `current` (image): Current dartboard image
- `reference` (image, optional): Reference image for comparison

**Response:**
```json
{
  "darts": [
    {
      "x": 320,
      "y": 180,
      "score": "T20",
      "confidence": 0.92,
      "dart_id": 0
    },
    {
      "x": 315,
      "y": 240,
      "score": "T19",
      "confidence": 0.88,
      "dart_id": 1
    }
  ],
  "total_confidence": 0.90,
  "method": "difference, color",
  "message": "2 dart detektalva (difference, color)"
}
```

### `POST /preprocess-image?method=adaptive`
**NEW!** Image preprocessing endpoint for testing.

**Query Parameters:**
- `method` (string): Preprocessing method
  - `adaptive`: Automatic adaptive preprocessing
  - `full`: Full preprocessing pipeline
  - `enhance`: Lighting enhancement only
  - `denoise`: Denoising only

**Form Data:**
- `file` (image)

**Response:**
```json
{
  "status": "processed",
  "method": "adaptive",
  "image_base64": "..."
}

```

## Local Development

```bash
pip install -r requirements.txt
python main.py
```

The API will run on `http://localhost:8000`

## Deploy to Render

1. Create a new Web Service on [Render](https://render.com)
2. Connect your GitHub repo
3. Select the `dart-detection-backend` directory as root
4. Render will auto-detect the Dockerfile
5. Deploy!

## Deploy to Railway

```bash
cd dart-detection-backend
railway login
railway init
railway up
```

## Score Format

- `20`, `1`, `18`, etc. - Single
- `D20`, `D1`, etc. - Double
- `T20`, `T1`, etc. - Triple
- `BULL` - Single bull (25)
- `D-BULL` - Double bull (50)
- `MISS` - Outside board

## Calibration Methods

### 1. ArUco Markers (Highest Precision - 98%)
Place ArUco markers (DICT_4X4_50) around the dartboard. The system will automatically detect them and calculate precise center and radius.

### 2. Advanced Hough Transform (85% confidence)
Uses circular edge detection with advanced parameter tuning and edge support scoring.

### 3. Color-based Detection (85% confidence)
Detects dartboard by analyzing red, green, and black segments using HSV color space.

### Multi-Method Fusion (95% confidence)
Combines multiple methods and weights results by confidence for maximum accuracy.

## Detection Methods

### Difference-based Detection
Compares current frame with reference/previous frame to identify new darts. Best for controlled environments.

### Color-based Metal Detection
Detects metallic dart tips using HSV color analysis and edge detection. Works without reference images.

### Clustering Algorithm
Groups multiple detection candidates and uses confidence-weighted averaging for final position.

## Image Preprocessing

The system automatically:
- Enhances lighting using CLAHE
- Removes noise with fast non-local means
- Adjusts brightness/contrast adaptively
- Removes shadows in low-light conditions
- Applies auto white balance
- Sharpens images when needed

## Tips for Best Results

1. **Lighting**: Ensure even, bright lighting on the dartboard
2. **Camera**: Use at least 720p resolution, 1080p recommended
3. **Angle**: Position camera perpendicular to dartboard
4. **Distance**: Camera should see entire dartboard with some margin
5. **Stability**: Mount camera firmly to avoid shake
6. **Background**: Contrasting background helps detection
7. **ArUco Markers**: For highest precision, add ArUco markers around board

## Performance

- **Calibration**: ~2-5 seconds (multi-method)
- **Single Dart Detection**: ~100-300ms
- **Multi-Dart Detection**: ~300-500ms
- **Preprocessing**: ~200-400ms

## Dependencies

- **FastAPI**: Web framework
- **OpenCV (contrib)**: Computer vision with ArUco support
- **NumPy**: Numerical operations
- **SciPy**: Signal processing
- **scikit-image**: Advanced image processing
- **Pillow**: Image handling
