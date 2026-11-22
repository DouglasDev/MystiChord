# Codex React Phaser Template

A minimal starter with TypeScript, React, Linaria, Phaser, and Vite. The page contains a heading and a Phaser canvas with one circle.

## Start a new project

Copy the tracked files into a new folder under `~/code` without copying this template's `.git` directory. Replace `my-project` with your project's name:

```sh
mkdir ~/code/my-project
git -C ~/code/codex-react-phaser-template archive HEAD | tar -x -C ~/code/my-project
cd ~/code/my-project
git init -b main
pnpm pkg set name=my-project
pnpm install --frozen-lockfile
pnpm run format
pnpm run typecheck
git add .
git commit -m "Initialize project from template"
pnpm run dev
```

Initialize Git before installing dependencies so the `prepare` script can install Husky's hooks. If dependencies were installed before Git was initialized, run `pnpm run prepare` afterward.

## Formatting and checks

```sh
pnpm run format
pnpm run format:check
pnpm run typecheck
pnpm run build
```

Oxfmt handles formatting. The Husky precommit hook checks formatting and TypeScript, blocking the commit if either fails. Run `pnpm run format` to fix formatting, then stage the changes again. The hook checks the working tree and does not rewrite or stage files. Generated files and the pnpm lockfile are excluded from formatting.

`pnpm run build` also runs the TypeScript check.

## Structure

- `src/App.tsx`: minimal React page and Linaria styles.
- `src/PhaserCanvas.tsx`: creates and destroys the Phaser instance.
- `src/game/StarterScene.ts`: Phaser scene behavior.
- `AGENTS.md`: coding and modularity conventions inherited by new projects.

Add feature-specific components and scene/effect modules as the project grows.

## Code formatting

Run `pnpm run format` to fix blank-line spacing with ESLint Stylistic and format with Oxfmt. Run `pnpm run format:check` for a read-only check of both; the precommit hook enforces it together with TypeScript checks. Rules live in `eslint.config.mjs`. `pnpm run lint` checks spacing alone, and `pnpm run lint:fix` fixes it.
