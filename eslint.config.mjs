import unjs from 'eslint-config-unjs'

export default unjs({
  ignores: [
    // ignore paths
  ],
  rules: {
    // rule overrides
    'unicorn/prefer-optional-catch-binding': 'off',
    'unicorn/no-null': 'off',
    'unicorn/prefer-native-coercion-functions': 'off',
    'unicorn/no-empty-files': 'off',
    'unicorn/no-array-for-each': 'off',
    'unicorn/explicit-length-check': 'off',
  },
  markdown: {
    rules: {
      // markdown rule overrides
    },
  },
})
