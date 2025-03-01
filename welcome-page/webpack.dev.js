const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const dist = path.resolve(__dirname, 'dist');

module.exports = {
  mode: 'development',
  entry: {
    app: './src/index.js'
  },
  output: {
    filename: 'bundle.js',
    path: dist,
    publicPath: '/'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.s[ac]ss$/i,
        use: [ 'style-loader', 'css-loader', 'sass-loader' ]
      },
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/public/index.html',
    }),
    new CopyPlugin({
      patterns: [
        { from: 'src/public/vanta.min.js', to: dist },
        { from: 'src/public/favicon.ico', to: dist },
      ],
    }),
    new CleanWebpackPlugin()
  ],
  devServer: {
    hot: true,
    port: 9000,
    watchFiles: ['src'],
    // devMiddleware: {
    //   writeToDisk: true,
    // },
    headers: {
      'Cache-Control': 'no-store',
    },
  },
  stats: 'errors-only',
  devtool: 'inline-source-map',
};
