// Crops the USGS/MSL Gale HiRISE DEM mosaic (4 m overview) around the EVA area
import { fromUrl } from 'geotiff'; import fs from 'fs';
const out = process.argv[2] || "data/dem_gale_4m";
const t = await fromUrl('https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif.ovr');
const im = await t.getImage(0);
const X0 = 137.12416650612474, Y0 = -4.1296047962655988, D = 1.6870604858115121e-05 * 4;
const bbox = [137.368, -4.834, 137.418, -4.768];
const c0 = Math.floor((bbox[0] - X0) / D), c1 = Math.ceil((bbox[2] - X0) / D);
const r0 = Math.floor((Y0 - bbox[3]) / D), r1 = Math.ceil((Y0 - bbox[1]) / D);
const [ras] = await im.readRasters({ window: [c0, r0, c1, r1] });
const w = c1 - c0, h = r1 - r0;
let mn = 1e9, mx = -1e9, nd = 0; for (const v of ras) { if (v < -30000) { nd++; continue } mn = Math.min(mn, v); mx = Math.max(mx, v) }
console.log('w', w, 'h', h, 'min', mn, 'max', mx, 'nodata', nd);
const meta = { w, h, lon0: X0 + c0 * D, lat0: Y0 - r0 * D, d: D, src: 'USGS/MSL MSL_Gale_DEM_Mosaic_1m_v3 (overview 4 m)' };
fs.writeFileSync(out + '.json', JSON.stringify(meta)); fs.writeFileSync(out + '.f32', Buffer.from(ras.buffer));
