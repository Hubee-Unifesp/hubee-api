module.exports = {
  parserPreset: {
    parserOpts: {
      headerPattern: /^(\w+)\(GOL-(\d+)\):\s(.+)$/,
      headerCorrespondence: ['type', 'ticket', 'subject'],
    },
  },
  plugins: [
    {
      rules: {
        'header-match-team-pattern': (parsed) => {
          const { type, ticket, subject } = parsed;
          if (!type || !ticket || !subject) {
            return [
              false,
              'Commit deve seguir o padrão: type(GOL-N): slug — ex: feat(GOL-42): adiciona validacao de login',
            ];
          }
          return [true];
        },
      },
    },
  ],
  rules: {
    'header-match-team-pattern': [2, 'always'],
  },
};