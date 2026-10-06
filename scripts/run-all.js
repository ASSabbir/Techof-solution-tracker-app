// Tiny dev/start runner: launches the API and the web app together (no extra dependency needed).
const { spawn } = require('node:child_process');

const mode = process.argv[2] === 'start' ? 'start' : 'dev';
const procs = [
  { name: 'server', color: '\x1b[36m', args: ['run', mode, '-w', 'server'] },
  { name: 'client', color: '\x1b[35m', args: ['run', mode, '-w', 'client'] },
];
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];

function pipe(stream, prefix, out) {
  let buf = '';
  stream.on('data', (chunk) => {
    buf += chunk.toString();
    const lines = buf.split(/\r?\n/);
    buf = lines.pop();
    for (const line of lines) out.write(`${prefix} ${line}\n`);
  });
}

for (const p of procs) {
  const child = spawn(npm, p.args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', env: process.env });
  const prefix = `${p.color}[${p.name}]\x1b[0m`;
  pipe(child.stdout, prefix, process.stdout);
  pipe(child.stderr, prefix, process.stderr);
  child.on('exit', (code) => {
    console.log(`${prefix} exited with code ${code}`);
    shutdown(code || 0);
  });
  children.push(child);
}

let closing = false;
function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  for (const c of children) if (!c.killed) c.kill('SIGTERM');
  setTimeout(() => process.exit(code), 300);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
