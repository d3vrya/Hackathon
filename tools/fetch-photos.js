// Picks representative Navcam/Mastcam frames for each waypoint sol
const sols=[4102,4144,4199,4253,4321,4537,4580,4609,4641,4687];
const api=(sol,inst)=>`https://mars.nasa.gov/api/v1/raw_image_items/?order=date_taken%20asc&per_page=200&page=0&condition_1=msl:mission&condition_2=${sol}:sol:gte&condition_3=${sol}:sol:lte`+(inst?`&condition_4=${inst}:instrument`:'');
async function get(sol,inst){const r=await fetch(api(sol,inst));return (await r.json()).items||[]}
(async()=>{const out={};
for(const s0 of sols){let pick=[];
 for(const ds of [0,1,-1,2,-2,3,-3,4,-4,5,-5]){const sol=s0+ds;
  const nav=(await get(sol,'NAV_LEFT_B')).filter(i=>i.extended.sample_type==='full'&&!i.is_thumbnail&&/1024,1024/.test(i.subframe_rect));
  const horiz=nav.filter(i=>+i.extended.mast_el>-25&&+i.extended.mast_el<10);
  const ground=nav.filter(i=>+i.extended.mast_el<=-25&&+i.extended.mast_el>-60);
  // spread over azimuths
  const byAz=[];for(const i of horiz){if(byAz.every(j=>Math.abs(((+j.extended.mast_az-+i.extended.mast_az+540)%360)-180)>50))byAz.push(i)}
  pick=[...byAz.slice(0,3),...ground.slice(0,1)];
  if(pick.length>=2){out[s0]={sol,imgs:pick.map(i=>({url:i.https_url||i.url,cam:i.instrument,az:+i.extended.mast_az,el:+i.extended.mast_el,date:i.date_taken,kind:+i.extended.mast_el<=-25?'solo':'horizonte'}))};break}
 }
 // mastcam color, full frame
 for(const ds of [0,1,-1,2,-2,3,-3]){const ms=(await get(s0+ds,'MAST_LEFT')).filter(i=>i.extended.sample_type==='full'&&!i.is_thumbnail);
  const big=ms.filter(i=>{const m=/\((\d+),(\d+),(\d+),(\d+)\)/.exec(i.subframe_rect);return m&&(m[3]-m[1])>=1100});
  if(big.length){const i=big[Math.floor(big.length/2)];(out[s0]=out[s0]||{sol:s0,imgs:[]}).imgs.push({url:i.https_url||i.url,cam:i.instrument,az:+i.extended.mast_az,el:+i.extended.mast_el,date:i.date_taken,kind:'cor'});break}}
 console.error(s0,out[s0]&&out[s0].imgs.length);
}
console.log(JSON.stringify(out,null,1));})();
