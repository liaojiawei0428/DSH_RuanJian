import { createRequire as __dshCreateRequire } from "node:module"; import { fileURLToPath as __dshF2P } from "node:url"; var require = __dshCreateRequire(import.meta.url); var __filename = __dshF2P(import.meta.url); var __dirname = __dshF2P(new URL(".", import.meta.url));

// src/store.js
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
var STORE_VERSION = 1;
function storePaths() {
  const root = process.env.DSH_HOME && process.env.DSH_HOME !== "" ? process.env.DSH_HOME : join(homedir(), ".dsh");
  const dir = join(root, "github-push");
  return { dir, stateFile: join(dir, "state.json"), credFile: join(dir, "credentials.json") };
}
function normalizeState(raw) {
  const base = { version: STORE_VERSION, bindings: [], settings: {} };
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return base;
  const src = (
    /** @type {Record<string, unknown>} */
    raw
  );
  if (Array.isArray(src.bindings)) {
    base.bindings = src.bindings.filter((b) => {
      if (b === null || typeof b !== "object" || Array.isArray(b)) return false;
      const rec = (
        /** @type {Record<string, unknown>} */
        b
      );
      return typeof rec.id === "string" && typeof rec.name === "string" && typeof rec.localPath === "string" && typeof rec.repoOwner === "string" && typeof rec.repoName === "string" && typeof rec.branch === "string";
    });
  }
  if (src.settings && typeof src.settings === "object" && !Array.isArray(src.settings)) {
    for (const [key, value] of Object.entries(
      /** @type {Record<string, unknown>} */
      src.settings
    )) {
      if (typeof value === "string") base.settings[key] = value;
    }
  }
  return base;
}
function normalizeCredentials(raw) {
  const base = {};
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return base;
  for (const [id, token] of Object.entries(
    /** @type {Record<string, unknown>} */
    raw
  )) {
    if (typeof token === "string" && token !== "") base[id] = token;
  }
  return base;
}
function publicBinding(binding, extra = {}) {
  return { ...binding, ...extra };
}
var GithubStore = class {
  /** @private */
  state = normalizeState(void 0);
  /** @private */
  credentials = normalizeCredentials(void 0);
  /** @private */
  loaded = false;
  /** @private */
  writeChain = Promise.resolve();
  /** @private */
  log;
  constructor(options = {}) {
    this.log = options.log ?? ((message) => {
      console.error(`[dsh-github-push] ${message}`);
    });
  }
  /** Load state + credentials once; quarantine corrupt files and start fresh. */
  async load() {
    if (this.loaded) return;
    const { dir, stateFile, credFile } = storePaths();
    await mkdir(dir, { recursive: true });
    await this.loadJson(stateFile, (parsed) => {
      this.state = normalizeState(parsed);
    }, "state.json");
    await this.loadJson(credFile, (parsed) => {
      this.credentials = normalizeCredentials(parsed);
    }, "credentials.json");
    this.loaded = true;
  }
  /**
   * Read one JSON file; unreadable → fresh; corrupt → quarantine + fresh.
   * @param {string} file
   * @param {(parsed: unknown) => void} assign
   * @param {string} label
   */
  async loadJson(file, assign, label) {
    if (!existsSync(file)) return;
    let text;
    try {
      text = await readFile(file, "utf8");
    } catch (err) {
      this.log(`${label} unreadable, starting fresh: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    if (text.trim() === "") return;
    try {
      assign(JSON.parse(text));
    } catch (err) {
      const quarantine = `${file}.corrupt-${Date.now()}`;
      try {
        await writeFile(quarantine, text, "utf8");
        this.log(`${label} corrupt (${err instanceof Error ? err.message : String(err)}); quarantined to ${quarantine}, starting fresh`);
      } catch {
        this.log(`${label} corrupt and quarantine write failed; starting fresh`);
      }
    }
  }
  /** @returns {Array<Record<string, unknown>>} persisted bindings (never tokens). */
  listBindings() {
    return this.state.bindings;
  }
  /** @param {string} key @returns {string | undefined} */
  getSetting(key) {
    return this.state.settings[key];
  }
  /**
   * Set (or clear, when value is '') one plugin setting.
   * @param {string} key
   * @param {string} value
   */
  setSetting(key, value) {
    if (value === "") delete this.state.settings[key];
    else this.state.settings[key] = value;
    void this.persistNow(this.state);
  }
  /**
   * @param {string} id
   * @returns {Record<string, unknown> | undefined}
   */
  getBinding(id) {
    return this.state.bindings.find((b) => b.id === id);
  }
  /**
   * Insert or update one binding record.
   * @param {Record<string, unknown>} input - full record fields.
   */
  upsertBinding(input) {
    const existing = typeof input.id === "string" ? this.state.bindings.find((b) => b.id === input.id) : void 0;
    if (existing !== void 0) {
      Object.assign(existing, input);
    } else {
      this.state.bindings.push({ ...input });
    }
    void this.persistNow(this.state);
    return this.getBinding(
      /** @type {string} */
      input.id
    );
  }
  /**
   * @param {string} id
   * @returns {boolean} whether a record was removed.
   */
  removeBinding(id) {
    const before = this.state.bindings.length;
    this.state.bindings = this.state.bindings.filter((b) => b.id !== id);
    this.credentials = Object.fromEntries(Object.entries(this.credentials).filter(([k]) => k !== id));
    void this.persistNow(this.state);
    void this.persistNow(this.credentials, true);
    return this.state.bindings.length < before;
  }
  /** @param {string} id @returns {string | undefined} */
  getToken(id) {
    return this.credentials[id];
  }
  /**
   * Set (or clear, when token is '') the PAT for one binding.
   * @param {string} id
   * @param {string} token
   */
  setToken(id, token) {
    if (token === "") delete this.credentials[id];
    else this.credentials[id] = token;
    void this.persistNow(this.credentials, true);
  }
  /**
   * Serialized atomic write to the given path. Failure of one write is logged
   * and recorded; the chain never rejects (subsequent writes keep working).
   * @param {Record<string, unknown> | Record<string, string>} data
   * @param {boolean} [isCredentials] - which sibling file to target.
   */
  persistNow(data, isCredentials = false) {
    const { dir, stateFile, credFile } = storePaths();
    const file = isCredentials ? credFile : stateFile;
    const payload = `${JSON.stringify(data, null, 2)}
`;
    this.writeChain = this.writeChain.then(async () => {
      try {
        await mkdir(dir, { recursive: true });
        const tmp = `${file}.tmp-${process.pid}`;
        await writeFile(tmp, payload, "utf8");
        await rename(tmp, file);
      } catch (err) {
        this.log(`persist ${isCredentials ? "credentials" : "state"} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
    return this.writeChain;
  }
};

// src/git.js
import { spawn } from "node:child_process";
import { mkdtemp, writeFile as writeFile2, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join as join2, dirname } from "node:path";
import { fileURLToPath } from "node:url";
var GitError = class extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, string>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "GitError";
    this.code = code;
    this.details = details;
  }
};
async function makeAskpass(token) {
  const dir = await mkdtemp(join2(tmpdir(), "dsh-github-askpass-"));
  const script = join2(dir, "askpass.sh");
  const content = [
    "#!/bin/sh",
    'case "$1" in',
    '  *Username*) printf "oauth2\\n";;',
    '  *Password*) printf "%s\\n" "$GITHUB_PUSH_TOKEN";;',
    "  *) exit 0;;",
    "esac",
    ""
  ].join("\n");
  await writeFile2(script, content, { encoding: "utf8", mode: 448 });
  return { dir, script, env: { GITHUB_PUSH_TOKEN: token } };
}
function runGit(worktree, args, options = {}) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
      GIT_CONFIG_SYSTEM: process.platform === "win32" ? "NUL" : "/dev/null",
      GIT_TERMINAL_PROMPT: "0"
    };
    if (options.proxy !== void 0 && options.proxy !== "") {
      env.HTTP_PROXY = options.proxy;
      env.HTTPS_PROXY = options.proxy;
      env.http_proxy = options.proxy;
      env.https_proxy = options.proxy;
    }
    let askpassDir;
    const prepare = options.token !== void 0 && options.token !== "" ? makeAskpass(options.token).then(({ dir, script, env: askEnv }) => {
      askpassDir = dir;
      env.GIT_ASKPASS = script;
      Object.assign(env, askEnv);
    }) : Promise.resolve();
    const cleanup = async () => {
      if (askpassDir !== void 0) {
        try {
          await rm(askpassDir, { recursive: true, force: true });
        } catch {
        }
      }
    };
    prepare.then(() => {
      const child = spawn("git", ["-C", worktree, ...args], {
        env,
        cwd: process.cwd(),
        windowsHide: true
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString("utf8");
      });
      child.on("error", (err) => {
        cleanup().then(() => reject(new GitError("GIT_SPAWN", `\u65E0\u6CD5\u542F\u52A8 git\uFF1A${err.message}`)));
      });
      child.on("close", async (code) => {
        await cleanup();
        if (code === 0) resolve({ stdout, stderr, code });
        else reject(new GitError("GIT_FAILED", `git ${args.join(" ")} \u5931\u8D25\uFF08exit ${code}\uFF09`, { stderr, stdout }));
      });
    }).catch((err) => {
      reject(new GitError("ASKPASS_FAILED", `\u65E0\u6CD5\u51C6\u5907\u51ED\u636E\u811A\u672C\uFF1A${err.message}`));
    });
  });
}

