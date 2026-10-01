import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createTmuxInspectorPlugin,
  type InspectorContext,
  type InspectorLaunch,
  type TmuxRunner,
} from "../extensions/lib/tmux-inspector";

const SOCKET = "/private/tmp/tmux-501/default";
const ENV = { TMUX: `${SOCKET},123,0`, TMUX_PANE: "%1" };

interface Call {
  args: string[];
}

type Response = string | Error | ((args: string[]) => string);

function fakeRunner(responses: Record<string, Response>): {
  run: TmuxRunner;
  calls: Call[];
} {
  const calls: Call[] = [];
  const run: TmuxRunner = async (args) => {
    calls.push({ args });
    const command = args[2];
    const response = responses[command ?? ""];
    if (response instanceof Error) throw response;
    const stdout = typeof response === "function" ? response(args) : response;
    return { stdout: stdout ?? "" };
  };
  return { run, calls };
}

function splitCall(calls: Call[]): string[] | undefined {
  return calls.find((call) => call.args[2] === "split-window")?.args;
}

function setCall(calls: Call[]): string[] | undefined {
  return calls.find((call) => call.args[2] === "set-option")?.args;
}

/** Answers the pane-size query with the given cell dimensions. */
function paneSize(width: number, height: number): (args: string[]) => string {
  return (args) =>
    args.at(-1) === "#{pane_width} #{pane_height}" ? `${width} ${height}` : "";
}

let asyncDir: string;

beforeEach(() => {
  asyncDir = mkdtempSync(join(tmpdir(), "tmux-inspector-"));
});

afterEach(() => {
  rmSync(asyncDir, { recursive: true, force: true });
});

function context(
  overrides: Partial<InspectorContext["target"]> = {},
  env: NodeJS.ProcessEnv = ENV,
): InspectorContext {
  return {
    cwd: "/repo",
    env,
    target: {
      runId: "run-abc",
      asyncDir,
      status: { cwd: "/repo/child", state: "running" },
      ...overrides,
    },
  };
}

const launch: InspectorLaunch = {
  executable: "/usr/local/bin/node",
  argv: ["/x/inspector-runner.mjs", "--run-id", "run-abc"],
  displayCommand: "node '/x/inspector-runner.mjs' --run-id 'run-abc'",
  allowSteer: true,
  allowStop: true,
  sessionRoots: [],
};

describe("available", () => {
  test("true inside tmux with a pane id", () => {
    const plugin = createTmuxInspectorPlugin({ run: fakeRunner({}).run });
    expect(plugin.available(context())).toBe(true);
  });

  test("false outside tmux", () => {
    const plugin = createTmuxInspectorPlugin({ run: fakeRunner({}).run });
    expect(plugin.available(context({}, {}))).toBe(false);
  });
});

