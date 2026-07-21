import { Server as HttpServer } from 'http';
import { Server as IOServer } from 'socket.io';
import { Client } from 'pg';
import { env } from '../config/env';
import { verifyAccessToken } from '../lib/jwt';

// Replaces Supabase Realtime. A dedicated pg LISTENer receives row changes
// (see sql/backend-realtime.sql) and broadcasts them to authenticated clients.
// The app subscribes and updates the relevant screen (map, charger, booking).
export function attachRealtime(server: HttpServer) {
  const io = new IOServer(server, {
    cors: { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') },
  });

  // Authenticate each socket with the same access token as the REST API.
  io.use((socket, next) => {
    const token = (socket.handshake.auth?.token as string) ?? '';
    try { socket.data.user = verifyAccessToken(token); next(); }
    catch { next(new Error('unauthorized')); }
  });

  // Dedicated LISTEN client (kept open, auto-reconnect on error).
  const listen = () => {
    const client = new Client({ connectionString: env.DATABASE_URL });
    client.connect()
      .then(() => client.query('LISTEN row_change'))
      .catch((e) => { console.error('[realtime] listen connect failed', e.message); setTimeout(listen, 5000); });

    client.on('notification', (msg) => {
      if (!msg.payload) return;
      try { io.emit('change', JSON.parse(msg.payload)); } catch { /* ignore */ }
    });
    client.on('error', (e) => {
      console.error('[realtime] listener error', e.message);
      try { client.end(); } catch { /* noop */ }
      setTimeout(listen, 5000);
    });
  };
  listen();

  return io;
}
