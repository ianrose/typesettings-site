const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

module.exports = {
  devtool: 'eval-source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: [{
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
        ]
      }
    ]
  },
  plugins: [
    new UglifyJsPlugin({
      sourceMap: true
    })
  ]
}
