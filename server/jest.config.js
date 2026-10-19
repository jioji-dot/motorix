// Configuración de Jest para ES Modules (se ejecuta con --experimental-vm-modules)
export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/env.js'],
  verbose: true,
};
