import { create } from 'zustand';

export {
  MAX_STREAM_EVENTS,
  selectFilteredEvents,
  useEventStreamStore,
  type ConnectionStatus,
  type StreamEvent,
} from './event-stream';

interface AppState {
  deals: any[];
  setDeals: (deals: any[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  deals: [],
  setDeals: (deals) => set({ deals }),
}));
