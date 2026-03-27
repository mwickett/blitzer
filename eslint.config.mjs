import nextConfig from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  { ignores: ["coverage/", "src/generated/"] },
  ...nextConfig,
];

export default eslintConfig;
