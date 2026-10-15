// Configuración de Jest en modo ES Modules.
// Las pruebas de integración y contrato usan SIEMPRE la base `motorix_test`.
export default {
  testEnvironment: 'node',
  transform: {},
  globalSetup: './tests/helpers/globalSetup.js',
  setupFiles: ['./tests/helpers/setupEnv.js'],
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
    '<rootDir>/tests/integration/**/*.test.js',
    '<rootDir>/tests/contract/**/*.test.js'
  ],
  testTimeout: 20000
};
