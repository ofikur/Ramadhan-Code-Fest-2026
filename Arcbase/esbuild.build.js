
const esbuild = require('esbuild');
const path = require('path');

async function build() {
    try {
        console.log("Building AppKit Bundle...");
        await esbuild.build({
            entryPoints: ['appkit-entry.js'],
            bundle: true,
            outfile: 'frontend/src/libs/appkit.bundle.js',
            format: 'esm',
            minify: true, // Minify this too
            sourcemap: false,
            define: {
                'process.env.NODE_ENV': '"production"',
                'global': 'window'
            },
            platform: 'browser',
            target: ['es2022']
        });

        console.log("Building Main App Bundle...");
        await esbuild.build({
            entryPoints: ['frontend/src/app.js'],
            bundle: true,
            outfile: 'frontend/bundle.min.js',
            format: 'esm',
            minify: true, // Minify for production
            sourcemap: false,
            platform: 'browser',
            target: ['es2022'],
            external: ['*.png', '*.jpg', '*.gif'] // Exclude assets
        });

        console.log("Build success! Output: frontend/bundle.min.js");
    } catch (e) {
        console.error("Build failed:", e);
        process.exit(1);
    }
}

build();
