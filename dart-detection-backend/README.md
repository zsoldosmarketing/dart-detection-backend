# Dart Detection Backend

OpenCV-based dart detection API for automatic scoring.

## API Endpoints

### `GET /health`
Health check - returns calibration status.

### `POST /calibrate`
Set dartboard calibration data.
```json
{
  "center_x": 320,
  "center_y": 240,
  "radius": 200,
  "rotation_offset": -9
}
```

### `POST /set-reference`
Upload a reference image (empty dartboard).
- Form data: `file` (image)

### `POST /detect`
Detect dart in image.
- Form data: `file` (image)
- Returns: `{ "score": "T20", "confidence": 0.85, "position": {"x": 100, "y": 150} }`

### `POST /detect-multiple`
Detect dart using previous frame comparison.
- Form data: `current` (image), `previous` (image, optional)

## Local Development

```bash
pip install -r requirements.txt
python main.py
```

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
