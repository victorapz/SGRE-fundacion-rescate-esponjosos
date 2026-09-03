const NGROK_CONFIG_PATH = process.env.NGROK_CONFIG_PATH || "/root/.config/ngrok/ngrok.yml";

module.exports = {
  apps: [
    {
      name: "fundacion-ngrok",
      cwd: "/root/SistemaGestionFundacion",
      script: "ngrok",
      args: `http http://127.0.0.1:80 --config ${NGROK_CONFIG_PATH}`,
      interpreter: "none",
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      time: true,
      env_production: {
        NODE_ENV: "production",
        NGROK_CONFIG_PATH,
      },
    },
  ],
};
