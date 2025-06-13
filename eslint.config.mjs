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
  },
  markdown: {
    rules: {
      // markdown rule overrides
    },
  },
})
