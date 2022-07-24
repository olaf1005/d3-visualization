module.exports = {
  collectCoverageFrom: [
    "**/src/**",
    "!**/src/stories/**",
    "!**/node_modules/**",
  ],
  coverageReporters: ["html", "text", "text-summary", "cobertura"],
  testEnvironment: "jsdom",
  moduleNameMapper: {
    d3: "<rootDir>/node_modules/d3/dist/d3.min.js",
  },
  moduleDirectories: ["node_modules", "src"],
};
