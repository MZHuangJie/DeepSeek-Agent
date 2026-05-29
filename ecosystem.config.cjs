module.exports = {
  apps: [
    {
      name: 'deepseek-agent',
      script: 'server/index.ts',
      interpreter: 'node_modules/.bin/tsx',
      cwd: '/var/www/DeepSeek-Agent',
      autorestart: true,
      max_restarts: 5,
      restart_delay: 5000,
      min_uptime: '10s',
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/var/www/DeepSeek-Agent/logs/err.log',
      out_file: '/var/www/DeepSeek-Agent/logs/out.log',
      merge_logs: true,
    },
  ],
};
