module.exports = {
  apps: [
    {
      name: process.env.PROJECT_NAME || 'apex-auto',
      script: 'server/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '800M',
      env_file: '.env',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000
      }
    }
  ]
}
