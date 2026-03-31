const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    ...defaultConfig,
    entry: {
        index: path.resolve(process.cwd(), 'src', 'index.js'),
        viewer: path.resolve(process.cwd(), 'src', 'blocks', '360viewer', 'viewer.js')
    },
    output: {
        path: path.resolve(process.cwd(), 'build'),
        filename: '[name].js'
    },
    plugins: [
        ...(defaultConfig.plugins || []),
        new CopyPlugin({
            patterns: [
                {
                    from: path.resolve(process.cwd(), 'src', 'assets', 'three.min.js'),
                    to: path.resolve(process.cwd(), 'build', 'three.min.js'),
                },
            ],
        }),
    ],
};
