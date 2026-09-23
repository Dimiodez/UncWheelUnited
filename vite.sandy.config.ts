import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base:"./",publicDir:false,plugins:[react()],
  resolve:{alias:{phaser:"phaser/dist/phaser-arcade-physics.js"}},
  build:{outDir:"dist-sandy",rolldownOptions:{input:"sandy.html"}}
});

