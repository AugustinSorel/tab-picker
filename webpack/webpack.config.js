const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "production",
  watch: true,
  entry: {
    background: path.resolve(__dirname, "..", "src", "background.ts"),
    contentScript: path.resolve(__dirname, "..", "src", "contentScript.ts"),
  },
  output: {
    path: path.join(__dirname, "../dist"),
    filename: "[name].js",
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["to-string-loader", "css-loader"],
      },
    ],
  },
  optimization: {
    minimize: false,
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, "..", "manifest.json"),
          to: path.join(__dirname, "../dist"),
        },
        {
          from: path.resolve(__dirname, "..", "assets"),
          to: path.join(__dirname, "../dist"),
        },
      ],
    }),
  ],
};