// src/ops.js
async function probeRepo(worktree, options = {}) {
  const proxy = options.proxy;
  const isRepo = await runGit(worktree, ["rev-parse", "--is-inside-work-tree"], {}).then(() => true).catch(() => false);
  if (!isRepo) {
    return { isRepo: false, branch: void 0, changes: 0, ahead: 0, behind: 0, message: "\u4E0D\u662F git \u4ED3\u5E93\uFF08\u8BE5\u76EE\u5F55\u5C1A\u672A\u521D\u59CB\u5316\uFF09" };
  }
  const branch = await runGit(worktree, ["rev-parse", "--abbrev-ref", "HEAD"], {}).then((r) => r.stdout.trim()).catch(() => "");
  const changes = await runGit(worktree, ["status", "--porcelain"], {}).then((r) => r.stdout.split("\n").filter((l) => l.trim() !== "").length).catch(() => 0);
  const token = options.token;
  if (typeof token === "string" && token !== "" && branch !== "") {
    const remoteHash = await lsRemoteHash(worktree, { owner: options.owner, repo: options.repo, token, branch, proxy });
    if (remoteHash !== void 0) {
      const headHash = await runGit(worktree, ["rev-parse", "HEAD"], {}).then((r) => r.stdout.trim()).catch(() => void 0);
      if (headHash !== void 0 && headHash !== remoteHash) {
        const ahead = await runGit(worktree, ["rev-list", "--count", `${remoteHash}..HEAD`], {}).then((r) => Number(r.stdout.trim())).catch(() => 0);
        const behind = await runGit(worktree, ["rev-list", "--count", `HEAD..${remoteHash}`], {}).then((r) => Number(r.stdout.trim())).catch(() => 0);
        return { isRepo: true, branch, changes, ahead, behind };
      }
    }
  }
  return { isRepo: true, branch, changes, ahead: 0, behind: 0 };
}
async function lsRemoteHash(worktree, { owner, repo, token, branch, proxy }) {
  const url = plainRemoteUrl(owner, repo);
  const out = await runGit(worktree, ["ls-remote", "--heads", url, `refs/heads/${branch}`], { token, proxy }).catch(() => void 0);
  if (out === void 0) return void 0;
  const line = out.stdout.split("\n").find((l) => l.trim() !== "");
  return line !== void 0 ? line.split(/\s+/)[0] : void 0;
}
async function pushRepo(worktree, opts) {
  const { owner, repo, token, branch, proxy } = opts;
  if (typeof token !== "string" || token === "") {
    throw new GitError("TOKEN_MISSING", "\u8BE5\u7ED1\u5B9A\u5C1A\u672A\u914D\u7F6E GitHub Token");
  }
  const isRepo = await runGit(worktree, ["rev-parse", "--is-inside-work-tree"], {}).then(() => true).catch(() => false);
  if (!isRepo) throw new GitError("NOT_A_REPO", "\u76EE\u6807\u76EE\u5F55\u4E0D\u662F git \u4ED3\u5E93\uFF0C\u8BF7\u5148\u5728\u672C\u5730 git init");
  const changes = await runGit(worktree, ["status", "--porcelain"], {}).then((r) => r.stdout.split("\n").filter((l) => l.trim() !== "").length).catch(() => 0);
  if (changes === 0) {
    throw new GitError("NOTHING_TO_PUSH", "\u6CA1\u6709\u672A\u63D0\u4EA4\u7684\u6539\u52A8\uFF0C\u65E0\u9700\u63A8\u9001");
  }
  await runGit(worktree, ["add", "-A"], {});
  const message = opts.commitMessage !== void 0 && opts.commitMessage.trim() !== "" ? opts.commitMessage.trim() : "chore: DSH sync";
  let commitOut = "";
  try {
    commitOut = (await runGit(worktree, ["commit", "-m", message], {})).stdout;
  } catch (err) {
    throw new GitError("COMMIT_FAILED", `\u63D0\u4EA4\u5931\u8D25\uFF1A${err instanceof Error ? err.message : String(err)}`, {
      stderr: err instanceof GitError ? err.details.stderr ?? "" : ""
    });
  }
  const url = plainRemoteUrl(owner, repo);
  try {
    const pushOut = await runGit(worktree, ["push", url, `HEAD:refs/heads/${branch}`], { token, proxy });
    return {
      pushed: true,
      commitMessage: message,
      committed: commitOut,
      pushedOutput: pushOut.stdout,
      pushedStderr: pushOut.stderr
    };
  } catch (err) {
    throw new GitError("PUSH_FAILED", `\u63A8\u9001\u5931\u8D25\uFF1A${err instanceof Error ? err.message : String(err)}`, {
      stderr: err instanceof GitError ? err.details.stderr ?? "" : ""
    });
  }
}
function plainRemoteUrl(owner, repo) {
  return `https://github.com/${owner}/${repo}.git`;
}

