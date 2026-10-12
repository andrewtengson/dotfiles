import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createTmuxInspectorPlugin,
  type InspectorContext,
  type InspectorLaunch,
  type TmuxRunner,
  toggleDashboard,
} from "../extensions/lib/tmux-inspector";

const SOCKET = "/private/tmp/tmux-501/default";
const ENV = { TMUX: `${SOCKET},123,0`, TMUX_PANE: "%1" };
const BINDING_OPTION = "@pi-subagents-inspector-binding";

interface Call {
  args: string[];
}

type Response = string | Error | ((args: string[]) => string);

/** Responses are keyed by tmux command name (the arg after "-S <socket>"). */
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

function callsFor(calls: Call[], command: string): string[][] {
  return calls.filter((call) => call.args[2] === command).map((c) => c.args);
}

function splitCall(calls: Call[]): string[] | undefined {
  return callsFor(calls, "split-window")[0];
}

/** argv tmux execs in the new pane (everything after "--"). */
function paneCommand(split: string[] | undefined): string[] {
  if (!split) return [];
  return split.slice(split.indexOf("--") + 1);
}

/** Answers the pane-size query with the given cell dimensions. */
function paneSize(width: number, height: number): (args: string[]) => string {
  return (args) =>
    args.at(-1) === "#{pane_width} #{pane_height}" ? `${width} ${height}` : "";
}

/** show-options answers: the session prefix key, no stored previous binding. */
const showOptions = (args: string[]): string =>
  args.at(-1) === "prefix" ? "C-Space\n" : "";

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

function readBindingFile(index?: number): Record<string, unknown> {
  const suffix = index === undefined ? "" : `-${index}`;
  return JSON.parse(
    readFileSync(join(asyncDir, "inspectors", `tmux${suffix}.json`), "utf8"),
  );
}

