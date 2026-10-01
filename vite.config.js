import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
    plugins: [react()],
    // Absolute paths so nested routes such as /approve-card-design/:id
    // load /assets/* instead of /approve-card-design/assets/*.
    // Capacitor builds set CAPACITOR=1 and keep relative paths.
    base: process.env.CAPACITOR === '1' ? './' : '/',
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        watch: {
            ignored: ['**/server/**'],
        },
        proxy: {
            '/api': {
                target: process.env.BACKEND_URL || 'http://localhost:5001',
                changeOrigin: true,
            },
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        // put UI libs in a separate chunk
                        if (id.includes('@mui') || id.includes('recharts') || id.includes('d3'))
                            return 'vendor-ui';
                        return 'vendor';
                    }
                },
            },
        },
    },
});
