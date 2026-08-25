module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      1,
      'always',
      ['web', 'server', 'sim', 'protocol', 'agents-sdk', 'docs', 'ci', 'repo'],
    ],
    'header-max-length': [2, 'always', 100],
    'subject-case': [0],
  },
};