function bindingFile(): string {
  return join(asyncDir, "inspectors", "tmux.json");
}

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
  test("opens the transcript pane by default, tags and binds it", async () => {
    const { run, calls } = fakeRunner({
      "split-window": "%7\n",
      "show-options": showOptions,
    });
    const plugin = createTmuxInspectorPlugin({ run });

    const result = await plugin.open(context(), launch, { focus: false });

    expect(result.isError).toBeUndefined();
    const split = splitCall(calls);
    expect(split?.slice(0, 13)).toEqual([
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
    ]);
    expect(callsFor(calls, "split-window")).toHaveLength(1);
    const command = paneCommand(split);
    expect(command.slice(0, 2)).toEqual(["sh", "-c"]);
    expect(command.at(-1)).toBe(join(asyncDir, "output-0.log"));
    expect(command[2]).toContain("less");
    expect(command[2]).toContain("+F");
    expect(command).not.toContain(launch.executable);

    const sets = callsFor(calls, "set-option").filter((a) => a[5] === "%7");
    expect(sets).toContainEqual([
      "-S",
      SOCKET,
      "set-option",
      "-p",
      "-t",
      "%7",
      "@pi-subagents-inspector",
      "run-abc",
    ]);
    expect(sets).toContainEqual([
      "-S",
      SOCKET,
      "set-option",
      "-p",
      "-t",
      "%7",
      BINDING_OPTION,
      bindingFile(),
    ]);
    expect(readBindingFile()).toMatchObject({
      kind: "tmux-inspector",
      runId: "run-abc",
      paneId: "%7",
      socket: SOCKET,
      dashboard: {
        executable: launch.executable,
        argv: launch.argv,
        cwd: "/repo/child",
      },
    });
    expect(readBindingFile().dashboardPaneId).toBeUndefined();
    expect(plugin.owns(context())).toBe(true);
  });

  test("shows the dashboard toggle key in the transcript pager prompt", async () => {
    const { run, calls } = fakeRunner({
      "split-window": "%7",
      "show-options": showOptions,
    });
    await createTmuxInspectorPlugin({ run }).open(context(), launch, {});
    const hint = paneCommand(splitCall(calls)).find((arg) =>
      arg.includes("dashboard"),
    );
    expect(hint).toContain("C-Space t");
  });

  test("follows the child's own output log", async () => {
    const { run, calls } = fakeRunner({ "split-window": "%8" });
    const plugin = createTmuxInspectorPlugin({ run });
    await plugin.open(context({ index: 2 }), launch, {});
    expect(paneCommand(splitCall(calls)).at(-1)).toBe(
      join(asyncDir, "output-2.log"),
    );
    expect(plugin.owns(context({ index: 2 }))).toBe(true);
    expect(plugin.owns(context())).toBe(false);
  });

  test("follows the running step of an aggregate run", async () => {
    writeFileSync(
      join(asyncDir, "status.json"),
      JSON.stringify({ runId: "run-abc", currentStep: 3 }),
    );
    const { run, calls } = fakeRunner({ "split-window": "%8" });
    await createTmuxInspectorPlugin({ run }).open(context(), launch, {});
    expect(paneCommand(splitCall(calls)).at(-1)).toBe(
      join(asyncDir, "output-3.log"),
    );
  });

  test("installs the toggle key, keeping the previous binding as fallback", async () => {
    const { run, calls } = fakeRunner({
      "split-window": "%7",
      "show-options": showOptions,
      "list-keys": "bind-key    -T prefix t clock-mode\n",
    });
    await createTmuxInspectorPlugin({ run }).open(context(), launch, {});

    expect(callsFor(calls, "set-option")).toContainEqual([
      "-S",
      SOCKET,
      "set-option",
      "-g",
      "@pi-subagents-inspector-prev-key",
      "clock-mode",
    ]);
    const bind = callsFor(calls, "bind-key")[0];
    expect(bind?.slice(2, 8)).toEqual([
      "bind-key",
      "-T",
      "prefix",
      "t",
      "if-shell",
      "-F",
    ]);
    expect(bind?.[8]).toBe(`#{${BINDING_OPTION}}`);
    expect(bind?.[9]).toContain("run-shell -b");
    expect(bind?.[9]).toContain(`#{q:${BINDING_OPTION}}`);
    expect(bind?.[10]).toBe("clock-mode");
  });

  test("reinstalling reuses the stored fallback instead of nesting itself", async () => {
    const { run, calls } = fakeRunner({
      "split-window": "%7",
      "show-options": (args) =>
        args.at(-1) === "@pi-subagents-inspector-prev-key"
          ? "clock-mode\n"
          : showOptions(args),
      "list-keys": `bind-key -T prefix t if-shell -F "#{${BINDING_OPTION}}" "run-shell -b x" clock-mode\n`,
    });
    await createTmuxInspectorPlugin({ run }).open(context(), launch, {});
    expect(callsFor(calls, "set-option").some((a) => a[3] === "-g")).toBe(
      false,
    );
    expect(callsFor(calls, "bind-key")[0]?.[10]).toBe("clock-mode");
  });

  test("focuses the new pane when focus is true", async () => {
    const { run, calls } = fakeRunner({ "split-window": "%7" });
    const plugin = createTmuxInspectorPlugin({ run });
    await plugin.open(context(), launch, { focus: true });
    expect(splitCall(calls)).not.toContain("-d");
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

  test("a failed key install does not fail the open", async () => {
    const { run } = fakeRunner({
      "split-window": "%7",
      "bind-key": new Error("bad key"),
    });
    const result = await createTmuxInspectorPlugin({ run }).open(
      context(),
      launch,
      {},
    );
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain("bad key");
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

/** Answers pane-state queries: pane id -> tag. Missing panes error like tmux does. */
function panes(live: Record<string, string>): (args: string[]) => string {
  return (args) => {
    const target = args[args.indexOf("-t") + 1] ?? "";
    if (args.at(-1) === "#{pane_width} #{pane_height}") return "200 50";
    const tag = live[target];
    if (tag === undefined) throw new Error(`can't find pane: ${target}`);
    return `${target}\t${tag}\t0`;
  };
}

async function openedPlugin(responses: Record<string, Response>) {
  const fake = fakeRunner({ "split-window": "%7", ...responses });
  const plugin = createTmuxInspectorPlugin({ run: fake.run });
  await plugin.open(context(), launch, {});
  fake.calls.length = 0;
  return { plugin, fake };
}

describe("toggleDashboard", () => {
  test("opens the dashboard beside the transcript on the alternate screen", async () => {
    await openedPlugin({});
    const toggle = fakeRunner({
      "display-message": panes({ "%7": "run-abc" }),
      "split-window": "%9",
    });

    await toggleDashboard(bindingFile(), toggle.run);

    const split = splitCall(toggle.calls);
    expect(split).toContain("%7");
    expect(split).not.toContain("-d");
    expect(split?.slice(split.indexOf("-c"), split.indexOf("-c") + 2)).toEqual([
      "-c",
      "/repo/child",
    ]);
    const command = paneCommand(split);
    expect(command.slice(0, 2)).toEqual(["sh", "-c"]);
    expect(command[2]).toContain("1049h");
    expect(command.slice(-4)).toEqual([launch.executable, ...launch.argv]);
    expect(callsFor(toggle.calls, "set-option")).toContainEqual([
      "-S",
      SOCKET,
      "set-option",
      "-p",
      "-t",
      "%9",
      "@pi-subagents-inspector",
      "run-abc#dashboard",
    ]);
    expect(callsFor(toggle.calls, "set-option")).toContainEqual([
      "-S",
      SOCKET,
      "set-option",
      "-p",
      "-t",
      "%9",
      BINDING_OPTION,
      bindingFile(),
    ]);
    expect(readBindingFile().dashboardPaneId).toBe("%9");
  });

  test("closes an open dashboard", async () => {
    await openedPlugin({});
    const live = { "%7": "run-abc", "%9": "run-abc#dashboard" };
    await toggleDashboard(
      bindingFile(),
      fakeRunner({ "display-message": panes(live), "split-window": "%9" }).run,
    );

    const toggle = fakeRunner({ "display-message": panes(live) });
    await toggleDashboard(bindingFile(), toggle.run);

    expect(callsFor(toggle.calls, "kill-pane")).toEqual([
      ["-S", SOCKET, "kill-pane", "-t", "%9"],
    ]);
    expect(splitCall(toggle.calls)).toBeUndefined();
    expect(readBindingFile().dashboardPaneId).toBeUndefined();
  });

  test("reopens when the recorded dashboard pane is gone", async () => {
    await openedPlugin({});
    await toggleDashboard(
      bindingFile(),
      fakeRunner({
        "display-message": panes({ "%7": "run-abc" }),
        "split-window": "%9",
      }).run,
    );

    const toggle = fakeRunner({
      "display-message": panes({ "%7": "run-abc" }),
      "split-window": "%10",
    });
    await toggleDashboard(bindingFile(), toggle.run);

    expect(callsFor(toggle.calls, "kill-pane")).toEqual([]);
    expect(readBindingFile().dashboardPaneId).toBe("%10");
  });

  test("rejects a binding file that is not inside its run dir", async () => {
    await openedPlugin({});
    const elsewhere = mkdtempSync(join(tmpdir(), "tmux-inspector-other-"));
    try {
      const stray = join(elsewhere, "tmux.json");
      writeFileSync(stray, readFileSync(bindingFile()));
      const toggle = fakeRunner({});
      await expect(toggleDashboard(stray, toggle.run)).rejects.toThrow();
      expect(splitCall(toggle.calls)).toBeUndefined();
    } finally {
      rmSync(elsewhere, { recursive: true, force: true });
    }
  });
});

describe("status and close", () => {
  test("status reports a live pane", async () => {
    const { plugin } = await openedPlugin({
      "display-message": "%7\trun-abc\t0",
    });
    const result = await plugin.status?.(context());
    expect(result?.isError).toBeUndefined();
    expect(result?.content[0]?.text).toContain("%7");
  });

  test("status drops the binding when the pane is gone", async () => {
    const { plugin } = await openedPlugin({
      "display-message": new Error("can't find pane: %7"),
    });
    const result = await plugin.status?.(context());
    expect(result?.content[0]?.text).toContain("gone");
    expect(plugin.owns(context())).toBe(false);
  });

  test("close kills a verified pane and removes the binding", async () => {
    const { plugin, fake } = await openedPlugin({
      "display-message": "%7\trun-abc\t0",
    });
    const result = await plugin.close?.(context());
    expect(result?.isError).toBeUndefined();
    expect(fake.calls.at(-1)?.args).toEqual([
      "-S",
      SOCKET,
      "kill-pane",
      "-t",
      "%7",
    ]);
    expect(plugin.owns(context())).toBe(false);
  });

  test("close also kills an open dashboard pane", async () => {
    const live = { "%7": "run-abc", "%9": "run-abc#dashboard" };
    const { plugin, fake } = await openedPlugin({
      "display-message": panes(live),
    });
    await toggleDashboard(
      bindingFile(),
      fakeRunner({ "display-message": panes(live), "split-window": "%9" }).run,
    );
    fake.calls.length = 0;

    await plugin.close?.(context());

    expect(callsFor(fake.calls, "kill-pane")).toEqual([
      ["-S", SOCKET, "kill-pane", "-t", "%9"],
      ["-S", SOCKET, "kill-pane", "-t", "%7"],
    ]);
  });

  test("close refuses a pane whose tag no longer matches", async () => {
    const { plugin, fake } = await openedPlugin({
      "display-message": "%7\t\t0",
    });
    const result = await plugin.close?.(context());
    expect(result?.isError).toBe(true);
    expect(fake.calls.some((call) => call.args[2] === "kill-pane")).toBe(false);
    expect(plugin.owns(context())).toBe(false);
  });
});
