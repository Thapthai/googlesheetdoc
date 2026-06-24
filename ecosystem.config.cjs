const path = require("path");

module.exports = {
  apps: [
    {
      name: "google-sheet-report",
      script: path.join(__dirname, "dist", "server.js"),
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      time: true,
      merge_logs: true,
      out_file: path.join(__dirname, "logs", "pm2-out.log"),
      error_file: path.join(__dirname, "logs", "pm2-error.log"),
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
