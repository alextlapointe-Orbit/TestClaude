import { create } from 'zustand'
import type { VesselPosition } from '@/types'

interface VesselStore {
  vessels: Map<string, VesselPosition>
  selectedMmsi: string | null
  isConnected: boolean
  filters: {
    vesselType: string
    operator: string
    name: string
    pilOnly: boolean
  }
  setVessels: (vessels: VesselPosition[]) => void
  updateVessel: (vessel: VesselPosition) => void
  selectVessel: (mmsi: string | null) => void
  setConnected: (connected: boolean) => void
  setFilter: (key: keyof VesselStore['filters'], value: string | boolean) => void
  getFilteredVessels: () => VesselPosition[]
}

export const useVesselStore = create<VesselStore>((set, get) => ({
  vessels: new Map(),
  selectedMmsi: null,
  isConnected: false,
  filters: {
    vesselType: '',
    operator: '',
    name: '',
    pilOnly: false,
  },

  setVessels: (vessels) => {
    const map = new Map<string, VesselPosition>()
    vessels.forEach((v) => map.set(v.mmsi, v))
    set({ vessels: map })
  },

  updateVessel: (vessel) => {
    set((state) => {
      const next = new Map(state.vessels)
      next.set(vessel.mmsi, vessel)
      return { vessels: next }
    })
  },

  selectVessel: (mmsi) => set({ selectedMmsi: mmsi }),

  setConnected: (connected) => set({ isConnected: connected }),

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),

  getFilteredVessels: () => {
    const { vessels, filters } = get()
    let result = Array.from(vessels.values())
    if (filters.pilOnly) result = result.filter((v) => v.is_pil_vessel)
    if (filters.vesselType) result = result.filter((v) => v.vessel_type?.toLowerCase().includes(filters.vesselType.toLowerCase()))
    if (filters.operator) result = result.filter((v) => v.operator?.toLowerCase().includes(filters.operator.toLowerCase()))
    if (filters.name) result = result.filter((v) => v.name?.toLowerCase().includes(filters.name.toLowerCase()))
    return result
  },
}))
