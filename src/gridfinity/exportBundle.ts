import JSZip from 'jszip';
import { exportTo3MF, type TriangleMesh } from './export3mf';
import { exportBinarySTL } from './exportStl';

export type ExportFormat = 'zip' | '3mf';

function safeName(name: string, fallback: string): string {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^[_-]+|[_-]+$/g, '').slice(0, 80) || fallback;
}

/** One download: full-layout 3MF plus one STL per part, or direct 3MF. */
export async function exportPrintFile(
  meshes: { mesh: TriangleMesh; name: string }[],
  name: string,
  format: ExportFormat = 'zip',
): Promise<{ blob: Blob; filename: string }> {
  if (!meshes.length) throw new Error('No meshes to export');
  // A fixed prefix also avoids platform-reserved names such as CON or AUX.
  const filename = `gridfinity_${safeName(name, 'model')}.${format}`;
  if (format === '3mf') return { blob: await exportTo3MF(meshes), filename };

  const zip = new JSZip();
  meshes.forEach(({ mesh, name: partName }, index) => {
    const part = `${String(index + 1).padStart(3, '0')}_${safeName(partName, 'part')}`;
    zip.file(`stl/${part}.stl`, exportBinarySTL(mesh));
  });
  zip.file('model.3mf', await (await exportTo3MF(meshes)).arrayBuffer(), { compression: 'STORE' });
  zip.file('README.txt', [
    'Gridfinity Builder print package',
    '',
    'Extract this ZIP before opening it in your slicer.',
    'Open model.3mf for the complete layout OR the individual files under stl/.',
    'Do not import both formats into the same print: they contain the same parts.',
    'All coordinates are in millimetres, Z up. Import at 100% scale.',
    'STL has no standard unit field, colours, or printer profiles; choose millimetres.',
    'Both formats preserve the same part positions. A slicer may recenter STL imports.',
    'Select your printer and filament, verify dimensions, and inspect the sliced toolpaths.',
    'Only the Fit Test package contains a baseplate; normal exports contain bins only.',
    'Print a fit test before committing to a full layout.',
    '',
  ].join('\n'));
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip', compression: 'DEFLATE' });
  return { blob, filename };
}
