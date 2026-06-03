import {
  logoutAndRemoveLocalNpmConfig,
  npmCacheDir,
  registry,
  removeLocalNpmConfig,
  runNpm,
  scope,
  userConfig,
} from "./npm-auth.js";

let loggedIn = false;

try {
  runNpm(["login", "--registry", registry, "--scope", scope, "--userconfig", userConfig]);
  loggedIn = true;
  runNpm([
    "stage",
    "publish",
    "--access",
    "public",
    "--provenance",
    "--userconfig",
    userConfig,
    "--cache",
    npmCacheDir,
  ]);
} finally {
  if (loggedIn) {
    logoutAndRemoveLocalNpmConfig();
  } else {
    removeLocalNpmConfig();
  }
}
