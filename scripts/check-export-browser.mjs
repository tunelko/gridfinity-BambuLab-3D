// Run against a production preview or the deployed app, with an isolated Chromium
// profile exposing CDP on loopback. Downloads must use a fresh, writable directory.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import JSZip from 'jszip';

const [appUrl, downloadDirectory, cdp = 'http://127.0.0.1:9229'] = process.argv.slice(2);
if (!appUrl || !downloadDirectory) throw new Error('Usage: node scripts/check-export-browser.mjs <app-url> <empty-download-directory> [cdp-url]');
const downloads = resolve(downloadDirectory);
assert.equal((await readdir(downloads)).length, 0, 'Use an empty directory so stale downloads cannot pass');
const target = await fetch(`${cdp}/json/new?about:blank`, { method: 'PUT' }).then(r => r.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let sequence = 0;
const pending = new Map();
const exceptions = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
  if (!message.id) return;
  const task = pending.get(message.id);
  if (!task) return;
  clearTimeout(task.timer);
  pending.delete(message.id);
  if (message.error) task.reject(new Error(JSON.stringify(message.error)));
  else task.resolve(message.result);
});
function call(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(check, label) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await check()) return;
    await pause(250);
  }
  throw new Error(`Timed out: ${label}`);
}
async function click(label) {
  await evaluate(`(() => {
    const button = document.querySelector('button[aria-label=${JSON.stringify(label)}]');
    if (!button || button.disabled) throw new Error('Unavailable export control');
    button.click();
  })()`);
}
async function downloaded(name) {
  const path = resolve(downloads, name);
  await waitFor(async () => {
    try { await readFile(path); return true; } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }, `download ${name}`);
  await waitFor(() => evaluate("!document.querySelector('[aria-label=\"Export all bins\"]').disabled"), 'export completion');
  return JSZip.loadAsync(await readFile(path), { checkCRC32: true });
}
async function verifyZip(name, count) {
  const archive = await downloaded(name);
  const stls = Object.keys(archive.files).filter(path => path.endsWith('.stl'));
  assert.equal(stls.length, count);
  for (const path of stls) {
    const bytes = await archive.file(path).async('uint8array');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    assert.equal(bytes.byteLength, 84 + view.getUint32(80, true) * 50);
    assert.ok(view.getUint32(80, true) > 0);
  }
  assert.ok(archive.file('README.txt'));
  const model = await JSZip.loadAsync(await archive.file('model.3mf').async('uint8array'), { checkCRC32: true });
  await verifyModel(model, count);
  console.log(`${name}: ${count} STL files + model.3mf + README.txt; CRC and mesh records passed`);
}
async function verifyModel(archive, count) {
  const xml = await archive.file('3D/3dmodel.model').async('string');
  assert.match(xml, /unit="millimeter"/);
  assert.equal([...xml.matchAll(/<item objectid=/g)].length, count);
}

try {
  await call('Page.enable');
  await call('Runtime.enable');
  await call('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await call('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await call('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('gridfinity-onboarding-done', '1');" });
  const bin = { y: 0, w: 1, d: 1, h: 1, cr: 3.75, wt: 1.2, bt: 0.8, sl: 1, ls: 0, lw: 12, mg: 0, sc: 0, dx: 0, dy: 0, gr: '' };
  const layout = { c: 2, r: 1, b: [{ ...bin, x: 0, lb: 'First' }, { ...bin, x: 1, lb: 'Second' }] };
  const url = new URL(appUrl);
  url.hash = `layout=${Buffer.from(encodeURIComponent(JSON.stringify(layout))).toString('base64')}`;
  await call('Page.navigate', { url: url.href });
  await waitFor(() => evaluate("Boolean(document.querySelector('select[aria-label=\"Export format\"]'))"), 'ZIP format selector');
  assert.equal(await evaluate("document.querySelector('select[aria-label=\"Export format\"]').value"), 'zip');
  await click('Export all bins');
  await verifyZip('gridfinity_layout_2x1.zip', 2);
  await click('Export selected bin');
  await verifyZip('gridfinity_Second.zip', 1);
  await click('Export fit test: two bins and a baseplate');
  await verifyZip('gridfinity_fit-test.zip', 3);
  await evaluate("(() => { const select=document.querySelector('select[aria-label=\"Export format\"]'); select.value='3mf'; select.dispatchEvent(new Event('change',{bubbles:true})); })()");
  await click('Export all bins');
  await verifyModel(await downloaded('gridfinity_layout_2x1.3mf'), 2);
  assert.deepEqual(exceptions, []);
  console.log('Direct 3MF download passed; zero browser exceptions; four actual browser downloads verified');
} finally {
  socket.close();
  await fetch(`${cdp}/json/close/${target.id}`);
}
