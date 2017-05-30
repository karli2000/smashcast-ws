module.exports = {
    extends: [
        'stylelint-config-standard',
        'stylelint-config-css-modules',
    ],
    rules: {
        'at-rule-no-unknown': [
            true,
            {
                ignoreAtRules: [
                    'extend',
                    'at-root',
                    'debug',
                    'warn',
                    'error',
                    'if',
                    'else',
                    'for',
                    'each',
                    'while',
                    'mixin',
                    'include',
                    'content',
                    'return',
                    'function',
                ],
            },
        ],
        'block-no-empty': null,
        'selector-pseudo-element-colon-notation': null,
        'indentation': 4,
        'number-leading-zero': null,
    },
};
