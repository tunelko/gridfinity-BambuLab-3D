import JSZip from 'jszip';

export interface TriangleMesh {
  vertices: Float32Array;  // [x0,y0,z0, x1,y1,z1, ...]
  triangles: Uint32Array;  // [v0,v1,v2, v0,v1,v2, ...]
}

/** Convert a Manifold object to our TriangleMesh format. */
export function manifoldToTriangleMesh(manifoldObj: any): TriangleMesh {
  const mesh = manifoldObj.getMesh();
  const numVert: number = mesh.numVert;
  const numProp: number = mesh.numProp;
  const vertProps: Float32Array = mesh.vertProperties;
  const triVerts: Uint32Array = mesh.triVerts;

  const vertices = new Float32Array(numVert * 3);
  for (let i = 0; i < numVert; i++) {
    const offset = i * numProp;
    vertices[i * 3] = vertProps[offset];
    vertices[i * 3 + 1] = vertProps[offset + 1];
    vertices[i * 3 + 2] = vertProps[offset + 2];
  }

  return { vertices, triangles: new Uint32Array(triVerts) };
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateObjects(meshes: { mesh: TriangleMesh; name: string }[]): string {
  let xml = '';

  meshes.forEach((item, idx) => {
    const { mesh, name } = item;
    const numVerts = mesh.vertices.length / 3;
    const numTris = mesh.triangles.length / 3;
    const volumeId = idx * 2 + 1;
    const objectId = idx * 2 + 2;

    // Volume object: contains the actual mesh geometry
    xml += `<object id="${volumeId}" type="model">
      <mesh>
        <vertices>`;

    for (let i = 0; i < numVerts; i++) {
      const x = mesh.vertices[i * 3].toFixed(6);
      const y = mesh.vertices[i * 3 + 1].toFixed(6);
      const z = mesh.vertices[i * 3 + 2].toFixed(6);
      xml += `\n          <vertex x="${x}" y="${y}" z="${z}"/>`;
    }

    xml += `\n        </vertices>
        <triangles>`;

    for (let i = 0; i < numTris; i++) {
      const v1 = mesh.triangles[i * 3];
      const v2 = mesh.triangles[i * 3 + 1];
      const v3 = mesh.triangles[i * 3 + 2];
      xml += `\n          <triangle v1="${v1}" v2="${v2}" v3="${v3}"/>`;
    }

    xml += `\n        </triangles>
      </mesh>
    </object>
    `;

    // Parent object: references the volume as a component
    xml += `<object id="${objectId}" type="model" name="${escapeXml(name)}">
      <components>
        <component objectid="${volumeId}"/>
      </components>
    </object>
    `;
  });

  return xml;
}

function generateBuildItems(meshes: { mesh: TriangleMesh; name: string }[]): string {
  let xml = '';
  meshes.forEach((_, idx) => {
    const objectId = idx * 2 + 2;
    xml += `<item objectid="${objectId}" p:UUID="${generateUUID()}"/>\n    `;
  });
  return xml;
}

/** Package meshes into a .3mf file (ZIP/OPC). Returns a Blob. */
export async function exportTo3MF(
  meshes: { mesh: TriangleMesh; name: string }[],
): Promise<Blob> {
  const zip = new JSZip();
  const today = new Date().toISOString().split('T')[0];

  // 1. [Content_Types].xml
  zip.file('[Content_Types].xml',
`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  <Default Extension="config" ContentType="text/xml"/>
</Types>`);

  // 2. _rels/.rels
  zip.file('_rels/.rels',
`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`);

  // 3. Metadata/model_settings.config — KEY FILE for BambuStudio detection
  zip.file('Metadata/model_settings.config',
`<?xml version="1.0" encoding="UTF-8"?>
<config>
  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="plater_name" value=""/>
    <metadata key="locked" value="false"/>
  </plate>
</config>`);

  // 4. Metadata/project_settings.config
  zip.file('Metadata/project_settings.config',
`<?xml version="1.0" encoding="UTF-8"?>
<config>
</config>`);

  // 5. Metadata/slice_info.config
  zip.file('Metadata/slice_info.config',
`<?xml version="1.0" encoding="UTF-8"?>
<config>
</config>`);

  // 6. 3D/3dmodel.model — BambuStudio-compatible model XML
  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter"
  xml:lang="en-US"
  xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"
  xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06"
  xmlns:BambuStudio="http://schemas.bambulab.com/package/2021"
  requiredextensions="p">
  <metadata name="Application">BambuStudio-02.05.00.66</metadata>
  <metadata name="BambuStudio:3mfVersion">2</metadata>
  <metadata name="Copyright">Gridfinity Builder</metadata>
  <metadata name="CreationDate">${today}</metadata>
  <metadata name="ModificationDate">${today}</metadata>
  <metadata name="Description">Gridfinity bins</metadata>
  <resources>
    ${generateObjects(meshes)}
  </resources>
  <build>
    ${generateBuildItems(meshes)}
  </build>
</model>`;

  zip.file('3D/3dmodel.model', modelXml);

  return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/** Trigger browser download of a Blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
