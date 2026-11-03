'use strict';
// Wrap each cursor-agent frame in DEC 2026 synchronized-output markers so tmux
// paints the footer redraw atomically instead of showing the erased frame.
const BSU = '\x1b[?2026h';
const ESU = '\x1b[?2026l';
const entry = process.argv[1] ?? '';
const isCursorAgent = entry.includes('/cursor-cli/') || entry.includes('/cursor-agent/');

if (process.stdout.isTTY && isCursorAgent) {
  const write = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, encoding, cb) => {
    if (typeof chunk === 'string') return write(BSU + chunk + ESU, encoding, cb);
    if (Buffer.isBuffer(chunk)) {
      return write(Buffer.concat([Buffer.from(BSU), chunk, Buffer.from(ESU)]), encoding, cb);
    }
    return write(chunk, encoding, cb);
  };
}
