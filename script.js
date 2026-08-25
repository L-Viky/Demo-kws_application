// Soglia di esecuzione dei comandi vocali: sotto questa confidenza il comando
// viene loggato in console e ignorato. E' un secondo filtro DOPO
// BNN_CFG.confThreshold (0.6, gate di bnnRunInference): i comandi tra le due
// soglie arrivano qui e restano visibili in console come "ignored", utile
// per tarare il valore. I comandi da tastiera/demo (conf=null) non filtrano.
const VOICE_CONF_THRESHOLD = 0.5;

// Riferimenti al canvas principale (dove viene disegnata la casa) e al suo contesto 2D
const C = document.getElementById('house');
const ctx = C.getContext('2d');

// COLORI — tavolozza usata nelle funzioni di disegno.
const COL = {
  //house
  wall:'#3a3028', wallDark:'#2a2218', wallLight:'#4a4038',
  floorSalotto:'#c8b89a', floorSalottoAlt:'#bca888',
  floorCamera:'#d4b896', floorCameraAlt:'#c8ac8a',
  floorBagno:'#c8d4d8', floorBagnoAlt:'#b8c8cc',
  floorCucina:'#d0c4a8', floorCucinaAlt:'#c4b89a',
  door:'#6a5040',

  // oggetti
  sofa:'#c8b89a', sofaDark:'#a89870', sofaCush:'#e8d8c0',
  table:'#b89870', tableTop:'#d4b890',
  bed:'#e8d4b0', bedDark:'#d4b890', pillow:'#f0e8d8', blanket:'#c4a870',
  tv:'#1a1a1a', tvScreen:'#0a0a1a',
  fireplace:'#4a3828', fireplaceOpen:'#1a0a08',
  bath:'#e8f0f4', bathInner:'#d0e4ec',
  toilet:'#e8ecf0', sink:'#dce8ec',
  fridgeBody:'#ccd4d8', fridgeDoor:'#d8e0e4',
  fridgeDisplayOff:'#151b1f', fridgeDisplayOn:'#8fe8ff',
  counter:'#c4b898', counterTop:'#d8cca8',
  stove:'#2a2a2a', stoveBurner:'#cc4444',
  desk:'#b89060', monitor:'#1a1a2a', monitorScreen:'#050518',
  rug:'#b04040', rugAlt:'#c05050', rugb: '#2c7cbc', rugbAlt: '#072742',
  plant:'#3a7a2a', plantDark:'#2a5a1a', pot:'#8a6040',
  lamp:'#d4b040', lampBase:'#8a8060',
  shutter:'#7a6a50', shutterOpen:'#4a3a28',
  hotspot:'rgba(74,200,160,0.18)',
  hotspotBorder:'rgba(74,200,160,0.6)',
  avatar:'#4ac8a0', avatarDark:'#2a9870', avatarHead:'#5ad8b0',
  blocked:'rgba(229,83,75,0.15)', blockedBorder:'rgba(229,83,75,0.7)',
};

// LAYOUT DELLA CASA
// Casa 2x2: bagno(top-left), camera(top-right), salotto(bottom-left), cucina(bottom-right).
const CELL = 260;   // lato di ogni stanza (quadrata)
const WALL = 12;    // spessore dei muri
const DOOR = 48;    // larghezza delle porte
const HW = CELL*2 + WALL*3, HH = CELL*2 + WALL*3; // dimensioni totali della casa

let scale = 1; // fattore di conversione "house space" -> pixel reali sul canvas (ricalcolato in resize())

// Adatta il canvas alla dimensione disponibile dello schermo, mantenendo le proporzioni della casa
function resize(){
  const g = document.getElementById('game');
  const sc = Math.min((g.offsetWidth-40)/HW, (g.offsetHeight-40)/HH, 1.6); // non ingrandire oltre 1.6x
  C.width = Math.round(HW*sc);
  C.height = Math.round(HH*sc);
  C.style.width = C.width+'px';
  C.style.height = C.height+'px';
  scale = sc;
  draw();
}

// Stanze: coordinate in "house space" (angolo in alto a sinistra del pavimento interno di ciascuna stanza)
const ROOMS_DEF = {
  salotto: {x:WALL,         y:WALL*2+CELL,  w:CELL, h:CELL, name:'Salotto'}, 
  camera:  {x:WALL*2+CELL,  y:WALL,         w:CELL, h:CELL, name:'Camera'},
  bagno:   {x:WALL,         y:WALL,         w:CELL, h:CELL, name:'Bagno'},  
  cucina:  {x:WALL*2+CELL,  y:WALL*2+CELL,  w:CELL, h:CELL, name:'Cucina'},
};

// Porte: ogni porta è un varco nel muro condiviso fra due stanze.
const DOORS = [
  {axis:'v', x:WALL+CELL, y:WALL+CELL/2-DOOR/2, len:DOOR},          // bagno-camera (muro verticale in alto)
  {axis:'h', x:WALL+CELL/2-DOOR/2, y:WALL+CELL, len:DOOR},          // bagno-salotto (muro orizzontale a sinistra)
  {axis:'h', x:WALL*2+CELL+CELL/2-DOOR/2, y:WALL+CELL, len:DOOR},   // camera-cucina (muro orizzontale a destra)
  {axis:'v', x:WALL+CELL, y:WALL*2+CELL+CELL/2-DOOR/2, len:DOOR},   // salotto-cucina (muro verticale in basso)
];

 
// STATO DEGLI OGGETTI INTERATTIVI
// Ogni oggetto ha: stanza di appartenenza, tipo (usato per decidere quale
// azione compiere e come disegnarlo), etichetta mostrata in UI, stato
// (booleano per on/off, stringa 'open'/'closed' per le tapparelle),
// posizione (x,y) e hotR = raggio dell'area di interazione (hotspot).
const OBJECTS = {
  // Salotto 
  luce_s:   {room:'salotto', type:'lamp',      label:'Luce',       state:false,  x:ROOMS_DEF.salotto.x+238, y:ROOMS_DEF.salotto.y+CELL-30,     hotR:30},
  tv_s:     {room:'salotto', type:'tv',        label:'TV',         state:false,  x:ROOMS_DEF.salotto.x+CELL-51, y:ROOMS_DEF.salotto.y+63,      hotR:30},
  camino:   {room:'salotto', type:'fireplace', label:'Camino',     state:false,  x:ROOMS_DEF.salotto.x+CELL/2,  y:ROOMS_DEF.salotto.y+CELL-55, hotR:35},
  // Camera 
  luce_cam: {room:'camera',  type:'lamp',      label:'Luce',       state:false,  x:WALL*2+CELL+60,  y:WALL+130,      hotR:30},
  tapp_cam: {room:'camera',  type:'shutter',   label:'Tapparella', state:'closed',x:WALL*2+CELL+30, y:WALL+12,      hotR:30},
  pc:       {room:'camera',  type:'pc',        label:'PC',         state:false,  x:WALL*2+CELL+CELL-50,y:WALL+CELL-50,hotR:30},
  // Bagno 
  luce_b:   {room:'bagno',   type:'lamp',      label:'Luce',       state:false,  x:ROOMS_DEF.bagno.x+CELL-41, y:ROOMS_DEF.bagno.y+41,        hotR:30},
  tapp_b:   {room:'bagno',   type:'shutter',   label:'Tapparella', state:'closed',x:ROOMS_DEF.bagno.x+160,     y:ROOMS_DEF.bagno.y+12,       hotR:30},
  // Cucina 
  luce_c:   {room:'cucina',  type:'lamp',      label:'Luce',       state:false,  x:WALL*2+CELL+50, y:WALL*2+CELL+150,hotR:30},
  frigo:    {room:'cucina',  type:'fridge',    label:'Frigo',      state:false,  x:WALL*2+CELL+CELL-40,y:WALL*2+CELL+CELL-60,hotR:30},
  fornelli: {room:'cucina',  type:'stove',     label:'Fornelli',   state:false,  x:WALL*2+2*CELL-36,   y:WALL*2+CELL+130,hotR:30},
};

 
// OSTACOLI — mobili solidi che l'avatar NON può attraversare.
const OBSTACLES = [
  // Salotto
  {x:ROOMS_DEF.salotto.x+20,          y:ROOMS_DEF.salotto.y+40,          w:45, h:100}, // divano (verticale)
  {x:OBJECTS.tv_s.x-19,               y:OBJECTS.tv_s.y-35,               w:38,       h:70}, // TV (verticale)
  {x:OBJECTS.camino.x-40,             y:OBJECTS.camino.y-15,             w:80,       h:30}, // camino
  // Camera
  {x:ROOMS_DEF.camera.x+CELL/2-45,    y:ROOMS_DEF.camera.y+20,           w:90,       h:65}, // letto
  {x:ROOMS_DEF.camera.x+CELL/2-65,    y:ROOMS_DEF.camera.y+28,           w:22,       h:22}, // comodino sx
  {x:ROOMS_DEF.camera.x+CELL/2+43,    y:ROOMS_DEF.camera.y+28,           w:22,       h:22}, // comodino dx
  {x:OBJECTS.pc.x-40,                 y:OBJECTS.pc.y-25,                 w:80,       h:35}, // scrivania+monitor
  // Bagno
  {x:ROOMS_DEF.bagno.x+20,            y:ROOMS_DEF.bagno.y+40,            w:80,       h:50}, // vasca
  {x:ROOMS_DEF.bagno.x+25,            y:ROOMS_DEF.bagno.y+CELL-65,       w:36,       h:35}, // WC
  {x:ROOMS_DEF.bagno.x+25,            y:ROOMS_DEF.bagno.y+125,           w:32,       h:38}, // lavandino
  // Cucina
  {x:ROOMS_DEF.cucina.x+CELL/2-45,    y:ROOMS_DEF.cucina.y+40,           w:90,       h:80}, // tavolo+sedie
  {x:ROOMS_DEF.cucina.x+CELL-60,      y:ROOMS_DEF.cucina.y+20,           w:50,       h:CELL-40}, // piano cucina
  {x:OBJECTS.frigo.x-18,              y:OBJECTS.frigo.y-30,              w:36,       h:50}, // frigo
];
// Piante: ostacoli circolari (più semplici da testare rispetto a un rettangolo)
const PLANT_OBSTACLES = [
  {x:ROOMS_DEF.salotto.x+20,      y:ROOMS_DEF.salotto.y+CELL-30,  r:14},
  {x:ROOMS_DEF.camera.x+20,       y:ROOMS_DEF.camera.y+CELL-30,   r:14},
  {x:ROOMS_DEF.cucina.x+20,       y:ROOMS_DEF.cucina.y+20,        r:14},
];

