// Builds js/data-nasa.js from downloaded NASA files (run from project root)
const fs=require('fs');
const tr=JSON.parse(fs.readFileSync('data/msl_traverse.json'));
const wp=JSON.parse(fs.readFileSync('data/msl_waypoints.json')).features.map(f=>f.properties);
const photos=JSON.parse(fs.readFileSync('data/photos.json'));
const r5=x=>Math.round(x*1e5)/1e5;
// full traverse, decimated (every 3rd vertex) for the overview line
const full=[];for(const f of tr.features){const c=f.geometry.coordinates;c.forEach((p,i)=>{if(i%3===0||i===c.length-1)full.push([r5(p[0]),r5(p[1])])})}
// rover stops (one per drive) from 2023 onward: sol, lon, lat, elev, tilt, km
const stops=wp.map(p=>[p.sol,r5(p.lon),r5(p.lat),Math.round(p.elev_geoid*10)/10,p.tilt,p.dist_km]);
const ph={};for(const k in photos)ph[k]={sol:photos[k].sol,imgs:photos[k].imgs.map(i=>({src:i.local,remote:i.url,az:Math.round(i.az),el:Math.round(i.el),kind:i.kind,date:i.date}))};
const last=wp[wp.length-1];
const out=`// GERADO AUTOMATICAMENTE a partir de dados NASA/JPL (MMGIS MSL traverse + raw images API).
// Fonte: https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/  |  https://mars.nasa.gov/api/v1/raw_image_items/
// Gerado em ${new Date().toISOString().slice(0,10)}. Ultimo sol na fonte: ${last.sol}.
window.NASA = {
  traverseFull: ${JSON.stringify(full)},
  // [sol, lon, lat, elevacao_m (geoide), inclinacao_rover_graus, km_total]
  roverStops: ${JSON.stringify(stops)},
  photos: ${JSON.stringify(ph)},
  lastSol: ${last.sol}
};
`;
fs.writeFileSync('js/data-nasa.js',out);console.log('bytes',out.length,'full pts',full.length,'stops',stops.length);
