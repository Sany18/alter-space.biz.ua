const common = require('./webpack.dev.js');

module.exports = {
  ...common,
  mode: 'production',
  watch: false,
}
