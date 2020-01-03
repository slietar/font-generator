const webpack = require('webpack');

module.exports = {
  context: __dirname,
  mode: 'development',

  entry: {
    main: './src/index.js',
    worker: './src/worker.js'
  },
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

