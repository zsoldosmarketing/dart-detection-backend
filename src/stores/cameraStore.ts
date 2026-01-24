import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AutoCalibrationResult, BoardDetectResult } from '../lib/dartDetectionApi';

interface CameraState {
  wasActive: boolean;
  calibration: AutoCalibrationResult | null;
  boardResult: BoardDetectResult | null;
  homography: number[][] | null;
  lastRemoteCameraId: string | null;
  autoDetectEnabled: boolean;
  autoZoomEnabled: boolean;
  lastCameraIndex: number;
  referenceFrameBase64: string | null;

  setWasActive: (active: boolean) => void;
  setCalibration: (calibration: AutoCalibrationResult | null) => void;
  setBoardResult: (result: BoardDetectResult | null) => void;
  setHomography: (homography: number[][] | null) => void;
  setLastRemoteCameraId: (id: string | null) => void;
  setAutoDetectEnabled: (enabled: boolean) => void;
  setAutoZoomEnabled: (enabled: boolean) => void;
  setLastCameraIndex: (index: number) => void;
  setReferenceFrameBase64: (frame: string | null) => void;
  reset: () => void;
}

export const useCameraStore = create<CameraState>()(
  persist(
    (set) => ({
      wasActive: false,
      calibration: null,
      boardResult: null,
      homography: null,
      lastRemoteCameraId: null,
      autoDetectEnabled: true,
      autoZoomEnabled: true,
      lastCameraIndex: 0,
      referenceFrameBase64: null,

      setWasActive: (active) => set({ wasActive: active }),
      setCalibration: (calibration) => set({ calibration }),
      setBoardResult: (result) => set({ boardResult: result }),
      setHomography: (homography) => set({ homography }),
      setLastRemoteCameraId: (id) => set({ lastRemoteCameraId: id }),
      setAutoDetectEnabled: (enabled) => set({ autoDetectEnabled: enabled }),
      setAutoZoomEnabled: (enabled) => set({ autoZoomEnabled: enabled }),
      setLastCameraIndex: (index) => set({ lastCameraIndex: index }),
      setReferenceFrameBase64: (frame) => set({ referenceFrameBase64: frame }),
      reset: () => set({
        wasActive: false,
        calibration: null,
        boardResult: null,
        homography: null,
        referenceFrameBase64: null,
      }),
    }),
    {
      name: 'dart-camera-storage',
      partialize: (state) => ({
        wasActive: state.wasActive,
        calibration: state.calibration,
        boardResult: state.boardResult,
        homography: state.homography,
        lastRemoteCameraId: state.lastRemoteCameraId,
        autoDetectEnabled: state.autoDetectEnabled,
        autoZoomEnabled: state.autoZoomEnabled,
        lastCameraIndex: state.lastCameraIndex,
      }),
    }
  )
);