// Vero se il cerchio (x,y,r) dell'avatar tocca il rettangolo ostacolo o
// (distanza dal punto più vicino del rettangolo < raggio avatar)
function hitsRectObstacle(x,y,r,o){
  const cx=Math.max(o.x,Math.min(x,o.x+o.w));
  const cy=Math.max(o.y,Math.min(y,o.y+o.h));
  const dx=x-cx, dy=y-cy;
  return (dx*dx+dy*dy) < r*r;
}
// Vero se il cerchio avatar tocca un ostacolo circolare (es. pianta)
function hitsCircleObstacle(x,y,r,o){
  const dx=x-o.x, dy=y-o.y, rr=r+o.r;
  return (dx*dx+dy*dy) < rr*rr;
}
// Controllo aggregato: vero se (x,y) con raggio r tocca QUALSIASI ostacolo
function hitsObstacle(x,y,r){
  return OBSTACLES.some(o=>hitsRectObstacle(x,y,r,o)) || PLANT_OBSTACLES.some(o=>hitsCircleObstacle(x,y,r,o));
}

 
// AVATAR — posizione, raggio di collisione e velocità di movimento
let av = {x: ROOMS_DEF.salotto.x+140, y: ROOMS_DEF.salotto.y+90, r:11, speed:1};

// Direzione verso cui l'avatar sta "guardando" (versore normalizzato).
let facingDir = {x:0, y:1}; // default: guarda verso il basso (schermo)

 
// STATO GENERALE DEL SISTEMA
// systemState: 'listening' | 'interact' | 'blocked' — riflesso nel badge UI
// nearObj: oggetto attualmente nell'hotspot dell'avatar (o null)
// interactionEnabled: true dopo un "yes", finché l'avatar non si allontana
// blockedObj: oggetto rifiutato con "no", resta bloccato per BLOCK_TIMEOUT o finché l'avatar non si allontana abbastanza
 
let systemState='listening';
let nearObj=null;
let interactionEnabled=false;
let blockedObj=null;
let blockTimer=null, reproposTimer=null;
const BLOCK_TIMEOUT=10000, REPROPOS_TIMEOUT=8000; // ms
let micActive=false, audioCtx=null, analyser=null, micStream=null;
let micBusy=false; // true durante il setup/teardown asincrono del mic: ignora i click finché non è finito
let wfData=new Array(34).fill(2); // valori della waveform mostrata nel pannello
let keysDown={}; // tasti attualmente premuti (per il movimento WASD/frecce)

