# Contextualize Visualization Library

This project contains a Node.js library [Node.js](https://nodejs.org) that is used to generate common visualizations for data. The predominantly used packages are [D3](https://d3js.org/) and [Three.js](https://threejs.org/).

## System Requirements

You should have a version of [Node.js](https://nodejs.org/en/download/) that is at least 17.0. You can check what your active version of Node.js is by running

```bash
node --version
```

Once you have Node.js installed, you should install the required and development packages using

```bash
npm install
```

in the root directory of the project.

## Contribution Guidelines

The following are guidelines for how code should be contributed to this project.

- [Commitizen-friendly](https://github.com/commitizen/cz-cli) commit messages should always be used.
- Before code is submitted, [Prettier](https://prettier.io/) should be used to format code and [ESLint](https://eslint.org/) should be used to lint code. We suggest using the [Prettier VSCode extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) and [ESLint VSCode extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint).
- Code versions should be bumped according to [Semantic Versioning](https://semver.org/) guidelines. This must be done before releases are made.

## Commands

The following commands are available for running, testing, and packaging the project.

- ```bash
  npm run rollup
  ```

  packages the project as a ECMAScript module. The packaged files are contained in `dist/esm`. The package contains type declarations embedded within so dependents do not need to install a `@types` module.

- ```bash
  npm run lint
  ```

  lints the package source code files using [ESLint](https://eslint.org/) to detect code logic and quality problems. **This does not modify any of the source code files.** The linting is only applied to the `src/` directory. Returns exit code `1` if linting has detected any errors or warnings.

- ```bash
  npm run format
  ```

  formats the package source code files using [Prettier](https://prettier.io/) to make code of a consistent formatting. **This does modify the source code files.** The formatting is only applied to the `src/` directory.

- ```bash
  npm run format-check
  ```

  checks the formattign of the package source code files using [Prettier](https://prettier.io/) to detect code formatting problems. **This does not modify the source code files.** The formatting is only checked in the `src/` directory. Returns exit code `1` if any formatting problems exist.

- ```bash
  npm run test
  ```

  tests the package by automatically running any file that has a name matching `*.test.ts`. Jest is the unit testing suite and is configured to use the JSDOM environment. This allows tests to construct a virtual DOM for testing.

- ```bash
  npm run storybook-serve
  ```

  runs a [Storybook](https://storybook.js.org/) server on port 6006 by default. The Storybook environment should be used to visually test interactions with the visualizations included in this package in addition to standard unit tests.

- ```bash
  npm run storybook-build
  ```
  compiles a static version of [Storybook](https://storybook.js.org/) as a collection of HTML, CSS, and JS that is distributable. By default, these static files are exported to the `public` directory.

## Continuous Deployment

This project is configured to run a continuous deployment pipeline on [GitLab](https://gitlab.com/). This pipeline does the following:

1. Tests that that unit tests run with no errors.
2. Lints the code to verify code quality and formatting. 
3. Publishes the package to the [GitLab Package Registry](https://docs.gitlab.com/ee/user/packages/package_registry/) if a tag is created on a commit in the `main` branch.
4. Publishes the [Storybook](https://storybook.js.org/) documentation if on the `main` branch.

**It is important that the version of the package in `project.json` is bumped whenever a new release tag is made in `main`. Otherwise, the publish stage will fail to update the package registry.**
