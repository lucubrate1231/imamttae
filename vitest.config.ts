import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/{unit,contract,dom}/**/*.test.ts'],
    environment: 'node',
  },
});