// Movimento vocale continuo: impostato dai comandi left/right/up/down/go,
// azzerato da "stop" o da qualunque input di movimento da tastiera.
let voiceMove={dx:0,dy:0};
let voiceLastDir=null; // ultima direzione vocale, riusata da "go"
const VOICE_DIRS={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]};

 
// FUNZIONI DI DISEGNO DI BASE
function tile(x,y,w,h,c1,c2,ts=20){
  const sx=Math.round(x*scale), sy=Math.round(y*scale);
  const sw=Math.round(w*scale), sh=Math.round(h*scale);
  ctx.fillStyle=c1; ctx.fillRect(sx,sy,sw,sh);
  ctx.fillStyle=c2;
  for(let tx=0;tx<w;tx+=ts){
    for(let ty=0;ty<h;ty+=ts){
      if((Math.floor(tx/ts)+Math.floor(ty/ts))%2===0)
        ctx.fillRect(Math.round((x+tx)*scale),Math.round((y+ty)*scale),Math.round(ts*scale),Math.round(ts*scale));
    }
  }
}
// Rettangolo pieno, con angoli arrotondati opzionali (r = raggio angolo)
function rect(x,y,w,h,c,r=0){
  const sx=Math.round(x*scale),sy=Math.round(y*scale),sw=Math.round(w*scale),sh=Math.round(h*scale);
  ctx.fillStyle=c;
  if(r>0){
    ctx.beginPath();ctx.roundRect(sx,sy,sw,sh,r*scale);ctx.fill();
  } else { ctx.fillRect(sx,sy,sw,sh); }
}
// Cerchio pieno
function circle(x,y,r,c){
  ctx.beginPath();ctx.arc(x*scale,y*scale,r*scale,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();
}
// Testo centrato (usato per le etichette delle stanze)
function txt(t,x,y,c,size=10,align='center'){
  ctx.fillStyle=c;ctx.font=`${size*scale}px 'Space Grotesk',sans-serif`;ctx.textAlign=align;
  ctx.fillText(t,x*scale,y*scale);
}

// DISEGNO DELLA SCENA — chiamata ad ogni frame da gameLoop()
function draw(){
  ctx.clearRect(0,0,C.width,C.height);
  // sfondo esterno (fuori dalla casa, si vede solo se il canvas non riempie tutto lo spazio)
  ctx.fillStyle='#0a0d12';
  ctx.fillRect(0,0,C.width,C.height);

  drawRooms();
  drawWalls();
  drawDoors();
  drawObjects();
  drawHotspots();
  drawAvatar();
  drawRoomLabels();
}

// Pavimenti delle 4 stanze, ognuno con la propria tinta/pattern
function drawRooms(){
  const R=ROOMS_DEF;
  tile(R.salotto.x,R.salotto.y,R.salotto.w,R.salotto.h,COL.floorSalotto,COL.floorSalottoAlt,26);
  tile(R.camera.x,R.camera.y,R.camera.w,R.camera.h,COL.floorCamera,COL.floorCameraAlt,26);
  tile(R.bagno.x,R.bagno.y,R.bagno.w,R.bagno.h,COL.floorBagno,COL.floorBagnoAlt,20);
  tile(R.cucina.x,R.cucina.y,R.cucina.w,R.cucina.h,COL.floorCucina,COL.floorCucinaAlt,26);
}

// Muri perimetrali + i due muri centrali che dividono la casa in 4 stanze
function drawWalls(){
  // Bordo esterno (i 4 lati della casa)
  ctx.fillStyle=COL.wall;
  ctx.fillRect(0,0,Math.round(HW*scale),Math.round(WALL*scale)); // top
  ctx.fillRect(0,Math.round((HH-WALL)*scale),Math.round(HW*scale),Math.round(WALL*scale)); // bottom
  ctx.fillRect(0,0,Math.round(WALL*scale),Math.round(HH*scale)); // left
  ctx.fillRect(Math.round((HW-WALL)*scale),0,Math.round(WALL*scale),Math.round(HH*scale)); // right
  // Muro verticale centrale
  rect(WALL+CELL,0,WALL,HH,COL.wall);
  // Muro orizzontale centrale
  rect(0,WALL+CELL,HW,WALL,COL.wall);
  // Leggera ombra per dare un minimo di profondità ai muri centrali
  ctx.fillStyle='rgba(0,0,0,0.18)';
  ctx.fillRect(0,Math.round(WALL*scale*0.7),Math.round(HW*scale),Math.round(WALL*scale*0.3));
  ctx.fillRect(0,Math.round((WALL*2+CELL)*scale*0.98),Math.round(HW*scale),Math.round(WALL*scale*0.3));
}

// Disegna le porte sopra ai muri (colore diverso per l'apertura)
function drawDoors(){
  DOORS.forEach(d=>{
    if(d.axis==='v'){
      rect(d.x,d.y,WALL,d.len,COL.door);
      ctx.fillStyle='rgba(0,0,0,0.3)';
      ctx.fillRect(Math.round(d.x*scale),Math.round(d.y*scale),Math.round(WALL*scale),Math.round(2*scale));
      ctx.fillRect(Math.round(d.x*scale),Math.round((d.y+d.len-2)*scale),Math.round(WALL*scale),Math.round(2*scale));
    } else {
      rect(d.x,d.y,d.len,WALL,COL.door);
      ctx.fillStyle='rgba(0,0,0,0.3)';
      ctx.fillRect(Math.round(d.x*scale),Math.round(d.y*scale),Math.round(2*scale),Math.round(WALL*scale));
      ctx.fillRect(Math.round((d.x+d.len-2)*scale),Math.round(d.y*scale),Math.round(2*scale),Math.round(WALL*scale));
    }
  });
}

// Disegna tutti i mobili/oggetti di ogni stanza. Le forme sono "a mano libera"
function drawObjects(){
  // ---- SALOTTO ----
  const S=ROOMS_DEF.salotto;
  // Tappeto (puramente decorativo, nessuna collisione)
  rect(S.x+10,S.y+CELL-240,80,CELL-110,COL.rug,3);
  rect(S.x+16,S.y+CELL-236,68,CELL-122,COL.rugAlt,2);
  // Divano 
  rect(S.x+20,S.y+40,45,100,COL.sofaDark,3);
  rect(S.x+20,S.y+40,40,100,COL.sofa,3);
  for(let i=0;i<2;i++) rect(S.x+24,S.y+53+i*38,20,32,COL.sofaCush,2); // cuscini divano
  // TV a parete destra: cambia colore schermo se accesa (obj.state)
  const tvS=OBJECTS['tv_s'];
  rect(tvS.x-19,tvS.y-35,38,70,COL.tv,2);
  rect(tvS.x-15,tvS.y-32,30,60,tvS.state?'#1a2a5a':COL.tvScreen,1);
  if(tvS.state){ // bagliore azzurro quando la TV è accesa
    ctx.fillStyle='rgba(88,166,255,0.15)';
    ctx.fillRect(Math.round((tvS.x-19)*scale),Math.round((tvS.y-36)*scale),Math.round(40*scale),Math.round(74*scale));
  }
  // Camino: se acceso (obj.state) disegna 3 "fiamme" (cerchi colorati sovrapposti)
  const fp=OBJECTS['camino'];
  rect(fp.x-40,fp.y-15,80,30,COL.fireplace,2);
  rect(fp.x-28,fp.y-10,56,20,COL.fireplaceOpen,1);
  if(fp.state){
    ctx.fillStyle='#cc4400';
    ctx.beginPath();ctx.arc(Math.round((fp.x-10)*scale),Math.round((fp.y-2)*scale),8*scale,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ff6600';
    ctx.beginPath();ctx.arc(Math.round(fp.x*scale),Math.round((fp.y-5)*scale),10*scale,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ffcc00';
    ctx.beginPath();ctx.arc(Math.round((fp.x+10)*scale),Math.round((fp.y-2)*scale),7*scale,0,Math.PI*2);ctx.fill();
  }
  drawPlant(S.x+20,S.y+CELL-30);    // pianta
  drawLamp(OBJECTS['luce_s']);      // lampada a soffitto

  // ---- CAMERA ----
  const CAM=ROOMS_DEF.camera;
  // Letto: base + materasso + copriletto + due cuscini
  rect(CAM.x+CELL/2-45,CAM.y+20,90,65,COL.bedDark,3);
  rect(CAM.x+CELL/2-42,CAM.y+22,84,60,COL.bed,2);
  rect(CAM.x+CELL/2-42,CAM.y+22,84,22,COL.blanket,2); // coperta
  rect(CAM.x+CELL/2-36,CAM.y+26,30,14,COL.pillow,2);
  rect(CAM.x+CELL/2+6,CAM.y+26,30,14,COL.pillow,2);
  // Comodini con lampadine decorative (non interattive) ai due lati del letto
  rect(CAM.x+CELL/2-65,CAM.y+28,22,22,COL.table,2);
  rect(CAM.x+CELL/2+43,CAM.y+28,22,22,COL.table,2);
  circle(CAM.x+CELL/2-54,CAM.y+32,6,COL.lamp);
  circle(CAM.x+CELL/2+54,CAM.y+32,6,COL.lamp);
  // PC/scrivania: monitor con schermo "acceso" (testo '>_' verde) se obj.state
  const pcO=OBJECTS['pc'];
  rect(pcO.x-40,pcO.y-10,80,20,COL.desk,2);
  rect(pcO.x-22,pcO.y-25,44,18,COL.monitor,2);
  rect(pcO.x-18,pcO.y-23,36,14,pcO.state?'#050a20':COL.monitorScreen,1);
  if(pcO.state){
    ctx.fillStyle=COL.accent||'#4ac8a0';
    ctx.font=`${7*scale}px JetBrains Mono`;
    ctx.fillText('>_',Math.round((pcO.x-12)*scale),Math.round((pcO.y-17)*scale));
  }
  drawPlant(CAM.x+20,CAM.y+CELL-30);   // pianta
  drawShutter(OBJECTS['tapp_cam']); // tapparella sul muro esterno in alto
  drawLamp(OBJECTS['luce_cam']);

  // ---- BAGNO ----
  const BAG=ROOMS_DEF.bagno;
  // Vasca da bagno + rubinetto
  rect(BAG.x+20,BAG.y+40,80,50,COL.bath,3);
  rect(BAG.x+26,BAG.y+46,68,38,COL.bathInner,2);
  rect(BAG.x+90,BAG.y+56,8,6,COL.sink,1);
  // WC (cassetta + tazza)
  rect(BAG.x+25,BAG.y+CELL-60,30,36,COL.sink,3);
  rect(BAG.x+25,BAG.y+CELL-60,12,36,COL.toilet,2);
  rect(BAG.x+30,BAG.y+CELL-55,5,7,'#8a9aaa',2);
  // Lavandino + rubinetto 
  rect(BAG.x+25,BAG.y+125,32,38,COL.sink,3);
  rect(BAG.x+29,BAG.y+129,22,30,'rgba(200,220,230,0.5)',1);
  circle(BAG.x+37,BAG.y+144,4,'#8a9aaa');
  // Tappeto (puramente decorativo, nessuna collisione)
  rect(BAG.x+CELL-130,BAG.y+CELL-130,80,CELL-178,COL.rugbAlt,3);
  rect(BAG.x+CELL-124,BAG.y+CELL-124,68,CELL-190,COL.rugb,2);
  drawShutter(OBJECTS['tapp_b']); // tapparella sul muro esterno in alto (come camera)
  drawLamp(OBJECTS['luce_b']);

  // ---- CUCINA ----
  const CUC=ROOMS_DEF.cucina;
  // Tappeto (puramente decorativo, nessuna collisione)
  rect(CUC.x+CELL/2-57,CUC.y+30,CELL-147,100,COL.plantDark,3);
  rect(CUC.x+CELL/2-50,CUC.y+35,CELL-160,88,COL.plant,2);
  // Tavolo + 4 sedie
  rect(CUC.x+CELL/2-45,CUC.y+50,90,60,COL.desk,3);
  rect(CUC.x+CELL/2-38,CUC.y+40,24,16,COL.sofa,2);
  rect(CUC.x+CELL/2+14,CUC.y+40,24,16,COL.sofa,2);
  rect(CUC.x+CELL/2-38,CUC.y+104,24,16,COL.sofa,2);
  rect(CUC.x+CELL/2+14,CUC.y+104,24,16,COL.sofa,2);
  // Piano cucina con 4 fornelli 
  rect(CUC.x+CELL-60,CUC.y+20,50,CELL-40,COL.counter,2);
  rect(CUC.x+CELL-56,CUC.y+24,42,CELL-50,COL.counterTop,1);
  const fo=OBJECTS['fornelli'];
  rect(fo.x-18,fo.y-15,36,30,COL.stove,2);
  [[-8,-8],[8,-8],[-8,8],[8,8]].forEach(([dx,dy])=>{
    circle(fo.x+dx,fo.y+dy,5,fo.state?COL.stoveBurner:'#3a3a3a');
  });
  // Frigo: corpo + sportelli, e un display digitale che si accende/spegne con lo stato del frigo
  const fr=OBJECTS['frigo'];
  rect(fr.x-18,fr.y-30,36,50,COL.fridgeBody,2);
  rect(fr.x-14,fr.y-26,28,20,COL.fridgeDoor,1);
  rect(fr.x-14,fr.y-4,28,20,COL.fridgeDoor,1);
  // Display: piccolo rettangolo sullo sportello superiore.
  const dW=14, dH=7, dX=fr.x-dW/2, dY=fr.y-22;
  if(fr.state){
    ctx.save();
    ctx.shadowColor='rgba(143,232,255,0.9)';
    ctx.shadowBlur=10*scale;
    rect(dX,dY,dW,dH,COL.fridgeDisplayOn,1);
    ctx.restore();
  } else {
    rect(dX,dY,dW,dH,COL.fridgeDisplayOff,1);
  }
  // Lavello cucina
  rect(CUC.x+CELL-54,CUC.y+25,36,24,COL.sink,2);
  rect(CUC.x+CELL-50,CUC.y+29,28,16,'rgba(200,220,230,0.4)',1);
  drawPlant(CUC.x+20,CUC.y+40);
  drawLamp(OBJECTS['luce_c']);
}

// Pianta decorativa: vaso + 5 "foglie" (cerchi verdi sovrapposti) — puramente estetica,
// la collisione vera è in PLANT_OBSTACLES
function drawPlant(x,y){
  circle(x,y,10,COL.pot);
  circle(x-6,y-10,7,COL.plant);
  circle(x+6,y-10,7,COL.plant);
  circle(x,y-14,8,COL.plant);
  circle(x-3,y-18,5,COL.plantDark);
  circle(x+4,y-17,5,COL.plantDark);
}

// Tapparella: cambia altezza/aspetto in base a obj.state ('open'/'closed')
function drawShutter(obj){
  const open=obj.state==='open';
  rect(obj.x-18,obj.y-8,36,open?12:30,COL.shutter,1);
  if(!open){
    for(let i=0;i<3;i++) rect(obj.x-16,obj.y-5+i*8,32,4,'rgba(0,0,0,0.2)',0); // lamelle chiuse
  }
  rect(obj.x-20,obj.y-12,40,6,'#5a5048',1);  // cassonetto
  rect(obj.x-20,obj.y-14,40,3,'#6a6058',1);
}

// Lampada a soffitto: cambia colore e aggiunge un alone di luce se accesa (obj.state)
function drawLamp(obj){
  circle(obj.x,obj.y,10,obj.state?COL.lamp:'#5a5040');
  if(obj.state){
    ctx.beginPath();
    ctx.arc(obj.x*scale,obj.y*scale,18*scale,0,Math.PI*2);
    ctx.fillStyle='rgba(227,179,65,0.12)';
    ctx.fill();
  }
  circle(obj.x,obj.y,5,obj.state?'#fff8c0':'#3a3828');
}

// Disegna un cerchio tratteggiato attorno a ogni oggetto abbastanza vicino
// all'avatar (dentro il suo hotspot), verde normalmente o rosso se l'oggetto
// è attualmente "bloccato" (rifiutato con un "no")
function drawHotspots(){
  Object.values(OBJECTS).forEach(obj=>{
    const d=Math.hypot(av.x-obj.x,av.y-obj.y);
    if(d<obj.hotR+av.r){
      const isBlocked=obj===blockedObj;
      ctx.beginPath();
      ctx.arc(obj.x*scale,obj.y*scale,obj.hotR*scale,0,Math.PI*2);
      ctx.fillStyle=isBlocked?COL.blocked:COL.hotspot;
      ctx.fill();
      ctx.strokeStyle=isBlocked?COL.blockedBorder:COL.hotspotBorder;
      ctx.lineWidth=1.5*scale;
      ctx.setLineDash([4*scale,3*scale]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });
}

// Disegna l'avatar
function drawAvatar(){
  ctx.beginPath();
  ctx.ellipse(av.x*scale,av.y*scale+av.r*scale*0.6,av.r*scale*0.8,av.r*scale*0.3,0,0,Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,0.35)';
  ctx.fill();
  circle(av.x,av.y,av.r,COL.avatarDark);
  circle(av.x,av.y,av.r-2,COL.avatar);
  circle(av.x,av.y-av.r*0.3,av.r*0.5,COL.avatarHead);
  // Occhi direzionali: due puntini scuri sulla testa, spostati verso facingDir.
  const hx=av.x, hy=av.y-av.r*0.3;               // centro della "testa"
  const ex=hx+facingDir.x*av.r*0.28, ey=hy+facingDir.y*av.r*0.28; // occhi spinti in avanti
  const px=-facingDir.y, py=facingDir.x;          // asse perpendicolare (distanza fra gli occhi)
  const sp=av.r*0.22, eyeR=Math.max(1,av.r*0.11);
  circle(ex+px*sp, ey+py*sp, eyeR, COL.avatarDark);
  circle(ex-px*sp, ey-py*sp, eyeR, COL.avatarDark);
  ctx.beginPath();
  ctx.arc(av.x*scale,av.y*scale,av.r*scale*1.5,0,Math.PI*2);
  ctx.fillStyle='rgba(74,200,160,0.07)';
  ctx.fill();
}

// Etichetta col nome della stanza, centrata in basso in ciascuna stanza
function drawRoomLabels(){
  ctx.font=`bold ${9*scale}px Space Grotesk`;
  ctx.fillStyle='rgba(79, 79, 79, 0.35)';
  ctx.textAlign='center';
  Object.values(ROOMS_DEF).forEach(r=>{
    ctx.fillText(r.name.toUpperCase(),(r.x+r.w/2)*scale,(r.y+r.h-10)*scale);
  });
}

 
// COLLISIONI / MOVIMENTO CONSENTITO
// Vero se il cerchio avatar (x,y,r) sta interamente dentro almeno una stanza
function insideAnyRoom(x,y,r){
  return Object.values(ROOMS_DEF).some(room=>
    x-r>=room.x && x+r<=room.x+room.w && y-r>=room.y && y+r<=room.y+room.h
  );
}
// Vero se il cerchio avatar (x,y,r) è dentro il varco di una porta
// (con una piccola tolleranza pari al raggio r, per un attraversamento fluido)
function inDoor(x,y,r){
  return DOORS.some(d=>{
    if(d.axis==='v'){
      return x+r>=d.x && x-r<=d.x+WALL && y>=d.y-r && y<=d.y+d.len+r;
    } else {
      return y+r>=d.y && y-r<=d.y+WALL && x>=d.x-r && x<=d.x+d.len+r;
    }
  });
}
// Funzione principale di collisione usata dal game loop
function canMove(x,y){
  if(hitsObstacle(x,y,av.r)) return false; // priorità: i mobili bloccano sempre
  return insideAnyRoom(x,y,av.r)||inDoor(x,y,av.r);
}

// Restituisce l'id della stanza in cui si trova attualmente l'avatar (o null se in un muro/porta)
function getCurrentRoom(){
  for(const [id,r] of Object.entries(ROOMS_DEF)){
    if(av.x>=r.x&&av.x<=r.x+r.w&&av.y>=r.y&&av.y<=r.y+r.h) return id;
  }
  return null;
}

 
// GAME LOOP — chiamato ad ogni frame (requestAnimationFrame)
let lastTime=0;
function gameLoop(ts){
  requestAnimationFrame(gameLoop);
  const dt=Math.min((ts-lastTime)/16,3); // delta time normalizzato (~1 a 60fps), clampato per evitare salti
  lastTime=ts;
  let moved=false;
  let dx=0,dy=0;
  if(keysDown['ArrowLeft']||keysDown['a']||keysDown['A']) dx-=1;
  if(keysDown['ArrowRight']||keysDown['d']||keysDown['D']) dx+=1;
  if(keysDown['ArrowUp']||keysDown['w']||keysDown['W']) dy-=1;
  if(keysDown['ArrowDown']||keysDown['s']||keysDown['S']) dy+=1;
  if(dx||dy){
    voiceMove.dx=0; voiceMove.dy=0; // la tastiera prende il controllo e ferma la marcia vocale
  } else {
    dx=voiceMove.dx; dy=voiceMove.dy;
  }
  if(dx||dy){
    const len=Math.hypot(dx,dy); // normalizza per non muoversi più veloce in diagonale
    facingDir.x=dx/len; facingDir.y=dy/len; // memorizza il verso di marcia per l'avatar
    dx=dx/len*av.speed*dt; dy=dy/len*av.speed*dt;
    const nx=av.x+dx, ny=av.y+dy;
    if(canMove(nx,ny)){av.x=nx;av.y=ny;moved=true;}          // prova il movimento pieno
    else if(canMove(nx,av.y)){av.x=nx;moved=true;}            // altrimenti solo orizzontale
    else if(canMove(av.x,ny)){av.y=ny;moved=true;}            // altrimenti solo verticale
    // Se l'avatar si è mosso ed è ormai lontano dall'oggetto bloccato, sblocca l'oggetto
    if(moved && blockedObj){
      const d=Math.hypot(av.x-blockedObj.x,av.y-blockedObj.y);
      if(d>blockedObj.hotR+av.r+10){
        blockedObj=null; clearTimeout(blockTimer);
      }
    }
  }
  const rId=getCurrentRoom();
  if(rId) document.getElementById('tbr').textContent=ROOMS_DEF[rId].name;
  checkNear();
  draw();
  updateBubblePos();
}

// Trova l'oggetto interattivo più vicino all'avatar (se dentro il suo hotspot) e gestisce lo stato quando l'oggetto cambia
function checkNear(){
  let found=null,minD=9999;
  Object.entries(OBJECTS).forEach(([id,obj])=>{
    const d=Math.hypot(av.x-obj.x,av.y-obj.y);
    if(d<obj.hotR+av.r && d<minD){found=obj;minD=d;}
  });
  if(found!==nearObj){
    nearObj=found;
    interactionEnabled=false; // avvicinandosi a un nuovo oggetto, serve un nuovo "yes"
    clearRepropos();
    if(found){
      if(found===blockedObj){
        showBubble(`${found.label} bloccata`,true);
        setSystemState('blocked','Bloccato: '+found.label);
      } else {
        showBubble(`Interagire con ${found.label}?`,false);
        setSystemState('interact','Vicino a: '+found.label);
        startRepropos();
      }
    } else {
      hideBubble();
      setSystemState('listening','');
    }
    updateRoomStatus();
  }
}

// Riposiziona la "bolla" sopra l'oggetto quando c'è un resize
function updateBubblePos(){
  const bub=document.getElementById('bubble');
  if(bub.style.display==='none'||!nearObj) return;
  const game=document.getElementById('game');
  const rect=C.getBoundingClientRect();
  const gameRect=game.getBoundingClientRect();
  const sx=(nearObj.x*scale)+(rect.left-gameRect.left);
  const sy=(nearObj.y*scale)+(rect.top-gameRect.top)-40;
  bub.style.left=Math.round(sx-90)+'px';
  bub.style.top=Math.round(sy-30)+'px';
}

function showBubble(text,blocked){
  const bub=document.getElementById('bubble');
  const bt=document.getElementById('btext');
  bt.textContent=text;
  bt.className='bubble-box'+(blocked?' blocked':'');
  bub.style.display='block';
}
function hideBubble(){document.getElementById('bubble').style.display='none';}

// Ripropone periodicamente la domanda "Interagire con X?"
function startRepropos(){
  clearRepropos();
  reproposTimer=setTimeout(()=>{
    if(nearObj&&nearObj!==blockedObj){
      showBubble(`Interagire con ${nearObj.label}?`,false);
      addLog('sistema','—','Riproposta: '+nearObj.label);
      startRepropos();
    }
  },REPROPOS_TIMEOUT);
}
function clearRepropos(){if(reproposTimer){clearTimeout(reproposTimer);reproposTimer=null;}}

// Aggiorna il badge di stato nel pannello (colore + testo) in base allo stato macchina
function setSystemState(state,detail){
  systemState=state;
  const b=document.getElementById('sbadge');
  const map={listening:['sb-l','● ascolto'],interact:['sb-i','● proposta'],blocked:['sb-b','● bloccato']};
  const [c,l]=map[state]||['sb-l','● ascolto'];
  b.className='sbadge '+c; b.textContent=l;
  document.getElementById('sd').textContent=detail||'';
}

 
// GESTIONE COMANDI VOCALI (o simulati/da tastiera) 
function handleCommand(word,conf){
  // Lampeggio rosso del pallino di stato per dare feedback "ho sentito qualcosa"
  const dot=document.getElementById('sdot');
  dot.className='sdot det';
  setTimeout(()=>{dot.className='sdot'+(micActive?' on':'');},500);
  document.getElementById('lw').textContent=word.toUpperCase();
  document.getElementById('lwc').textContent=conf?`confidenza: ${(conf*100).toFixed(0)}%`:'simulazione';
  // Specchia l'ultima parola anche nella striscia riassuntiva del pannello mobile
  const psw=document.getElementById('panelSummaryWord');
  if(psw) psw.textContent=word.toUpperCase();

  // Filtro di esecuzione sui comandi vocali (conf numerica; tastiera/demo passano)
  if(typeof conf==='number'){
    if(conf<VOICE_CONF_THRESHOLD){
      console.log(`[VOICE] "${word}" conf=${conf.toFixed(3)} < ${VOICE_CONF_THRESHOLD} - ignored`);
      addLog(word,conf,`sotto soglia ${VOICE_CONF_THRESHOLD}: ignorato`,true);
      return;
    }
    console.log(`[VOICE] "${word}" conf=${conf.toFixed(3)} >= ${VOICE_CONF_THRESHOLD} - executing`);
  }

  let action='', blocked=false;

  if(word==='yes'){
    // "yes" conferma l'interazione con l'oggetto attualmente vicino (se non bloccato)
    if(nearObj&&nearObj!==blockedObj){
      interactionEnabled=true;
      clearRepropos();
      showBubble(`Interazione con ${nearObj.label} attiva`,false);
      setSystemState('interact','Attivo: '+nearObj.label);
      action='✓ interazione: '+nearObj.label;
    } else action=nearObj?'oggetto bloccato':'nessun oggetto vicino';

  } else if(word==='no'){
    // "no" blocca l'oggetto vicino: verrà ignorato finché non scade BLOCK_TIMEOUT
    // o l'avatar non si allontana abbastanza
    if(nearObj){
      blockedObj=nearObj;
      interactionEnabled=false;
      clearRepropos();
      showBubble(`${nearObj.label} bloccata`,true);
      setSystemState('blocked','Bloccato: '+nearObj.label);
      action='✗ rifiutato: '+nearObj.label; blocked=true;
      if(blockTimer) clearTimeout(blockTimer);
      blockTimer=setTimeout(()=>{
        // Allo scadere del timeout, se l'oggetto è ancora quello bloccato e
        // l'avatar è ancora lì vicino, ripropone l'interazione
        if(blockedObj===nearObj){ blockedObj=null; if(nearObj){ showBubble(`Interagire con ${nearObj.label}?`,false); setSystemState('interact','Vicino a: '+nearObj.label); startRepropos(); } }
      },BLOCK_TIMEOUT);
    } else action='nessun oggetto vicino';

  } else if(['on','off','up','down'].includes(word)){
    if(!interactionEnabled){
      // up/down sono SEMPRE movimento dell'avatar finché non è attiva un'interazione
      // (con "yes"), indipendentemente dal fatto che ci sia un oggetto vicino,
      // che sia bloccato o che l'interazione non sia ancora stata confermata.
      if(word==='up'||word==='down'){action=voiceMoveCommand(word);}
      else if(nearObj===blockedObj){action='ignorato (bloccato)';blocked=true;}
      else if(nearObj){action='ignorato (dì prima "yes")';}
      else action='nessun oggetto vicino';
    } else if(nearObj){
      if(word==='on'||word==='off') action=activateObj(nearObj,word==='on');
      else if(word==='up') action=shutterMove(nearObj,'open');
      else if(word==='down') action=shutterMove(nearObj,'closed');
    } else action='nessun oggetto';

  } else if(word==='go'||word==='stop'||word==='left'||word==='right'){
    action=voiceMoveCommand(word);
  }

  addLog(word,conf,action,blocked);
  updateRoomStatus();
}

// Comandi vocali di movimento
function voiceMoveCommand(word){
  if(word==='stop'){
    if(voiceMove.dx||voiceMove.dy){voiceMove.dx=0;voiceMove.dy=0;return '🧍 avatar fermato';}
    return 'avatar già fermo';
  }
  if(word==='go'){
    if(voiceLastDir){
      [voiceMove.dx,voiceMove.dy]=VOICE_DIRS[voiceLastDir];
      return '🚶 parto verso '+voiceLastDir;
    }
    return 'nessuna direzione impostata: dì left/right/up/down';
  }
  // left/right/up/down: impostano solo la direzione (e fermano un movimento in corso),
  // il movimento vero e proprio parte solo quando arriva "go"
  voiceLastDir=word;
  voiceMove.dx=0; voiceMove.dy=0;
  const [fx,fy]=VOICE_DIRS[word];
  facingDir.x=fx; facingDir.y=fy; // gira subito l'avatar verso la direzione, anche prima di "go"
  return '➡️ direzione impostata: '+word+' (di\' "go" per partire)';
}

// Accende/spegne un oggetto (luce, TV, camino, frigo, PC) e restituisce il testo di log
function activateObj(obj,on){
  obj.state=on;
  if(obj.type==='lamp') return on?'💡 luce accesa':'💡 luce spenta';
  if(obj.type==='tv') return on?'📺 TV accesa':'📺 TV spenta';
  if(obj.type==='fireplace') return on?'🔥 camino acceso':'🔥 camino spento';
  if(obj.type==='fridge') return on?'❄ frigo aperto':'❄ frigo chiuso';
  if(obj.type==='pc') return on?'💻 PC acceso':'💻 PC spento';
  if(obj.type==='stove') return on?'🔥 fornelli accesi':'🔥 fornelli spenti';
  return 'azione eseguita';
}
// Apre/chiude una tapparella (solo se l'oggetto è effettivamente di tipo shutter)
function shutterMove(obj,state){
  if(obj.type!=='shutter') return 'non è una tapparella';
  obj.state=state;
  return state==='open'?'⬆ tapparella aperta':'⬇ tapparella chiusa';
}

// Rigenera l'elenco "Oggetti stanza" nel pannello laterale, con un pallino
// colorato per ogni oggetto della stanza in cui si trova ora l'avatar
function updateRoomStatus(){
  const rId=getCurrentRoom();
  const grid=document.getElementById('rsg');
  grid.innerHTML='';
  if(!rId) return;
  Object.values(OBJECTS).filter(o=>o.room===rId).forEach(obj=>{
    const row=document.createElement('div');
    row.className='rsr';
    let dc='rsd';
    if((obj.type==='lamp'||obj.type==='tv'||obj.type==='fireplace'||obj.type==='fridge'||obj.type==='pc')&&obj.state) dc+=' on';
    else if(obj.type==='shutter'&&obj.state==='open') dc+=' open';
    row.innerHTML=`<div class="${dc}"></div>${obj.label}`;
    grid.appendChild(row);
  });
}

 
// LOG COMANDI — aggiunge una riga al pannello di log (max 60 righe visibili)
function addLog(word,conf,action,blocked){
  const log=document.getElementById('logi');
  const now=new Date();
  const ts=[now.getHours(),now.getMinutes(),now.getSeconds()].map(n=>n.toString().padStart(2,'0')).join(':');
  const le=document.createElement('div');
  le.className='le'+(blocked?' bl':'');
  le.innerHTML=`<span class="lts">${ts}</span><span class="lw">${word}</span> <span class="la">→ ${action}</span>`;
  log.appendChild(le);
  log.scrollTop=log.scrollHeight;
  if(log.children.length>60) log.removeChild(log.firstChild);
}

 
// WAVEFORM — barre animate nel pannello che simulano/mostrano il segnale audio
const wfc=document.getElementById('wfc');
const wfx=wfc.getContext('2d');

function drawWF(){
  const W=wfc.offsetWidth||240,H=42;
  wfc.width=W;wfc.height=H;wfx.clearRect(0,0,W,H);
  const bw=Math.floor(W/wfData.length)-1;
  wfData.forEach((v,i)=>{
    const x=i*(bw+1),h=Math.max(2,v),yc=H/2;
    wfx.fillStyle=micActive?'#4ac8a0':'#2d333b';
    wfx.globalAlpha=micActive?.75:.35;
    wfx.fillRect(x,yc-h/2,bw,h);
  });
  wfx.globalAlpha=1;
}
// Loop separato dal game loop principale
function animWF(){
  if(analyser){
    const buf=new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buf);
    const step=Math.floor(buf.length/34);
    for(let i=0;i<34;i++) wfData[i]=Math.abs(buf[i*step]-128)/128*36+2;
  } else {
    for(let i=0;i<34;i++) wfData[i]=micActive?(Math.random()*10+2):2;
  }
  drawWF();
  requestAnimationFrame(animWF);
}

 
// MICROFONO — richiesta permesso e avvio/stop della cattura audio
// NB: richiede un "contesto sicuro" (HTTPS o localhost) per funzionare nel browser.
async function bnnConnectAudioGraph(stream, preferredRate){
  const Ctor=window.AudioContext||window.webkitAudioContext;
  let srcNode;
  try{
    audioCtx=preferredRate?new Ctor({sampleRate:preferredRate}):new Ctor();
    if(audioCtx.state==='suspended') await audioCtx.resume();
    srcNode=audioCtx.createMediaStreamSource(stream);
  }catch(e){
    if(!preferredRate) throw e;
    if(audioCtx){try{await audioCtx.close();}catch(_){/* già chiuso */}}
    audioCtx=null;
    return bnnConnectAudioGraph(stream,null);
  }
  analyser=audioCtx.createAnalyser();analyser.fftSize=256;
  srcNode.connect(analyser);

  bnnProcessor=audioCtx.createScriptProcessor(4096,1,1);
  srcNode.connect(bnnProcessor);
  bnnProcessor.connect(audioCtx.destination); // necessario in alcuni browser perché onaudioprocess scatti
  bnnProcessor.onaudioprocess=bnnOnAudioProcess;
  console.log('[BNN debug] AudioContext state:', audioCtx.state, '- sampleRate:', audioCtx.sampleRate);
}

function bnnTeardownAudio(){
  if(bnnProcessor){bnnProcessor.disconnect();bnnProcessor.onaudioprocess=null;bnnProcessor=null;}
  if(micStream)micStream.getTracks().forEach(t=>t.stop());
  if(audioCtx){try{audioCtx.close();}catch(_){/* già chiuso */}}
  micStream=null;audioCtx=null;analyser=null;
  bnnRing=new Float32Array(0);   // niente audio della sessione precedente alla prossima accensione
  bnnResampleState=null;
}

async function toggleMic(){
  if(micBusy) return;
  micBusy=true;
  try{
    if(!micActive){
      try{
        const stream=await navigator.mediaDevices.getUserMedia({audio:true});
        micStream=stream;
        // Stato pulito per la nuova sessione di cattura
        bnnRing=new Float32Array(0);
        bnnResampleState=null;
        bnnStreakWord=null;bnnStreak=0;bnnSuppressUntil=0;
        bnnSilenceSecs=0;bnnSignalSeen=false;bnnGraphRebuilt=false;
        const track=stream.getAudioTracks()[0];
        if(track)console.log('[BNN debug] traccia mic:',track.label,'muted=',track.muted,track.getSettings());
        // Primo tentativo direttamente a 16 kHz (rate di training)
        await bnnConnectAudioGraph(stream,BNN_CFG.sampleRate);

        micActive=true;
        document.getElementById('micb').classList.add('active');
        document.getElementById('micl').textContent='Ferma ascolto';
        document.getElementById('mico').textContent='⏹';
        document.getElementById('sdot').className='sdot on';

        if(bnnModel){
          addLog('sistema','—','Microfono attivo — inferenza BNN in esecuzione');
          startBnnLoop();
        } else {
          addLog('sistema','—','Microfono attivo — modello non caricato, uso DEMO simulata');
          startDemo();
        }
      }catch(e){
        console.error('[BNN] toggleMic:',e);
        bnnTeardownAudio();
        addLog('errore','—','Microfono non disponibile ('+(e.name||e.message||e)+')');
      }
    } else {
      micActive=false;
      bnnTeardownAudio();
      document.getElementById('micb').classList.remove('active');
      document.getElementById('micl').textContent='Avvia ascolto';
      document.getElementById('mico').textContent='🎙';
      document.getElementById('sdot').className='sdot';
      stopDemo();
      stopBnnLoop();
      addLog('sistema','—','Microfono spento');
    }
  } finally {
    micBusy=false;
  }
}

 
// BNN — CONFIGURAZIONE
const WORDS=['down','go','left','no','off','on','right','stop','up','yes','_silence_','_unknown_'];
const BNN_CFG = {
  sampleRate:  16000,
  frameLength: 400,   // 25ms a 16kHz
  frameStep:   312,   // hop 19.5ms: 51 frame coprono esattamente 16000 campioni (1s)
  nFFT:        512,   // prima potenza di 2 >= frameLength (per la FFT)
  nMels:       32,
  fMin:        20,
  fMax:        8000,  // come nel training: NON cambiare fMin/fMax senza riaddestrare
  nFrames:     51,    // frame temporali attesi dal modello -> input (51,32,1)
  // campioni audio necessari per produrre esattamente nFrames frame:
  get samplesNeeded(){ return (this.nFrames-1)*this.frameStep + this.frameLength; },
  modelUrl:    'assets/tfjs_model/model.json',
  confThreshold: 0.6, // sotto questa confidenza, il comando viene ignorato
  inferenceIntervalMs: 400, // ogni quanto tentare una nuova inferenza
  rmsGate: 0.01,      // sotto questo RMS il buffer è silenzio: inferenza saltata
  confirmRuns: 2,     // stessa parola vincente per N inferenze consecutive prima del trigger
  refractoryMs: 1000, // pausa dopo un comando accettato
  silenceWatchdogS: 2 // secondi di campioni a zero dopo cui il grafo audio è considerato muto
};

 
// BNN — CATTURA AUDIO
let bnnProcessor=null;
let bnnRing=new Float32Array(0);
let bnnSilenceSecs=0;    // secondi consecutivi di campioni ~zero dall'avvio della cattura
let bnnSignalSeen=false; // true al primo chunk con segnale reale: da lì il silenzio è silenzio vero
let bnnGraphRebuilt=false; // la cattura è già stata ricreata una volta

async function bnnHandleSilentMic(){
  if(!micActive||!micStream) return;
  const track=micStream.getAudioTracks()[0];
  console.warn('[BNN] solo silenzio dal microfono. ctxRate=',audioCtx&&audioCtx.sampleRate,
    'track=',track&&{label:track.label,muted:track.muted,readyState:track.readyState,settings:track.getSettings()});
  if(track&&track.muted){
    bnnSignalSeen=true; 
    addLog('errore','—','Traccia audio muta: il sistema non sta fornendo segnale (controllare il mic nelle impostazioni di sistema)');
    return;
  }
  if(!bnnGraphRebuilt&&audioCtx&&audioCtx.sampleRate===BNN_CFG.sampleRate){
    bnnGraphRebuilt=true;
    addLog('sistema','—','Nessun segnale a 16 kHz: ricreo la cattura al sample rate nativo del microfono');
    if(bnnProcessor){bnnProcessor.disconnect();bnnProcessor.onaudioprocess=null;bnnProcessor=null;}
    const old=audioCtx;audioCtx=null;analyser=null;
    try{await old.close();}catch(_){/* già chiuso */}
    if(!micActive||!micStream) return; // l'utente ha spento nel frattempo
    bnnRing=new Float32Array(0);
    bnnResampleState=null;
    bnnSilenceSecs=0; // il watchdog riparte sulla nuova cattura
    try{
      await bnnConnectAudioGraph(micStream,null);
      if(!micActive) bnnTeardownAudio(); // spento durante il rebuild: non lasciare un contesto orfano
    }catch(e){
      console.error('[BNN] ricreazione cattura audio fallita:',e);
      addLog('errore','—','Ricreazione cattura audio fallita ('+(e.name||e.message)+')');
    }
  } else {
    bnnSignalSeen=true; // stop watchdog: il silenzio non dipende dal sample rate
    addLog('errore','—','Il microfono fornisce solo silenzio: controllare device di input / volume di sistema');
  }
}

function bnnOnAudioProcess(e){
  if(!micActive||!audioCtx) return; // finestra di teardown/rebuild: scarta il chunk
  const input=e.inputBuffer.getChannelData(0);
  const srcRate=e.inputBuffer.sampleRate; // rate del contesto che ha prodotto il chunk
  if(!bnnSignalSeen){
    let peak=0;
    for(let i=0;i<input.length;i++){const a=Math.abs(input[i]);if(a>peak)peak=a;}
    if(peak>1e-4){
      bnnSignalSeen=true;
    } else {
      bnnSilenceSecs+=input.length/srcRate;
      if(bnnSilenceSecs>=BNN_CFG.silenceWatchdogS){
        bnnSilenceSecs=0; // evita re-trigger a ogni chunk mentre il rebuild lavora
        bnnHandleSilentMic();
      }
    }
  }
  
  let chunk=input;
  if(Math.abs(srcRate-BNN_CFG.sampleRate)>1){
    chunk=bnnResampleLinear(input,srcRate,BNN_CFG.sampleRate);
  }
  const merged=new Float32Array(bnnRing.length+chunk.length);
  merged.set(bnnRing,0); merged.set(chunk,bnnRing.length);
  // teniamo solo la coda necessaria (2x il minimo, per margine)
  const keep=BNN_CFG.samplesNeeded*2;
  bnnRing = merged.length>keep ? merged.slice(merged.length-keep) : merged;
}

let bnnResampleState=null;

function bnnResampleLinear(buf,fromRate,toRate){
  const ratio=fromRate/toRate;
  let ext,pos;
  if(bnnResampleState){
    ext=new Float32Array(buf.length+1);
    ext[0]=bnnResampleState.last;
    ext.set(buf,1);
    pos=bnnResampleState.pos;
  } else {
    ext=buf;pos=0;
  }
  const maxIdx=ext.length-1;
  const outLen=Math.max(0,Math.floor((maxIdx-pos)/ratio)+1); // posizioni di lettura <= maxIdx
  const out=new Float32Array(outLen);
  for(let i=0;i<outLen;i++){
    const srcPos=pos+i*ratio, i0=Math.floor(srcPos), frac=srcPos-i0;
    const s0=ext[i0];
    const s1=(i0+1<=maxIdx)?ext[i0+1]:s0;
    out[i]=s0+(s1-s0)*frac;
  }
  bnnResampleState={pos:pos+outLen*ratio-maxIdx, last:ext[maxIdx]};
  return out;
}

 
// BNN — PREPROCESSING (STFT + mel filterbank), identico al training
const bnnHann = (()=>{
  const N=BNN_CFG.frameLength, w=new Float32Array(N);
  for(let i=0;i<N;i++) w[i]=0.5-0.5*Math.cos(2*Math.PI*i/N);
  return w;
})();

// FFT radix-2 iterativa (richiede n potenza di 2). Ritorna {re,im} in-place.
function bnnFFT(re,im){
  const n=re.length;
  for(let i=1,j=0;i<n;i++){
    let bit=n>>1;
    for(;j&bit;bit>>=1) j^=bit;
    j^=bit;
    if(i<j){ [re[i],re[j]]=[re[j],re[i]]; [im[i],im[j]]=[im[j],im[i]]; }
  }
  for(let len=2;len<=n;len<<=1){
    const ang=-2*Math.PI/len;
    const wr=Math.cos(ang), wi=Math.sin(ang);
    for(let i=0;i<n;i+=len){
      let cwr=1,cwi=0;
      for(let k=0;k<len/2;k++){
        const ur=re[i+k], ui=im[i+k];
        const vr=re[i+k+len/2]*cwr-im[i+k+len/2]*cwi;
        const vi=re[i+k+len/2]*cwi+im[i+k+len/2]*cwr;
        re[i+k]=ur+vr; im[i+k]=ui+vi;
        re[i+k+len/2]=ur-vr; im[i+k+len/2]=ui-vi;
        const ncwr=cwr*wr-cwi*wi, ncwi=cwr*wi+cwi*wr;
        cwr=ncwr; cwi=ncwi;
      }
    }
  }
}

// Matrice mel filterbank (nMels x (nFFT/2+1)), precalcolata una sola volta.
const bnnMelFB = (()=>{
  const {nFFT,nMels,fMin,fMax,sampleRate}=BNN_CFG;
  const nBins=nFFT/2+1;
  const hzToMel=hz=>1127.0*Math.log(1+hz/700);
  const nyquist=sampleRate/2;
  const melMin=hzToMel(fMin), melMax=hzToMel(fMax);
  // nMels+2 edge equispaziati in mel; il filtro m usa la tripla (m, m+1, m+2)
  const edges=[];
  for(let i=0;i<nMels+2;i++) edges.push(melMin+(melMax-melMin)*i/(nMels+1));
  const fb=Array.from({length:nMels},()=>new Float32Array(nBins));
  for(let m=0;m<nMels;m++){
    const lower=edges[m], center=edges[m+1], upper=edges[m+2];
    for(let k=1;k<nBins;k++){
      const mel=hzToMel(k*nyquist/(nBins-1));
      const lowSlope=(mel-lower)/(center-lower);
      const upSlope=(upper-mel)/(upper-center);
      fb[m][k]=Math.max(0,Math.min(lowSlope,upSlope));
    }
  }
  return fb;
})();

function bnnComputeLogMel(samples){
  const {frameLength,frameStep,nFFT,nFrames,nMels}=BNN_CFG;
  const out=Array.from({length:nFrames},()=>new Float32Array(nMels));
  for(let f=0;f<nFrames;f++){
    const start=f*frameStep;
    const re=new Float32Array(nFFT), im=new Float32Array(nFFT);
    for(let i=0;i<frameLength;i++) re[i]=(samples[start+i]||0)*bnnHann[i];
    bnnFFT(re,im);
    const nBins=nFFT/2+1;
    const mag=new Float32Array(nBins);
    for(let k=0;k<nBins;k++) mag[k]=Math.sqrt(re[k]*re[k]+im[k]*im[k]); 
    for(let m=0;m<nMels;m++){
      let e=0; const filt=bnnMelFB[m];
      for(let k=0;k<nBins;k++) e+=mag[k]*filt[k];
      out[f][m]=Math.log(e+1e-6);
    }
  }
  return out;
}

 
// BNN — MODELLO E INFERENZA
let bnnModel=null;
let bnnLoopTimer=null;

 
// BNN — LAYER CUSTOM (replicano BinaryConv2D / BinaryActivation di Keras)
 
function bnnRegisterCustomLayers(){

class BinaryConv2DLayer extends tf.layers.Layer {
  constructor(cfg){
    super(cfg);
    this.filters   = cfg.filters;
    const ks = cfg.kernelSize || cfg.kernel_size;
    this.kernelSize= Array.isArray(ks) ? ks : [ks, ks];
    const st = cfg.strides;
    this.strides   = st ? (Array.isArray(st)?st:[st,st]) : [1,1];
    this.padding   = (cfg.padding || 'valid').toUpperCase(); // tf.conv2d vuole 'SAME'|'VALID'
    const ub = cfg.useBias!==undefined ? cfg.useBias : cfg.use_bias;
    this.useBiasCfg= ub!==undefined ? ub : false; 
  }
  build(inputShape){
    const inCh=inputShape[inputShape.length-1];
    this.kernel=this.addWeight('kernel',
      [this.kernelSize[0],this.kernelSize[1],inCh,this.filters],
      'float32', tf.initializers.glorotUniform({}));
    if(this.useBiasCfg){
      this.bias=this.addWeight('bias',[this.filters],'float32', tf.initializers.zeros());
    }
    super.build(inputShape);
  }
  call(inputs){
    return tf.tidy(()=>{
      const x = Array.isArray(inputs) ? inputs[0] : inputs;
      const w = this.kernel.read();
      let wBin = tf.sign(w);
      wBin = tf.where(tf.equal(wBin,0), tf.onesLike(wBin), wBin); // sign(0) -> 1
      return tf.conv2d(x, wBin, this.strides, this.padding.toLowerCase());
    });
  }
  computeOutputShape(inputShape){
    const shape = Array.isArray(inputShape[0]) ? inputShape[0] : inputShape;
    const [batch,h,w] = shape;
    const [kh,kw] = this.kernelSize;
    const [sh,sw] = this.strides;
    let outH,outW;
    if(this.padding==='SAME'){
      outH=Math.ceil(h/sh); outW=Math.ceil(w/sw);
    } else { 
      outH=Math.ceil((h-kh+1)/sh); outW=Math.ceil((w-kw+1)/sw);
    }
    return [batch,outH,outW,this.filters];
  }
  static get className(){ return 'bnn>BinaryConv2D'; } 
}
tf.serialization.registerClass(BinaryConv2DLayer);

class BinaryActivationLayer extends tf.layers.Layer {
  constructor(cfg){ super(cfg); }
  call(inputs){
    return tf.tidy(()=>{
      const x=Array.isArray(inputs)?inputs[0]:inputs;
      let y=tf.sign(x);
      y=tf.where(tf.equal(y,0), tf.onesLike(y), y);
      return y;
    });
  }
  static get className(){ return 'BinaryActivation'; }
}
tf.serialization.registerClass(BinaryActivationLayer);

}

 
// BNN
function bnnConvertInboundNodes(inboundNodes){
  return inboundNodes.map(node=>{
    const args = node.args || [];
    const kwargs = node.kwargs || {};
    return args.map(arg=>{
      const hist = arg.config && arg.config.keras_history;
      if(!hist) throw new Error('inbound node senza keras_history: layer multi-input o con argomenti costanti non supportato da bnnConvertInboundNodes');
      return [hist[0], hist[1], hist[2], kwargs];
    });
  });
}

function bnnPatchTopology(modelTopology){
  const cfg = modelTopology.model_config.config;
  const layers = cfg.layers;
  const counts = {renamed:0, format:0};
  for(const layer of layers){
    if(layer.class_name==='Activation'){
      const act=layer.config && layer.config.activation;
      if(act && typeof act==='object'){ 
        layer.class_name='BinaryActivation';
        counts.renamed++;
      }
    }

    if(layer.class_name==='InputLayer' && layer.config){
      if(layer.config.batch_shape && !layer.config.batch_input_shape){
        layer.config.batch_input_shape = layer.config.batch_shape;
        counts.format++;
      }
    }

    if(layer.config && layer.config.dtype && typeof layer.config.dtype==='object'){
      const name = layer.config.dtype.config && layer.config.dtype.config.name;
      layer.config.dtype = name || 'float32';
      counts.format++;
    }
    if(Array.isArray(layer.inbound_nodes) && layer.inbound_nodes.length>0 && layer.inbound_nodes[0] && layer.inbound_nodes[0].args){
      layer.inbound_nodes = bnnConvertInboundNodes(layer.inbound_nodes);
      counts.format++;
    }
  }
  
  if(cfg.input_layers && typeof cfg.input_layers[0]==='string'){
    cfg.input_layers=[cfg.input_layers]; counts.format++;
  }
  if(cfg.output_layers && typeof cfg.output_layers[0]==='string'){
    cfg.output_layers=[cfg.output_layers]; counts.format++;
  }
  return counts;
}

function bnnConcatArrayBuffers(buffers){
  const total=buffers.reduce((s,b)=>s+b.byteLength,0);
  const out=new Uint8Array(total);
  let off=0;
  for(const b of buffers){ out.set(new Uint8Array(b), off); off+=b.byteLength; }
  return out.buffer;
}

async function bnnLoadPatchedModel(modelJsonUrl){
  const baseUrl = modelJsonUrl.substring(0, modelJsonUrl.lastIndexOf('/')+1);
  const resp = await fetch(modelJsonUrl);
  if(!resp.ok) throw new Error('HTTP '+resp.status+' su '+modelJsonUrl);
  const modelJson = await resp.json();

  const patched = bnnPatchTopology(modelJson.modelTopology);
  addLog('sistema','—',`Model.json corretto: ${patched.renamed} layer BinaryActivation rinominati, ${patched.format} conversioni di formato Keras 3`);

  const manifest = modelJson.weightsManifest;
  const weightSpecs = [];
  const buffers = [];
  for(const group of manifest){
    for(const w of group.weights) weightSpecs.push(w);
    for(const path of group.paths){
      const r = await fetch(baseUrl+path);
      if(!r.ok) throw new Error('HTTP '+r.status+' su '+baseUrl+path);
      buffers.push(await r.arrayBuffer());
    }
  }
  const weightData = bnnConcatArrayBuffers(buffers);

  const ioHandler = {
    load: async () => ({
      modelTopology: modelJson.modelTopology,
      weightSpecs,
      weightData,
      format: modelJson.format,
      generatedBy: modelJson.generatedBy,
      convertedBy: modelJson.convertedBy
    })
  };
  return tf.loadLayersModel(ioHandler);
}

async function bnnLoadModel(){
  try{
    addLog('sistema','—','Caricamento modello BNN...');
    bnnModel = await bnnLoadPatchedModel(BNN_CFG.modelUrl);
    addLog('sistema','—','Modello BNN caricato ✓');
    if(micActive){ stopDemo(); startBnnLoop(); }
  }catch(e){
    console.error(e);
    addLog('errore','—','Caricamento modello fallito: '+e.message);
    bnnModel=null;
  }
}

function bnnTestModel(){
  if(!bnnModel){ console.warn('Modello non ancora caricato'); return; }
  tf.tidy(()=>{
    const dummy = tf.randomNormal([1, BNN_CFG.nFrames, BNN_CFG.nMels, 1]);
    const out = bnnModel.predict(dummy);
    const probs = Array.from(out.dataSync());
    const sum = probs.reduce((a,b)=>a+b,0);
    console.log('Output grezzo:', probs.map(p=>p.toFixed(4)));
    console.log('Somma (deve essere ≈1 se softmax):', sum.toFixed(4));
    console.log('Classe più probabile:', WORDS[probs.indexOf(Math.max(...probs))]);
  });
}

function startBnnLoop(){
  stopBnnLoop();
  bnnLoopTimer=setInterval(bnnRunInference, BNN_CFG.inferenceIntervalMs);
}
function stopBnnLoop(){ if(bnnLoopTimer){clearInterval(bnnLoopTimer); bnnLoopTimer=null;} }

let bnnStreakWord=null, bnnStreak=0; // parola vincente corrente e n. di inferenze consecutive
let bnnSuppressUntil=0;              // timestamp fino a cui l'inferenza è sospesa dopo un trigger
let bnnGateLogCounter=0;             // throttling del log di "silenzio"

function bnnRunInference(){
  if(!bnnModel || !micActive) return;
  if(performance.now()<bnnSuppressUntil) return;
  if(bnnRing.length<BNN_CFG.samplesNeeded){
    console.log(`[BNN debug] buffer non pieno: ${bnnRing.length}/${BNN_CFG.samplesNeeded} campioni`);
    return;
  }
  const samples=bnnRing.slice(bnnRing.length-BNN_CFG.samplesNeeded);

  let sumSq=0; for(let i=0;i<samples.length;i++) sumSq+=samples[i]*samples[i];
  const rms=Math.sqrt(sumSq/samples.length);

  if(rms<BNN_CFG.rmsGate){
    bnnStreakWord=null; bnnStreak=0;
    if((bnnGateLogCounter++%8)===0) console.log(`[BNN debug] rms=${rms.toFixed(4)} sotto gate ${BNN_CFG.rmsGate}: silenzio, inferenza saltata`);
    return;
  }

  const logMel=bnnComputeLogMel(samples); // [51][32] (array di Float32Array)

  const flat=new Float32Array(BNN_CFG.nFrames*BNN_CFG.nMels);
  for(let f=0;f<BNN_CFG.nFrames;f++) flat.set(logMel[f], f*BNN_CFG.nMels);

  tf.tidy(()=>{
    const inputTensor=tf.tensor(flat,[1,BNN_CFG.nFrames,BNN_CFG.nMels,1]);
    const pred=bnnModel.predict(inputTensor);
    const probs=pred.dataSync();
    let bestI=0,bestP=0;
    for(let i=0;i<probs.length;i++) if(probs[i]>bestP){bestP=probs[i];bestI=i;}

    console.log(`[BNN debug] rms=${rms.toFixed(4)}  top="${WORDS[bestI]}" conf=${bestP.toFixed(3)}  streak=${WORDS[bestI]===bnnStreakWord?bnnStreak+1:1}/${BNN_CFG.confirmRuns}  (soglia=${BNN_CFG.confThreshold})`);

    if(WORDS[bestI]==='_silence_'||WORDS[bestI]==='_unknown_'){
      bnnStreakWord=null; bnnStreak=0;
      return;
    }

    if(bestP>=BNN_CFG.confThreshold){
      if(WORDS[bestI]===bnnStreakWord) bnnStreak++;
      else { bnnStreakWord=WORDS[bestI]; bnnStreak=1; }
      if(bnnStreak>=BNN_CFG.confirmRuns){
        bnnStreakWord=null; bnnStreak=0;
        bnnSuppressUntil=performance.now()+BNN_CFG.refractoryMs; 
        handleCommand(WORDS[bestI],bestP);
      }
    } else {
      bnnStreakWord=null; bnnStreak=0;
    }
  });
}

 
const DEMO=['yes','on','yes','up','no','yes','down','yes','off'];
let demoIdx=0,demoTimer=null;
function startDemo(){stopDemo();demoTimer=setInterval(()=>{if(micActive)handleCommand(DEMO[demoIdx++%DEMO.length],null);},3500);}
function stopDemo(){if(demoTimer){clearInterval(demoTimer);demoTimer=null;}}

if(typeof tf!=='undefined'){
  bnnRegisterCustomLayers();
  bnnLoadModel();
} else {
  addLog('errore','—','TF.js non caricato (CDN non raggiungibile): comandi vocali non disponibili, resta la DEMO simulata');
}

 
// TASTIERA — WASD/frecce per il movimento
document.addEventListener('keydown',e=>{
  keysDown[e.key]=true;
  if(e.key==='y'){e.preventDefault();handleCommand('yes',null);}
  else if(e.key==='n'){e.preventDefault();handleCommand('no',null);}
  else if(e.key==='o'){e.preventDefault();handleCommand('on',null);}
  else if(e.key==='f'){e.preventDefault();handleCommand('off',null);}
  else if(e.key==='u'){e.preventDefault();handleCommand('up',null);}
});
document.addEventListener('keyup',e=>{delete keysDown[e.key];});

 
// PANNELLO MOBILE (bottom-sheet) — apre/chiude il monitor KWS su schermi stretti.
// Su desktop la media query non è attiva, quindi la classe 'expanded' non ha effetto visivo.
function togglePanel(){
  document.getElementById('panel').classList.toggle('expanded');
}

// INIZIALIZZAZIONE 
window.addEventListener('resize',resize);
resize();                       // calcola subito lo zoom giusto e disegna il primo frame
requestAnimationFrame(gameLoop); // avvia il ciclo di gioco (movimento + ridisegno continuo)
animWF();                        // avvia il ciclo separato della waveform
addLog('sistema','—','App pronta — WASD/frecce per muoverti, y=yes n=no o=on f=off u=up');

// ---- PWA: registrazione service worker per funzionamento offline ----
// (sw.js ora presente nella cartella: attivo la registrazione)
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').catch(err=>console.warn('SW non registrato:',err));
  });
}