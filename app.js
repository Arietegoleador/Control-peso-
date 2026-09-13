const DB_NAME="mi-progreso-pwa",DB_VERSION=2;let db;
const suggestions=["Beber 2 L de agua","Caminar 30 minutos","Dormir 7 horas","Comer fruta y verduras","Hacer ejercicio","Cumplir el plan de alimentación"];
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function today(){return new Date().toISOString().slice(0,10)}
function fmtDate(s){const [y,m,d]=s.split("-");return `${d}/${m}/${y}`}
function kg(n){return Number(n).toFixed(1).replace(".",",")}
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains("weights")){const w=d.createObjectStore("weights",{keyPath:"id",autoIncrement:true});w.createIndex("date","date")};if(!d.objectStoreNames.contains("goals"))d.createObjectStore("goals",{keyPath:"id",autoIncrement:true});if(!d.objectStoreNames.contains("checks")){const c=d.createObjectStore("checks",{keyPath:"key"});c.createIndex("date","date")};if(!d.objectStoreNames.contains("settings"))d.createObjectStore("settings",{keyPath:"key"})};r.onsuccess=()=>{db=r.result;res()};r.onerror=()=>rej(r.error)})}
function tx(store,mode="readonly"){return db.transaction(store,mode).objectStore(store)}
function all(store){return new Promise((res,rej)=>{const r=tx(store).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function put(store,obj){return new Promise((res,rej)=>{const r=tx(store,"readwrite").put(obj);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function del(store,key){return new Promise((res,rej)=>{const r=tx(store,"readwrite").delete(key);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
async function setting(key,def){const r=await new Promise((res,rej)=>{const q=tx("settings").get(key);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});return r?r.value:def}
async function saveSetting(key,value){return put("settings",{key,value})}

function calc(weights,target){
 weights.sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
 const first=weights[0],last=weights.at(-1); if(!last)return {first:null,last:null,pct:0,remaining:null,delta:null};
 const start=first.weight,current=last.weight,den=start-target,pct=den>0?Math.max(0,Math.min(100,(start-current)/den*100)):0;
 return {first,last,pct,remaining:current-target,delta:current-start};
}
function trendPoints(weights){if(weights.length<2)return [];return weights.map((w,i)=>{const from=Math.max(0,i-2),a=weights.slice(from,i+1);return {x:w.date,y:a.reduce((s,v)=>s+v.weight,0)/a.length}})}
function drawChart(weights,target){
 const svg=$("#chart");svg.innerHTML="";
 if(!weights.length){svg.innerHTML='<text x="310" y="95" text-anchor="middle">Añade tu primer pesaje para ver la gráfica</text>';return}
 const pad={l:42,r:42,t:18,b:25},W=620,H=190;
 const wvals=weights.map(w=>w.weight).concat([target]),wmin=Math.min(...wvals),wmax=Math.max(...wvals),wrange=Math.max(1,wmax-wmin);
 const fats=weights.map(w=>w.fat).filter(v=>v!=null),hasFat=fats.length>0;
 const fmin=hasFat?Math.floor(Math.min(...fats)-2):0,fmax=hasFat?Math.ceil(Math.max(...fats)+2):100,frange=Math.max(5,fmax-fmin);
 const x=i=>weights.length===1?W/2:pad.l+i*(W-pad.l-pad.r)/(weights.length-1);
 const yw=v=>pad.t+(wmax-v)*(H-pad.t-pad.b)/wrange;
 const yf=v=>pad.t+(fmax-v)*(H-pad.t-pad.b)/frange;
 const line=(x1,y1,x2,y2,stroke,dash)=>{const l=document.createElementNS("http://www.w3.org/2000/svg","line");l.setAttribute("x1",x1);l.setAttribute("y1",y1);l.setAttribute("x2",x2);l.setAttribute("y2",y2);l.setAttribute("stroke",stroke);if(dash)l.setAttribute("stroke-dasharray",dash);svg.appendChild(l)};
 [wmax,(wmax+wmin)/2,wmin].forEach(v=>{const yy=yw(v);line(pad.l,yy,W-pad.r,yy,"#e5e8ef");const t=document.createElementNS("http://www.w3.org/2000/svg","text");t.setAttribute("x",3);t.setAttribute("y",yy+4);t.textContent=kg(v);svg.appendChild(t)});
 if(hasFat){[fmax,(fmax+fmin)/2,fmin].forEach(v=>{const t=document.createElementNS("http://www.w3.org/2000/svg","text");t.setAttribute("x",W-38);t.setAttribute("y",yf(v)+4);t.textContent=v.toFixed(0)+"%";t.setAttribute("fill","#e07a5f");svg.appendChild(t)})}
 const poly=(pts,stroke,width,dash)=>{const p=document.createElementNS("http://www.w3.org/2000/svg","polyline");p.setAttribute("points",pts);p.setAttribute("fill","none");p.setAttribute("stroke",stroke);p.setAttribute("stroke-width",width);p.setAttribute("stroke-linecap","round");p.setAttribute("stroke-linejoin","round");if(dash)p.setAttribute("stroke-dasharray",dash);svg.appendChild(p)};
 poly(weights.map((w,i)=>`${x(i)},${yw(w.weight)}`).join(" "),"#5d6fdf","3");
 const tp=trendPoints(weights);if(tp.length>1)poly(tp.map((v,i)=>`${x(i)},${yw(v.y)}`).join(" "),"#8b95a7","2","7 6");
 if(hasFat){
   const fp=weights.filter(w=>w.fat!=null).map(w=>`${x(weights.indexOf(w))},${yf(w.fat)}`).join(" ");
   if(fp)poly(fp,"#e07a5f","3");
 }
 weights.forEach((w,i)=>{let c=document.createElementNS("http://www.w3.org/2000/svg","circle");c.setAttribute("cx",x(i));c.setAttribute("cy",yw(w.weight));c.setAttribute("r",i===weights.length-1?5:3.5);c.setAttribute("fill","#5d6fdf");svg.appendChild(c);
   if(w.fat!=null){let f=document.createElementNS("http://www.w3.org/2000/svg","circle");f.setAttribute("cx",x(i));f.setAttribute("cy",yf(w.fat));f.setAttribute("r",i===weights.length-1?4.5:3);f.setAttribute("fill","#e07a5f");svg.appendChild(f)}
 });
}
async function render(){
 const weights=await all("weights"),goals=await all("goals"),checks=await all("checks"),target=await setting("target",75);
 weights.sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);const c=calc(weights,target);
 $("#target").textContent=kg(target)+" kg";$("#targetInput").value=target;$("#count").textContent=`${weights.length} registro${weights.length===1?"":"s"}`;
 $("#current").textContent=c.last?kg(c.last.weight):"—";$("#initial").textContent=c.first?kg(c.first.weight):"—";$("#remaining").textContent=c.last?kg(c.remaining):"—";$("#percent").textContent=Math.round(c.pct)+"%";$("#fatCurrent").textContent=c.last&&c.last.fat!=null?`Grasa: ${Number(c.last.fat).toFixed(1).replace(".",",")}%`:""; $("#delta").textContent=c.delta===null?"Sin registros":(c.delta<0?`−${kg(Math.abs(c.delta))} kg desde el inicio`:c.delta>0?`+${kg(c.delta)} kg desde el inicio`:"Sin cambio");
 $("#ring").style.strokeDashoffset=314-(314*c.pct/100);drawChart(weights,target);
 const todayChecks=checks.filter(x=>x.date===today()),done=goals.filter(g=>todayChecks.some(c=>c.goalId===g.id&&c.done)).length;$("#done").textContent=done;$("#total").textContent=goals.length;$("#goalBar").style.width=(goals.length?done/goals.length*100:0)+"%";
 const streak=await getStreak(goals,checks);$("#streak").textContent=streak;
 $("#goals").innerHTML=goals.length?goals.map(g=>{const on=todayChecks.some(c=>c.goalId===g.id&&c.done);return `<button class="goal ${on?"done":""}" data-goal="${g.id}"><span class="check">${on?"✓":""}</span><span class="label">${esc(g.name)}</span></button>`}).join(""):'<div class="empty">Añade tus primeros objetivos desde Ajustes.</div>';
 $$("#goals .goal").forEach(b=>b.addEventListener("click",async()=>{const id=Number(b.dataset.goal),existing=checks.find(c=>c.date===today()&&c.goalId===id);if(existing)await del("checks",existing.key);else await put("checks",{key:`${today()}-${id}`,date:today(),goalId:id,done:true});await render() }));
 const sorted=[...weights].sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);$("#historyList").innerHTML=sorted.length?sorted.map(w=>`<div class="item row"><div><b>${kg(w.weight)} kg</b>${w.fat!=null?` <span style="color:#e07a5f;font-weight:700">${Number(w.fat).toFixed(1).replace(".",",")}%</span>`:""}<div class="small muted">${fmtDate(w.date)}</div></div><div><button class="ghost edit-weight" data-id="${w.id}">Editar</button> <button class="danger delete-weight" data-id="${w.id}">×</button></div></div>`).join(""):'<div class="empty">Todavía no hay pesajes.</div>';
 $$(".edit-weight").forEach(b=>b.addEventListener("click",()=>editWeight(Number(b.dataset.id),weights)));$$(".delete-weight").forEach(b=>b.addEventListener("click",async()=>{if(confirm("¿Eliminar este registro?")){await del("weights",Number(b.dataset.id));await render()}}));
 const last7=weights.filter(w=>(Date.parse(today())-Date.parse(w.date))/86400000<=7);$("#avg7").textContent=last7.length?kg(last7.reduce((s,w)=>s+w.weight,0)/last7.length):"—";$("#weekly").textContent=weights.length>1?((weights.at(-1).weight-weights[0].weight)/Math.max(1,(Date.parse(weights.at(-1).date)-Date.parse(weights[0].date))/604800000)).toFixed(1).replace(".",",")+" kg":"—";$("#days").textContent=new Set(weights.map(w=>w.date)).size;
 renderSettings(goals);renderBadges(weights,streak,goals,checks);
}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
async function getStreak(goals,checks){if(!goals.length)return 0;let n=0,d=new Date();while(true){const ds=d.toISOString().slice(0,10);const ok=goals.every(g=>checks.some(c=>c.date===ds&&c.goalId===g.id&&c.done));if(!ok)break;n++;d.setUTCDate(d.getUTCDate()-1);if(n>366)break}return n}
function openWeight(w){$("#weightInput").value=w?String(w.weight).replace(".",","):"";$("#fatInput").value=w&&w.fat!=null?String(w.fat).replace(".",","):"";$("#dateInput").value=w?w.date:today();$("#weightDialog").dataset.id=w?w.id:"";$("#weightDialog").showModal();$("#weightInput").focus()}
async function editWeight(id,weights){openWeight(weights.find(w=>w.id===id))}
async function renderSettings(goals){$("#goalSettings").innerHTML=goals.length?goals.map(g=>`<div class="item row"><span>${esc(g.name)}</span><span><button class="ghost edit-goal" data-id="${g.id}">Editar</button> <button class="danger delete-goal" data-id="${g.id}">×</button></span></div>`).join(""):'<div class="empty">No hay objetivos activos.</div>'; $$(".edit-goal").forEach(b=>b.addEventListener("click",()=>openGoal(goals.find(g=>g.id===Number(b.dataset.id)))));$$(".delete-goal").forEach(b=>b.addEventListener("click",async()=>{if(confirm("¿Eliminar este objetivo?")){await del("goals",Number(b.dataset.id));await render()}}));const existing=goals.map(g=>g.name);$("#suggestions").innerHTML=suggestions.filter(s=>!existing.includes(s)).map(s=>`<button class="goal suggestion" data-name="${esc(s)}"><span class="check">＋</span><span>${esc(s)}</span></button>`).join("");$$(".suggestion").forEach(b=>b.addEventListener("click",async()=>{await put("goals",{name:b.dataset.name});await render()}))}
function openGoal(g){$("#goalInput").value=g?g.name:"";$("#goalDialog").dataset.id=g?g.id:"";$("#goalDialog").showModal();$("#goalInput").focus()}
function renderBadges(weights,streak){const bs=[["🌱","Primer paso",weights.length>=1],["📈","10 registros",weights.length>=10],["🔥","7 días",streak>=7],["🔥","14 días",streak>=14],["🏆","30 días",streak>=30]];$("#badges").innerHTML=bs.map(b=>`<div class="badge ${b[2]?"":"locked"}"><div style="font-size:1.5rem">${b[0]}</div><b>${b[1]}</b><div class="small muted">${b[2]?"Conseguida":"Bloqueada"}</div></div>`).join("");if(streak>=30){$("#badgeIcon").textContent="🏆";$("#badgeTitle").textContent="Imparable";$("#badgeSub").textContent="30 días seguidos"}else if(streak>=14){$("#badgeIcon").textContent="🔥";$("#badgeTitle").textContent="Constante";$("#badgeSub").textContent="14 días seguidos"}else if(streak>=7){$("#badgeIcon").textContent="🔥";$("#badgeTitle").textContent="Disciplina";$("#badgeSub").textContent="7 días seguidos"}else if(weights.length){$("#badgeIcon").textContent="🌱";$("#badgeTitle").textContent="Primer paso";$("#badgeSub").textContent="Ya has empezado"}}
function bind(){
 $$(".nav button").forEach(b=>b.addEventListener("click",()=>{$$(".nav button").forEach(x=>x.classList.remove("active"));b.classList.add("active");$$(".view").forEach(v=>v.classList.remove("active"));$("#"+b.dataset.view).classList.add("active")}));
 $("#addWeight").onclick=$("#addWeight2").onclick=()=>openWeight();$("#cancelWeight").onclick=()=>$("#weightDialog").close();$("#cancelGoal").onclick=()=>$("#goalDialog").close();
 $("#weightForm").addEventListener("submit",async e=>{e.preventDefault();const w=Number(String($("#weightInput").value).trim().replace(",", ".")),fatRaw=$("#fatInput").value.trim(),fat=fatRaw===""?null:Number(fatRaw.replace(",", ".").trim()),date=$("#dateInput").value,id=Number($("#weightDialog").dataset.id||0);if(!Number.isFinite(w)||w<20||w>300||!date)return;if(fat!==null&&(!Number.isFinite(fat)||fat<2||fat>70))return;await put("weights",id?{id,weight:w,date,fat}:{weight:w,date,fat});$("#weightDialog").close();await render()});
 $("#saveTarget").onclick=async()=>{const v=Number($("#targetInput").value);if(Number.isFinite(v)&&v>=20&&v<=300){await saveSetting("target",v);await render()}};
 $("#newGoal").onclick=()=>openGoal();$("#goalForm").addEventListener("submit",async e=>{e.preventDefault();const name=$("#goalInput").value.trim(),id=Number($("#goalDialog").dataset.id||0);if(!name)return;await put("goals",id?{id,name}:{name});$("#goalDialog").close();await render()});
 $("#clearData").onclick=async()=>{if(!confirm("Esto borrará todos los pesajes, objetivos y progreso. ¿Continuar?"))return;for(const s of ["weights","goals","checks","settings"]){await new Promise((res,rej)=>{const r=tx(s,"readwrite").clear();r.onsuccess=res;r.onerror=()=>rej(r.error)})}await saveSetting("target",75);await render()};
}
(async()=>{await openDB();bind();await render();if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});})();