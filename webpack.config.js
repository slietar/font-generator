const webpack = require('webpack');

module.exports = {
  context: __dirname,
  mode: 'development',

  entry: './src/index.js',
  output: {
    path: __dirname + '/public',
    filename: '[name].bundle.js'
  },

  module: {
    rules: [
      { test: /\.scss$/,
        use: ['style-loader', 'css-loader', 'sass-loader'] }
    ]
  }
};

