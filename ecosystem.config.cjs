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
      // PORT and the rest of the configuration come from .env (loaded by the server itself);
      // setting PORT here would override it with the deploy shell's value, or 3000 when unset.
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
}
