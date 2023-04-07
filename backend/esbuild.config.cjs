/* eslint-disable */

let esbuild = require('esbuild');
let x = require('esbuild-plugin-copy');
let fs = require('fs');

let file_header = `/**
 * @license Subzero
 * 
 * Copyright (c) subZero Cloud S.R.L
 *
 * See LICENSE.txt file for more info.
 */

 /* eslint-disable */
 /* tslint:disable */
`;
let fix_node_esbuild = `
import { createRequire } from "module";
import { fileURLToPath as urlESMPluginFileURLToPath } from "url";
import { dirname as pathESMPluginDirname} from "path";
var require = createRequire(import.meta.url);
var __filename =urlESMPluginFileURLToPath(import.meta.url);
var __dirname = pathESMPluginDirname(urlESMPluginFileURLToPath(import.meta.url));
`;

//load package.json
// let pkgCommon = require('./package.json');
// delete pkgCommon.devDependencies;
// delete pkgCommon.scripts;
// pkgCommon.module = 'index.js';
// pkgCommon.main = 'index.js';
// pkgCommon.types = 'index.d.ts';
// pkgCommon.type = 'module';
// pkgCommon.private = false;
// pkgCommon.files = ['index.js', 'index.d.ts', 'index.js.map', '*.wasm'];


// Build for nodejs
esbuild.build({
    entryPoints: ['src/server.ts'],
    bundle: true,
    platform: 'node',
    //format: 'esm',
    mainFields: ['module', 'main'],
    //external: ['fs','path','util'],
    outfile: 'dist/server.cjs',
    minify: false,
    sourcemap: true,
    //banner: {js: file_header + "\n" + fix_node_esbuild},
    banner: { js: file_header },
    define: {
         "import.meta.url": "import_meta_url"
    },
    inject: ['./import.meta.url-polyfill.js'],
    loader: { '.wasm': 'copy' },
    external: ['better-sqlite3', 'bindings', 'file-uri-to-path'],
    plugins: [
        //cjs_to_esm_plugin,
        x.copy({
            assets: {
                from: ['node_modules/@subzerocloud/nodejs/subzero_wasm_bg.wasm'],
                to: ['subzero_wasm_bg.wasm']
            }
        }),
        x.copy({
            assets: {
                from: ['./node_modules/better-sqlite3/**/*'],
                to: ['./node_modules/better-sqlite3'],
            }
        }),
        x.copy({
            assets: {
                from: ['./node_modules/bindings/**/*'],
                to: ['./node_modules/bindings'],
            }
        }),
        x.copy({
            assets: {
                from: ['./node_modules/file-uri-to-path/**/*'],
                to: ['./node_modules/file-uri-to-path'],
            }
        }),

        
    ]

})
.catch(err => {
    process.stderr.write(err.stderr);
    process.exit(1)
});

 /* eslint-disable */