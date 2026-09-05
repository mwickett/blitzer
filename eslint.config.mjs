import nextConfig from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  { ignores: ["coverage/", "src/generated/", ".claude/", ".worktrees/"] },
  ...nextConfig,
];

export default eslintConfig;
