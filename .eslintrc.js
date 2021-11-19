module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true
  },
  extends: [
    'standard',
    'prettier'
  ],  
  parser: 'babel-eslint',
  parserOptions: {
    ecmaVersion: 12
  },
  rules: {
    semi: ['error', 'never'],
    quotes: ['error', 'single']
  }
}
