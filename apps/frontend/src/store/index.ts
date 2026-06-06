import { create } from 'zustand';

interface AppState {
  deals: any[];
  setDeals: (deals: any[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  deals: [],
  setDeals: (deals) => set({ deals }),
}));
