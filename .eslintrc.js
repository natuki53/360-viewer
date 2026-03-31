const baseConfig = require( '@wordpress/scripts/config/.eslintrc.js' );

module.exports = {
	...baseConfig,
	env: {
		...( baseConfig.env || {} ),
		browser: true,
		es2021: true,
	},
	globals: {
		...( baseConfig.globals || {} ),
		THREE: 'readonly',
	},
	rules: {
		...( baseConfig.rules || {} ),
		'no-console': 'off',
		'jsdoc/check-tag-names': 'off',
		'jsdoc/check-line-alignment': 'off',
		'jsdoc/require-param': 'off',
		'object-shorthand': 'off',
		'no-else-return': 'off',
		'no-useless-return': 'off',
		'no-lonely-if': 'off',
	},
};
