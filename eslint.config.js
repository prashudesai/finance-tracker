import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'src/domain/reference'] },
  ...tseslint.configs.strict,
);
