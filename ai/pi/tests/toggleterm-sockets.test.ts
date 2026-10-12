import { describe, expect, test } from "bun:test";
import {
  reapStaleSockets,
  type SocketDeps,
  shutdownSocket,
  socketDir,
  socketName,
} from "../extensions/lib/toggleterm-sockets";

const DIR = "/tmp/tmux-502";

function deps(
  entries: string[],
  livePi: number[],
  overrides: Partial<SocketDeps> = {},
): { deps: SocketDeps; killed: string[]; removed: string[] } {
  const killed: string[] = [];
  const removed: string[] = [];
  return {
    killed,
    removed,
    deps: {
      list: () => entries,
      isPiAlive: (pid) => livePi.includes(pid),
      killServer: (name) => {
        killed.push(name);
      },
      remove: (path) => {
        removed.push(path);
      },
      ...overrides,
    },
  };
}

describe("socketDir", () => {
  test("defaults to /tmp/tmux-<uid>", () => {
    expect(socketDir({}, 502)).toBe("/tmp/tmux-502");
  });

  test("honours TMUX_TMPDIR", () => {
    expect(socketDir({ TMUX_TMPDIR: "/var/run" }, 502)).toBe(
      "/var/run/tmux-502",
    );
  });
});

describe("socketName", () => {
  test("is keyed by pi pid", () => {
    expect(socketName(1945)).toBe("pi-toggleterm-1945");
  });
});

describe("reapStaleSockets", () => {
  test("kills and removes sockets whose pi process is gone", () => {
    const {
      deps: d,
      killed,
      removed,
    } = deps(["default", "pi-toggleterm-100", "pi-toggleterm-200"], []);
    const reaped = reapStaleSockets(DIR, 1, d);
    expect(reaped).toEqual(["pi-toggleterm-100", "pi-toggleterm-200"]);
    expect(killed).toEqual(["pi-toggleterm-100", "pi-toggleterm-200"]);
    expect(removed).toEqual([
      `${DIR}/pi-toggleterm-100`,
      `${DIR}/pi-toggleterm-200`,
    ]);
  });

  test("keeps sockets of live pi processes and its own", () => {
    const {
      deps: d,
      killed,
      removed,
    } = deps(
      ["pi-toggleterm-1", "pi-toggleterm-300", "pi-toggleterm-400"],
      [300],
    );
    expect(reapStaleSockets(DIR, 1, d)).toEqual(["pi-toggleterm-400"]);
    expect(killed).toEqual(["pi-toggleterm-400"]);
    expect(removed).toEqual([`${DIR}/pi-toggleterm-400`]);
  });

  test("ignores names that are not toggleterm sockets", () => {
    const { deps: d, killed } = deps(
      ["default", "pi-toggleterm-", "pi-toggleterm-12x", "xpi-toggleterm-5"],
      [],
    );
    expect(reapStaleSockets(DIR, 1, d)).toEqual([]);
    expect(killed).toEqual([]);
  });

  test("a missing socket dir reaps nothing", () => {
    const { deps: d } = deps([], [], {
      list: () => {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      },
    });
    expect(reapStaleSockets(DIR, 1, d)).toEqual([]);
  });

  test("one failed removal does not stop the rest", () => {
    const removed: string[] = [];
    const { deps: d } = deps(["pi-toggleterm-100", "pi-toggleterm-200"], [], {
      remove: (path) => {
        if (path.endsWith("-100")) throw new Error("EACCES");
        removed.push(path);
      },
    });
    expect(reapStaleSockets(DIR, 1, d)).toEqual(["pi-toggleterm-200"]);
    expect(removed).toEqual([`${DIR}/pi-toggleterm-200`]);
  });
});

describe("shutdownSocket", () => {
  test("kills the server and deletes its socket file", () => {
    const { deps: d, killed, removed } = deps([], []);
    shutdownSocket(DIR, "pi-toggleterm-1", d);
    expect(killed).toEqual(["pi-toggleterm-1"]);
    expect(removed).toEqual([`${DIR}/pi-toggleterm-1`]);
  });
});
