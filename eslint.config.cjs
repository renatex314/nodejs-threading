const typeScriptEsLintPlugin = require('@typescript-eslint/eslint-plugin');
const stylistic = require("@stylistic/eslint-plugin");
const esLintConfigPrettier = require('eslint-config-prettier');
const { FlatCompat } = require('@eslint/eslintrc');
const noExternalVars = require("./eslint-rules/no_external_vars/index.cjs");

// Translate ESLintRC-style configs into flat configs.
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: typeScriptEsLintPlugin.configs['recommended'],
});

module.exports = [
    {
        ignores: [
            ".prettierrc.js",
            "eslint.config.cjs",
            "lib/**/*"
        ],
        languageOptions: {
            parser: '@typescript-eslint/parser',
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                project: './tsconfig.json',
                tsconfigRootDir: __dirname,
            },
        },
        plugins: {
            "@stylistic": stylistic,
            "no-external-vars": noExternalVars
        },
        rules: {
            "@stylistic/indent": ["error", 2],
            "@stylistic/space-in-parens": ["error"],
            "@stylistic/no-extra-semi": ["error"],
            "@stylistic/semi-spacing": ["error", { "before": false, "after": true }],
            "@stylistic/semi-style": ["error", "last"],
            "@stylistic/no-multi-spaces": ["error"],
            "no-external-vars/no-external-vars-function": ["error"],
            "camelcase": ['error', { ignoreDestructuring: true }],
            "semi-spacing": ['error'],
        }
    },
    ...compat.config({
        env: { node: true },
        extends: ['plugin:@typescript-eslint/recommended'],
        parser: '@typescript-eslint/parser',
        parserOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
        },
        plugins: ['@typescript-eslint'],
        rules: {
            '@typescript-eslint/no-unused-vars': 'error',
            '@typescript-eslint/no-empty-interface': 'error',
            "@typescript-eslint/no-require-imports": 'off'
        },
        ignorePatterns: [
            "eslint.config.cjs",
            "eslint-rules/**/*"
        ]
    }),
    esLintConfigPrettier,
];