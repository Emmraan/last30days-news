import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		ignores: [
			'.svelte-kit/',
			'landing/.svelte-kit/',
			'build/',
			'landing/build/',
			'node_modules/',
			'static/shots/'
		]
	},
	...tseslint.configs.recommended,
	...svelte.configs.recommended,
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: { parser: tseslint.parser }
		}
	},
	prettier,
	...svelte.configs.prettier,
	{
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			]
		}
	}
);
