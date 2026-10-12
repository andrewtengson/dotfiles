/**
 * Socket lifecycle for toggleterm's private tmux servers.
 *
 * tmux 3.x leaves its socket file behind when the server exits, and a pi that
 * crashes never runs session_shutdown, so its server keeps running. Each pi
 * reaps sockets whose owning pi process is gone.
 */

import { spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const SOCKET_PREFIX = "pi-toggleterm-";
const SOCKET_PATTERN = /^pi-toggleterm-(\d+)$/;
const TMUX_TIMEOUT_MS = 5_000;

export interface SocketDeps {
  list(dir: string): string[];
  /** True when pid is a running pi process; guards against pid reuse. */
  isPiAlive(pid: number): boolean;
  killServer(name: string): void;
  remove(path: string): void;
}

export function socketName(pid: number): string {
  return `${SOCKET_PREFIX}${pid}`;
}

/** Mirrors tmux's default socket directory for `-L`. */
export function socketDir(env: NodeJS.ProcessEnv, uid: number): string {
  return join(env.TMUX_TMPDIR || "/tmp", `tmux-${uid}`);
}

function isPiAlive(pid: number): boolean {
  const result = spawnSync("ps", ["-o", "comm=", "-p", String(pid)], {
    encoding: "utf8",
    timeout: TMUX_TIMEOUT_MS,
  });
  if (result.status !== 0) return false;
  const command = result.stdout.trim();
  return command === "pi" || command.endsWith("/pi");
}

function killServer(name: string): void {
  // Failure means no server is running on the socket: the common stale case.
  spawnSync("tmux", ["-L", name, "kill-server"], {
    stdio: "ignore",
    timeout: TMUX_TIMEOUT_MS,
    env: { ...process.env, TMUX: "" },
  });
}

export const defaultSocketDeps: SocketDeps = {
  list: (dir) => readdirSync(dir),
  isPiAlive,
  killServer,
  remove: (path) => rmSync(path, { force: true }),
};

/** Kills and removes sockets of exited pi processes; returns the names reaped. */
export function reapStaleSockets(
  dir: string,
  ownPid: number,
  deps: SocketDeps = defaultSocketDeps,
): string[] {
  let entries: string[];
  try {
    entries = deps.list(dir);
  } catch {
    // No socket dir yet: tmux has never run for this user.
    return [];
  }
  const reaped: string[] = [];
  for (const entry of entries) {
    const pid = Number(entry.match(SOCKET_PATTERN)?.[1]);
    if (!Number.isInteger(pid) || pid === ownPid || deps.isPiAlive(pid))
      continue;
    try {
      deps.killServer(entry);
      deps.remove(join(dir, entry));
      reaped.push(entry);
    } catch {
      // Leave it for the next pi start; one stuck socket must not block the rest.
    }
  }
  return reaped;
}

/** Stops this pi's server and deletes the socket file tmux leaves behind. */
export function shutdownSocket(
  dir: string,
  name: string,
  deps: SocketDeps = defaultSocketDeps,
): void {
  deps.killServer(name);
  deps.remove(join(dir, name));
}
