import { io, Socket } from 'socket.io-client';
import { ENV } from '../config/env';
import { tokenStore } from './tokenStore';

// Live updates from the backend (replaces Supabase Realtime). The backend emits
// a 'change' event { table, event, new } when stations / charger_listings /
// bookings rows change. Screens subscribe to the table(s) they care about.

type ChangeMsg = { table: string; event: string; new: any };
type Handler = (row: any, msg: ChangeMsg) => void;

let socket: Socket | null = null;
const handlers = new Map<string, Set<Handler>>();  // table → handlers

function ensureSocket() {
  if (socket || !ENV.apiUrl) return;
  socket = io(ENV.apiUrl, {
    transports: ['websocket'],
    auth: { token: tokenStore.getAccess() ?? '' },
    reconnection: true,
  });
  socket.on('change', (msg: ChangeMsg) => {
    const set = handlers.get(msg.table);
    if (set) set.forEach(h => h(msg.new, msg));
  });
}

export const realtime = {
  // Subscribe to changes on a table; returns an unsubscribe function.
  onTable(table: string, handler: Handler): () => void {
    ensureSocket();
    if (!handlers.has(table)) handlers.set(table, new Set());
    handlers.get(table)!.add(handler);
    return () => {
      handlers.get(table)?.delete(handler);
    };
  },

  // Re-auth the socket after login/refresh.
  reconnectWithToken() {
    if (socket) { socket.auth = { token: tokenStore.getAccess() ?? '' }; socket.disconnect().connect(); }
    else ensureSocket();
  },

  disconnect() {
    socket?.disconnect();
    socket = null;
    handlers.clear();
  },
};
