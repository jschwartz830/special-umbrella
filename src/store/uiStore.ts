import { create } from 'zustand'

type ModalType = 'override' | 'notes' | 'jump' | null

interface UIState {
  modalType: ModalType
  modalContext: unknown
  calendarMonth: { year: number; month: number }

  openModal: (type: ModalType, ctx?: unknown) => void
  closeModal: () => void
  setCalendarMonth: (year: number, month: number) => void
}

export const useUIStore = create<UIState>()(set => ({
  modalType: null,
  modalContext: null,
  calendarMonth: {
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  },

  openModal(type, ctx = null) {
    set({ modalType: type, modalContext: ctx })
  },

  closeModal() {
    set({ modalType: null, modalContext: null })
  },

  setCalendarMonth(year, month) {
    set({ calendarMonth: { year, month } })
  },
}))
