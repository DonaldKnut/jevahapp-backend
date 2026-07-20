/**
 * Contabo PM2 layout — API + BullMQ worker sharing localhost Redis.
 *
 *   REDIS_URL=redis://127.0.0.1:6379
 *   pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: "jevah-api",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "jevah-worker",
      script: "dist/workers/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
