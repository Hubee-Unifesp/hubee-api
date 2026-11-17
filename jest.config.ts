import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import ts from 'typescript';

// Path aliases (e.g. the ones added by `nest g library`) live in tsconfig.json,
// so they are read from there instead of being duplicated here.
const { config: tsconfig } = ts.readConfigFile(
  './tsconfig.json',
  ts.sys.readFile,
);
const paths = tsconfig?.compilerOptions?.paths ?? {};

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  setupFiles: ['reflect-metadata'],
  testRegex: '.*\\.spec\\.ts$',
  // Agent worktrees live under .claude/ with a full copy of the repo
  // (including node_modules); without this, every suite runs twice.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      { useESM: true, tsconfig: '<rootDir>/tsconfig.spec.json' },
    ],
  },
  moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    'libs/**/*.(t|j)s',
    'apps/**/*.(t|j)s',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  // Each worker loads PGlite (~800MB). Using every core exhausts RAM and
  // makes integration suites time out, so cap the pool.
  maxWorkers: '50%',
};

export default config;