describe("open", () => {
  test("splits beside the source pane, execs argv directly, tags and binds the pane", async () => {
    const { run, calls } = fakeRunner({ "split-window": "%7\n" });
    const plugin = createTmuxInspectorPlugin({ run });

    const result = await plugin.open(context(), launch, { focus: false });

    expect(result.isError).toBeUndefined();
    expect(splitCall(calls)).toEqual([
      "-S",
      SOCKET,
      "split-window",
      "-h",
      "-d",
      "-P",
      "-F",
      "#{pane_id}",
      "-t",
      "%1",
      "-c",
      "/repo/child",
      "--",
      launch.executable,
      ...launch.argv,
    ]);
    expect(setCall(calls)).toEqual([
      "-S",
      SOCKET,
      "set-option",
      "-p",
      "-t",
      "%7",
      "@pi-subagents-inspector",
      "run-abc",
    ]);
    const binding = JSON.parse(
      readFileSync(join(asyncDir, "inspectors", "tmux.json"), "utf8"),
    );
    expect(binding).toMatchObject({
      kind: "tmux-inspector",
      runId: "run-abc",
      paneId: "%7",
      socket: SOCKET,
    });
    expect(plugin.owns(context())).toBe(true);
  });

  test("focuses the new pane when focus is true", async () => {
    const { run, calls } = fakeRunner({ "split-window": "%7" });
    const plugin = createTmuxInspectorPlugin({ run });
    await plugin.open(context(), launch, { focus: true });
    expect(splitCall(calls)).not.toContain("-d");
  });

  test("binds per child index", async () => {
    const { run, calls } = fakeRunner({ "split-window": "%8" });
    const plugin = createTmuxInspectorPlugin({ run });
    await plugin.open(context({ index: 2 }), launch, {});
    expect(setCall(calls)?.at(-1)).toBe("run-abc:2");
    expect(plugin.owns(context({ index: 2 }))).toBe(true);
    expect(plugin.owns(context())).toBe(false);
  });

  test("splits side by side when the pane is wide", async () => {
    const { run, calls } = fakeRunner({
      "display-message": paneSize(200, 50),
      "split-window": "%7",
    });
    await createTmuxInspectorPlugin({ run }).open(context(), launch, {});
    expect(splitCall(calls)?.[3]).toBe("-h");
  });

  test("splits stacked when the pane is tall", async () => {
    const { run, calls } = fakeRunner({
      "display-message": paneSize(90, 60),
      "split-window": "%7",
    });
    await createTmuxInspectorPlugin({ run }).open(context(), launch, {});
    expect(splitCall(calls)?.[3]).toBe("-v");
  });

  test("corrects for cell aspect ratio: 120x50 is visually wide", async () => {
    const { run, calls } = fakeRunner({
      "display-message": paneSize(120, 50),
      "split-window": "%7",
    });
    await createTmuxInspectorPlugin({ run }).open(context(), launch, {});
    expect(splitCall(calls)?.[3]).toBe("-h");
  });

  test("falls back to side by side when the size query fails", async () => {
    const { run, calls } = fakeRunner({
      "display-message": new Error("no server"),
      "split-window": "%7",
    });
    const result = await createTmuxInspectorPlugin({ run }).open(
      context(),
      launch,
      {},
    );
    expect(result.isError).toBeUndefined();
    expect(splitCall(calls)?.[3]).toBe("-h");
  });

  test("returns an error result when tmux fails", async () => {
    const { run } = fakeRunner({ "split-window": new Error("no space") });
    const plugin = createTmuxInspectorPlugin({ run });
    const result = await plugin.open(context(), launch, {});
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("no space");
    expect(plugin.owns(context())).toBe(false);
  });
});

describe("owns", () => {
  test("rejects a binding for another run", async () => {
    const { run } = fakeRunner({ "split-window": "%7" });
    const plugin = createTmuxInspectorPlugin({ run });
    await plugin.open(context(), launch, {});
    expect(plugin.owns(context({ runId: "run-other" }))).toBe(false);
  });

  test("false with no binding", () => {
    mkdirSync(join(asyncDir, "inspectors"));
    const plugin = createTmuxInspectorPlugin({ run: fakeRunner({}).run });
    expect(plugin.owns(context())).toBe(false);
  });
});

describe("status and close", () => {
  async function opened(responses: Record<string, string | Error>) {
    const fake = fakeRunner({ "split-window": "%7", ...responses });
    const plugin = createTmuxInspectorPlugin({ run: fake.run });
    await plugin.open(context(), launch, {});
    fake.calls.length = 0;
    return { plugin, calls: fake.calls };
  }

  test("status reports a live pane", async () => {
    const { plugin } = await opened({ "display-message": "%7\trun-abc\t0" });
    const result = await plugin.status?.(context());
    expect(result?.isError).toBeUndefined();
    expect(result?.content[0]?.text).toContain("%7");
  });

  test("status drops the binding when the pane is gone", async () => {
    const { plugin } = await opened({
      "display-message": new Error("can't find pane: %7"),
    });
    const result = await plugin.status?.(context());
    expect(result?.content[0]?.text).toContain("gone");
    expect(plugin.owns(context())).toBe(false);
  });

  test("close kills a verified pane and removes the binding", async () => {
    const { plugin, calls } = await opened({
      "display-message": "%7\trun-abc\t0",
    });
    const result = await plugin.close?.(context());
    expect(result?.isError).toBeUndefined();
    expect(calls.at(-1)?.args).toEqual(["-S", SOCKET, "kill-pane", "-t", "%7"]);
    expect(plugin.owns(context())).toBe(false);
  });

  test("close refuses a pane whose tag no longer matches", async () => {
    const { plugin, calls } = await opened({
      "display-message": "%7\t\t0",
    });
    const result = await plugin.close?.(context());
    expect(result?.isError).toBe(true);
    expect(calls.some((call) => call.args[2] === "kill-pane")).toBe(false);
    expect(plugin.owns(context())).toBe(false);
  });
});
