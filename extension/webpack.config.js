/* eslint-disable no-undef */

const devCerts = require("office-addin-dev-certs");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");
const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin");
const ReactRefreshTypeScript = require("react-refresh-typescript");

const urlDev = "https://localhost:3000/";
const urlProd = "https://extension.subzero-query.subzero.cloud/"; // CHANGE THIS TO YOUR PRODUCTION DEPLOYMENT LOCATION
const apiDev = "https://localhost:4000";
const apiProd = "https://api.subzero-query.subzero.cloud"; // CHANGE THIS TO YOUR PRODUCTION DEPLOYMENT LOCATION

async function getHttpsOptions() {
  const httpsOptions = await devCerts.getHttpsServerOptions();
  return { ca: httpsOptions.ca, key: httpsOptions.key, cert: httpsOptions.cert };
}

module.exports = async (env, options) => {
  const dev = options.mode === "development";
  const config = {
    mode: options.mode,
    watchOptions: {
      ignored: "**/node_modules",
    },
    devtool: "source-map",
    entry: {
      polyfill: ["core-js/stable", "regenerator-runtime/runtime"],
      vendor: ["react", "react-dom", "core-js", "@fluentui/react"],
      taskpane: ["./src/taskpane/index.tsx",],
      commands: "./src/commands/commands.ts",
    },
    output: {
      clean: true,
    },
    resolve: {
      extensions: [".ts", ".tsx", ".html", ".js", ".css"],
    },
    module: {
      rules: [
        // {
        //   test: /\.ts$/,
        //   exclude: /node_modules/,
        //   use: {
        //     loader: "babel-loader",
        //     options: {
        //       presets: ["@babel/preset-typescript"],
        //       plugins: [dev && require.resolve("react-refresh/babel")].filter(Boolean),
        //     },
        //   },
        // },
        // {
        //   test: /\.tsx?$/,
        //   exclude: /node_modules/,
        //   use: [
        //     {
        //       loader: require.resolve("babel-loader"),
        //       options: {
        //         presets: ["@babel/preset-react", "@babel/preset-typescript"],
        //         plugins: [dev && require.resolve("react-refresh/babel")].filter(
        //           Boolean
        //         ),
        //       },
        //     },
        //   ],
        // },

        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: "ts-loader",
              options: {
                configFile: dev ? "tsconfig.dev.json" : "tsconfig.json",
                transpileOnly: dev,
                ...(dev && {
                  getCustomTransformers: () => ({
                    before: [ReactRefreshTypeScript()],
                  }),
                }),
              },
            },
          ],
        },
        {
          test: /\.html$/,
          exclude: /node_modules/,
          use: "html-loader",
        },
        {
          test: /\.(png|jpg|jpeg|gif|ico)$/,
          type: "asset/resource",
          generator: {
            filename: "assets/[name][ext][query]",
          },
        },
        {
          test: /\.css$/i,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
    plugins: [
      dev && new ReactRefreshWebpackPlugin(),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "assets/*",
            to: "assets/[name][ext][query]",
          },
          {
            from: "manifest*.xml",
            to: "[name]" + "[ext]",
            transform(content) {
              if (dev) {
                return content;
              } else {
                return content.toString().replace(new RegExp(urlDev, "g"), urlProd);
              }
            },
          },
        ],
      }),
      new HtmlWebpackPlugin({
        filename: "taskpane.html",
        template: "./src/taskpane/taskpane.html.tpl",
        chunks: ["taskpane", "vendor", "polyfills"],
        templateParameters: {
          'defaultApiEndpoint': dev ? apiDev : apiProd,
        },
      }),
      new HtmlWebpackPlugin({
        filename: "commands.html",
        template: "./src/commands/commands.html",
        chunks: ["commands"],
      }),
      new webpack.ProvidePlugin({
        Promise: ["es6-promise", "Promise"],
      }),
    ].filter(Boolean),

    devServer: {
      hot: true,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      server: {
        type: "https",
        options: env.WEBPACK_BUILD || options.https !== undefined ? options.https : await getHttpsOptions(),
      },
      port: process.env.npm_package_config_dev_server_port || 3000,
      // onListening: function (devServer) {
      //   if (!devServer) {
      //     throw new Error('webpack-dev-server is not defined');
      //   }

      //   const port = devServer.server.address().port;
      //   console.log('Listening on port:', port);
      // },
    },
  };

  return config;
};
