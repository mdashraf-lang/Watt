import { createApp } from './app';
import { env } from './config/env';
import { pool } from './db/pool';

async function main() {
  // Verify the DB connection before accepting traffic.
  await pool.query('select 1');
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`GO WATT API listening on :${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async () => {
    server.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', e);
  process.exit(1);
});
