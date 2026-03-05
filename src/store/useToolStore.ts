import { create } from 'zustand'
import type { ToolType, Unit } from '@/types'

interface ToolStore {
  activeTool: ToolType
  activeColor: string
  activeUnit: Unit
  measurementName: string
  // Counter tool
  counterName: string
  counterColor: string
  // Roof tool
  slopeFormat: 'ratio' | 'degrees' | 'percent'
  slopeValue: number
  // Calibration state
  isCalibrating: boolean
  calibrationStep: 0 | 1 | 2  // 0=idle, 1=first point clicked, 2=second point clicked

  setActiveTool: (tool: ToolType) => void
  setActiveColor: (color: string) => void
  setActiveUnit: (unit: Unit) => void
  setMeasurementName: (name: string) => void
  setCounterName: (name: string) => void
  setCounterColor: (color: string) => void
  setSlopeFormat: (format: 'ratio' | 'degrees' | 'percent') => void
  setSlopeValue: (value: number) => void
  setCalibrating: (v: boolean) => void
  setCalibrationStep: (step: 0 | 1 | 2) => void
}

export const useToolStore = create<ToolStore>((set) => ({
  activeTool: 'pan',
  activeColor: '#ef4444',
  activeUnit: 'm',
  measurementName: '',
  counterName: 'Élément',
  counterColor: '#3b82f6',
  slopeFormat: 'ratio',
  slopeValue: 4,
  isCalibrating: false,
  calibrationStep: 0,

  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveColor: (color) => set({ activeColor: color }),
  setActiveUnit: (unit) => set({ activeUnit: unit }),
  setMeasurementName: (name) => set({ measurementName: name }),
  setCounterName: (name) => set({ counterName: name }),
  setCounterColor: (color) => set({ counterColor: color }),
  setSlopeFormat: (format) => set({ slopeFormat: format }),
  setSlopeValue: (value) => set({ slopeValue: value }),
  setCalibrating: (v) => set({ isCalibrating: v }),
  setCalibrationStep: (step) => set({ calibrationStep: step }),
}))
