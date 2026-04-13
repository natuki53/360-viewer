#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const pluginSlug = "360-viewer";
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const version = pkg.version;
const releasesDir = path.join(rootDir, "releases");
const stageRoot = path.join(rootDir, "dist-package");
const stageDir = path.join(stageRoot, pluginSlug);
const zipPath = path.join(releasesDir, `${pluginSlug}-${version}.zip`);

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

function run(cmd, args, cwd = rootDir) {
	execFileSync(cmd, args, { cwd, stdio: "inherit" });
}

console.log("Building project...");
run(npmCmd, ["run", "build"]);

console.log("Preparing staged package...");
fs.rmSync(stageRoot, { recursive: true, force: true });
fs.mkdirSync(path.join(stageDir, "src", "assets"), { recursive: true });

fs.copyFileSync(path.join(rootDir, "360-viewer.php"), path.join(stageDir, "360-viewer.php"));
fs.copyFileSync(path.join(rootDir, "README.md"), path.join(stageDir, "README.md"));
fs.copyFileSync(path.join(rootDir, "CHANGELOG.md"), path.join(stageDir, "CHANGELOG.md"));
fs.cpSync(path.join(rootDir, "build"), path.join(stageDir, "build"), { recursive: true });
fs.copyFileSync(
	path.join(rootDir, "src", "assets", "three.min.js"),
	path.join(stageDir, "src", "assets", "three.min.js")
);

fs.mkdirSync(releasesDir, { recursive: true });
fs.rmSync(zipPath, { force: true });

console.log(`Creating release zip: ${zipPath}`);
run(npmCmd, ["exec", "--", "bestzip", zipPath, pluginSlug], stageRoot);

console.log(`Done: ${zipPath}`);
