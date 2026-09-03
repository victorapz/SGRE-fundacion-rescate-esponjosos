module.exports = {
  apps: [
    {
      name: "fundacion-backend",
      cwd: "/root/SistemaGestionFundacion/backend",
      script: "src/index.js",
      interpreter: "node",
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      time: true,
      env_production: {
        NODE_ENV: "production",
      },
    },
    {
      name: "fundacion-frontend",
      cwd: "/root/SistemaGestionFundacion/frontend",
      script: "server/https-server.js",
      interpreter: "node",
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      time: true,
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
