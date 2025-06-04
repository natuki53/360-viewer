const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const path = require('path');

module.exports = {
    ...defaultConfig,
    entry: {
        index: path.resolve(process.cwd(), 'src', 'index.js'),
        viewer: path.resolve(process.cwd(), 'src', 'blocks', '360viewer', 'viewer.js')
    },
    output: {
        path: path.resolve(process.cwd(), 'build'),
        filename: '[name].js'
    }
}; 