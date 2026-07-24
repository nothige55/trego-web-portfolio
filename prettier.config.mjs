/** @type {import("prettier").Config} */
const config = {
  plugins: ["prettier-plugin-tailwindcss"],
  semi: true,
  trailingComma: "all",
  printWidth: 100,
  arrowParens: "always",
  endOfLine: "auto",
  bracketSpacing: true,
  tailwindFunctions: ["clsx", "cn", "cva"],
  tailwindStylesheet: "./src/index.css",
};

export default config;
