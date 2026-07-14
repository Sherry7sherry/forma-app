import nextVitals from 'eslint-config-next/core-web-vitals'

const config = [
  {
    ignores: ['.next/**', '.test-build/**', 'node_modules/**'],
  },
  ...nextVitals,
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]

export default config