// src/rpc.js
var RPC_CHANNEL = "/dsh-github-push";
function toErrorPayload(err) {
  if (err instanceof GitError) {
    const details = {};
    if (typeof err.details.stderr === "string" && err.details.stderr !== "") details.stderr = err.details.stderr;
    return { code: err.code, message: err.message, details };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { code: "INTERNAL", message, details: {} };
}
function applyRpc(ctx, deps) {
  const { connection, store } = deps;
  const log = deps.log ?? (() => {
  });
  ctx.effect(() => connection.rpc.handle(RPC_CHANNEL, async (endpoint, payload) => {
    const args = (payload !== null && typeof payload === "object" && "args" in payload ? (
      /** @type {{args: Record<string, unknown>}} */
      payload.args
    ) : {}) ?? {};
    try {
      return { ok: true, value: await dispatch(endpoint, args) };
    } catch (err) {
      const error = toErrorPayload(err);
      if (error.code === "INTERNAL") log(`rpc ${endpoint} internal error: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
      return { ok: false, error };
    }
  }));
  async function dispatch(endpoint, args) {
    switch (endpoint) {
      case "state":
        return stateSnapshot();
      case "binding.upsert":
        return upsertBinding(args);
      case "binding.remove":
        return removeBinding(args);
      case "binding.probe":
        return probeBinding(args);
      case "push":
        return push(args);
      case "settings.get":
        return getSettings();
      case "settings.set":
        return setSettings(args);
      default:
        throw new GitError("BAD_REQUEST", `unknown endpoint: ${endpoint}`);
    }
  }
  function proxyFor() {
    const setting = store.getSetting("proxy");
    if (setting !== void 0 && setting !== "") return setting;
    if (process.env.HTTPS_PROXY !== void 0 && process.env.HTTPS_PROXY !== "") return process.env.HTTPS_PROXY;
    if (process.env.HTTP_PROXY !== void 0 && process.env.HTTP_PROXY !== "") return process.env.HTTP_PROXY;
    return void 0;
  }
  function getSettings() {
    return { proxy: store.getSetting("proxy") ?? "" };
  }
  function setSettings(args) {
    if (typeof args.proxy === "string") store.setSetting("proxy", args.proxy.trim());
    return getSettings();
  }
  async function stateSnapshot() {
    const bindings = store.listBindings();
    const proxy = proxyFor();
    const probed = [];
    for (const binding of bindings) {
      const id = (
        /** @type {string} */
        binding.id
      );
      const token = store.getToken(id);
      const status = await probeRepo(
        /** @type {string} */
        binding.localPath,
        {
          owner: (
            /** @type {string} */
            binding.repoOwner
          ),
          repo: (
            /** @type {string} */
            binding.repoName
          ),
          token,
          branch: (
            /** @type {string} */
            binding.branch
          ),
          proxy
        }
      );
      probed.push(publicBinding(binding, { status, hasToken: token !== void 0 }));
    }
    return { bindings: probed, settings: getSettings() };
  }
  async function upsertBinding(args) {
    const input = (
      /** @type {Record<string, unknown>} */
      args.input ?? {}
    );
    const id = typeof input.id === "string" ? input.id : void 0;
    for (const field of ["name", "localPath", "repoOwner", "repoName", "branch"]) {
      if (typeof input[field] !== "string" || input[field] === "") {
        throw new GitError("BAD_REQUEST", `${field} \u4E0D\u80FD\u4E3A\u7A7A`);
      }
    }
    const record = {
      id: id ?? `b${Date.now().toString(36)}`,
      name: input.name,
      localPath: input.localPath,
      repoOwner: input.repoOwner,
      repoName: input.repoName,
      branch: (
        /** @type {string} */
        input.branch ?? "main"
      )
    };
    store.upsertBinding(record);
    const token = typeof input.token === "string" && input.token !== "" ? input.token : void 0;
    if (token !== void 0) store.setToken(
      /** @type {string} */
      record.id,
      token
    );
    return { binding: publicBinding(record) };
  }
  async function removeBinding(args) {
    const id = typeof args.id === "string" ? args.id : "";
    if (id === "") throw new GitError("BAD_REQUEST", "id is required");
    const removed = store.removeBinding(id);
    return { removed };
  }
  async function probeBinding(args) {
    const id = typeof args.id === "string" ? args.id : "";
    const binding = store.getBinding(id);
    if (binding === void 0) throw new GitError("BINDING_NOT_FOUND", `no binding with id ${id}`);
    const token = store.getToken(id);
    const status = await probeRepo(
      /** @type {string} */
      binding.localPath,
      {
        owner: (
          /** @type {string} */
          binding.repoOwner
        ),
        repo: (
          /** @type {string} */
          binding.repoName
        ),
        token,
        branch: (
          /** @type {string} */
          binding.branch
        ),
        proxy: proxyFor()
      }
    );
    return { binding: publicBinding(binding, { status, hasToken: token !== void 0 }) };
  }
  async function push(args) {
    const id = typeof args.id === "string" ? args.id : "";
    const binding = store.getBinding(id);
    if (binding === void 0) throw new GitError("BINDING_NOT_FOUND", `no binding with id ${id}`);
    const token = store.getToken(id);
    if (token === void 0) throw new GitError("TOKEN_MISSING", "\u8BE5\u7ED1\u5B9A\u5C1A\u672A\u914D\u7F6E GitHub Token");
    const result = await pushRepo(
      /** @type {string} */
      binding.localPath,
      {
        owner: (
          /** @type {string} */
          binding.repoOwner
        ),
        repo: (
          /** @type {string} */
          binding.repoName
        ),
        token,
        branch: (
          /** @type {string} */
          binding.branch
        ),
        commitMessage: typeof args.commitMessage === "string" ? args.commitMessage : void 0,
        proxy: proxyFor()
      }
    );
    return result;
  }
}

// src/index.js
var name = "github-push";
var inject = ["connection"];
function apply(ctx) {
  const log = (message) => ctx.logger.warn(`[github-push] ${message}`);
  const store = new GithubStore({ log });
  void store.load();
  applyRpc(ctx, { connection: ctx.connection, store, log });
  ctx.logger.info(`[github-push] ready: ${store.listBindings().length} binding(s) stored, rpc channel ${RPC_CHANNEL}`);
}
export {
  apply,
  inject,
  name
};
