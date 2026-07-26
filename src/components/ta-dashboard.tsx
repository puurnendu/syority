import { useState, useRef, useEffect, createContext, useContext } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

/* ─── ROLE SYSTEM ───────────────────────────────────────────────── */
const ROLES = {
  Admin:          { color:"#ef4444", badge:"AD", nav:["dashboard","lookahead","constraints","punch","cards","reports","deliveries","admin"], canAI:true,  canBuild:true,  canData:true,  canAdmin:true  },
  "Project Manager":{ color:"#f59e0b", badge:"PM", nav:["dashboard","lookahead","constraints","punch","cards","reports","deliveries"],          canAI:true,  canBuild:true,  canData:false, canAdmin:false },
  Planner:        { color:"#3b82f6", badge:"PL", nav:["dashboard","lookahead","constraints","punch","cards","reports","deliveries"],             canAI:true,  canBuild:true,  canData:true,  canAdmin:false },
  Superintendent: { color:"#10b981", badge:"SI", nav:["dashboard","lookahead","constraints","punch","cards","deliveries"],                       canAI:false, canBuild:false, canData:false, canAdmin:false },
  Client:         { color:"#8b949e", badge:"CL", nav:["dashboard","punch","deliveries"],                                                         canAI:false, canBuild:false, canData:false, canAdmin:false },
};
const DEMO_USERS = [
  {name:"Hassan Al-Mutairi",  role:"Admin",           email:"h.almutairi@relta.io",  pass:"admin123"},
  {name:"Sarah Mitchell",     role:"Project Manager", email:"s.mitchell@relta.io",   pass:"pm123"},
  {name:"Omar Khalid",        role:"Planner",         email:"o.khalid@relta.io",     pass:"plan123"},
  {name:"Dave Robertson",     role:"Superintendent",  email:"d.robertson@relta.io",  pass:"super123"},
  {name:"Client Rep (ADNOC)", role:"Client",          email:"rep@adnoc.ae",          pass:"client123"},
];

const RoleCtx = createContext(null);
const useRole = () => useContext(RoleCtx);

/* ─── STATIC DATA ───────────────────────────────────────────────── */
const PROJECT = { name:"CDU-3 Turnaround 2026", plannedMC:"05-Apr-2026", forecastMC:"09-Apr-2026", overallPlanned:68.2, overallActual:62.4, spi:0.915, cpi:0.943, manhoursBudget:285000, manhoursActual:168420 };
const S_CURVE = [{w:"W1",p:3,a:3.2},{w:"W2",p:8,a:7.8},{w:"W3",p:15,a:14.1},{w:"W4",p:24,a:22.3},{w:"W5",p:35,a:32.8},{w:"W6",p:47,a:43.5},{w:"W7",p:58,a:53.1},{w:"W8★",p:68.2,a:62.4,f:62.4},{w:"W9",p:78,f:72},{w:"W10",p:87,f:81},{w:"W11",p:94,f:90},{w:"W12",p:98,f:96},{w:"W13",p:100,f:100}];
const UNITS = [{u:"CDU",p:72,a:65},{u:"HDS",p:68,a:70},{u:"FCC",p:65,a:58},{u:"ARU",p:75,a:74},{u:"SRU",p:60,a:62},{u:"UTL",p:80,a:76}];
const MILESTONES = [{name:"Mechanical Isolation",planned:"20-Feb",actual:"20-Feb",status:"complete",unit:"ALL"},{name:"CDU C-101 Open & Inspect",planned:"25-Feb",actual:"26-Feb",status:"complete",unit:"CDU"},{name:"FCC Reactor Decat",planned:"01-Mar",actual:"03-Mar",status:"complete",unit:"FCC"},{name:"HDS Catalyst Dump & Load",planned:"08-Mar",actual:null,status:"in-progress",unit:"HDS"},{name:"CDU HX Bundle Pulls",planned:"12-Mar",actual:null,status:"at-risk",unit:"CDU"},{name:"FCC Fractionator Trays",planned:"18-Mar",actual:null,status:"on-track",unit:"FCC"},{name:"All PSV Returns",planned:"22-Mar",actual:null,status:"on-track",unit:"ALL"},{name:"Mechanical Completion",planned:"05-Apr",actual:null,status:"at-risk",unit:"ALL"},{name:"Ready for Startup",planned:"10-Apr",actual:null,status:"on-track",unit:"ALL"}];
const SAFETY = { lti:0, nearMiss:2, firstAid:3, ptw_issued:312, ptw_closed:298, toolboxTalks:23, manhrsLTI:168420 };
const PUNCH = { total:284, open:187, closed:97, catA:{open:23,closed:8}, catB:{open:89,closed:54}, catC:{open:75,closed:35}, byDisc:[{d:"Mechanical",open:78,closed:42},{d:"Piping",open:45,closed:28},{d:"Instrument",open:31,closed:15},{d:"Electrical",open:22,closed:8},{d:"Civil",open:11,closed:4}] };
const CONSTRAINTS = [{id:"C-001",desc:"E-302 Bundle Pull — crane insufficient",owner:"Site Mgr",due:"Mar 11",impact:"High",status:"Open",age:5},{id:"C-002",desc:"P-105A Seal — OEM parts delayed",owner:"Procurement",due:"Mar 10",impact:"High",status:"Open",age:7},{id:"C-003",desc:"FCC Slide Valve drawing revision",owner:"Engineering",due:"Mar 12",impact:"Medium",status:"Open",age:3},{id:"C-004",desc:"HDS Reactor gaskets — wrong spec",owner:"Procurement",due:"Mar 11",impact:"High",status:"Open",age:2},{id:"C-005",desc:"Scaffold access to ARU absorber",owner:"Scaffold Co.",due:"Mar 10",impact:"Medium",status:"Open",age:4}];
const LOOKAHEAD = [{id:"A-1042",desc:"CDU E-301 Bundle Pull & Inspection",unit:"CDU",disc:"Mechanical",contractor:"SAPESCO",start:"11-Mar 07:00",dur:"16hr",crew:12,priority:"Critical"},{id:"A-1078",desc:"HDS R-201 Catalyst Loading — Final 30%",unit:"HDS",disc:"Mechanical",contractor:"CatalystCo",start:"11-Mar 06:00",dur:"8hr",crew:8,priority:"Critical"},{id:"A-1095",desc:"FCC Fractionator Trays 12–18 Install",unit:"FCC",disc:"Mechanical",contractor:"ISCO",start:"11-Mar 08:00",dur:"24hr",crew:22,priority:"High"},{id:"A-1103",desc:"ARU Absorber Internal Inspection",unit:"ARU",disc:"Inspection",contractor:"SGS",start:"11-Mar 07:00",dur:"6hr",crew:4,priority:"Medium"},{id:"A-1115",desc:"P-205A/B Pump Overhaul Completion",unit:"HDS",disc:"Rotating",contractor:"FlowTech",start:"11-Mar 09:00",dur:"12hr",crew:6,priority:"High"},{id:"A-1134",desc:"CDU Atm Column Tray Repl. T22–T28",unit:"CDU",disc:"Mechanical",contractor:"ISCO",start:"11-Mar 10:00",dur:"18hr",crew:18,priority:"High"}];
const SHIFT = { date:"10-Mar-2026", supervisor:"Ahmed Al-Rashidi", crew:342, planned:48, completed:31, inProgress:12, deferred:5, manhours:2736, highlights:["CDU C-101 internals inspection completed ✓","HDS R-201 catalyst dumping 80% complete","FCC Fractionator tray replacement started"], deferrals:["E-302 bundle pull — crane unavailable","P-105A seal — parts awaiting"] };
const EQUIP_CFG = {"Heat Exchangers":{pfx:"E",n:14,acts:["Isolation","Blinding","Opening","Bundle Pull","Tube Inspect","Clean/Repair","Bundle Return","Reassembly","Deblinding","Press Test"]},"Vessels":{pfx:"V",n:10,acts:["Isolation","Blinding","Opening","Internal Inspect","Cleaning","Repair","Nozzle Check","Reassembly","Deblinding","Press Test"]},"Columns":{pfx:"T",n:8,acts:["Isolation","Blinding","Opening","Tray Removal","Inspect","Tray Replace","Reassembly","Deblinding","Press Test"]},"Pumps":{pfx:"P",n:12,acts:["Isolation","Draining","Dismantling","Inspection","Seal Replace","Reassembly","Alignment","Commissioning"]},"Compressors":{pfx:"K",n:6,acts:["Isolation","Degassing","Disassembly","Bearing Inspect","Seal Replace","Reassembly","Alignment","Trial Run"]},"Rotating Equipment":{pfx:"RE",n:8,acts:["Isolation","Disassembly","Inspection","Parts Replace","Reassembly","Alignment","Vibration Test"]},"Piping / Spools":{pfx:"PL",n:18,acts:["Isolation","Blinding","Spool Removal","Inspection/NDT","Repair","Spool Return","Welding","Deblinding","Press Test"]},"Instruments":{pfx:"FI",n:16,acts:["Isolation","Removal","Calibration","Repair","Installation","Loop Test","Commissioning"]},"Electrical Equipment":{pfx:"EL",n:10,acts:["De-energize","Removal","Inspection","Repair","Installation","Testing","Energize"]},"Fired Equipment":{pfx:"H",n:4,acts:["Isolation","Purging","Opening","Tube Inspect","Refractory Inspect","Repair","Closure","Relight & Test"]}};
const UNIT_LIST=["CDU","HDS","FCC","ARU","SRU","UTL"],AREA_LIST=["Area-1","Area-2","Area-3","Area-4"],CONTR_LIST=["SAPESCO","ISCO","FlowTech","TechServ","RotoCare"],PRIO_LIST=["Critical","High","High","Medium","Medium","Low"],SYS_LIST=["SYS-01","SYS-02","SYS-03","SYS-04","SYS-05"];
function genActs(idx,total,acts){const prog=1-idx/total;return Object.fromEntries(acts.map((act,i)=>{const t=i/acts.length,d=prog-t;let s,p;if(d>0.35){s="complete";p=100;}else if(d>0.05){s="in-progress";p=Math.round(15+d*200);}else if(d>-0.1&&idx%4===0){s="overdue";p=Math.round(5+idx*3);}else{s="not-started";p=0;}return [act,{s,p}];}));}
function buildEquip(){return Object.fromEntries(Object.entries(EQUIP_CFG).map(([type,cfg])=>{const tags=Array.from({length:cfg.n},(_,i)=>({id:`${cfg.pfx}-${String(101+i).padStart(3,"0")}`,unit:UNIT_LIST[i%6],area:AREA_LIST[i%4],sys:SYS_LIST[i%5],contr:CONTR_LIST[i%5],prio:PRIO_LIST[i%6],acts:genActs(i,cfg.n,cfg.acts)}));return [type,{acts:[...cfg.acts],tags}];}));}
const EQUIP_BASE=buildEquip();

/* ─── REPORT CARDS ──────────────────────────────────────────────── */
const RCARD_DEFS=[{id:"ai_cover",label:"AI Cover Page",cat:"AI & Smart",icon:"🤖",desc:"AI-generated executive narrative"},{id:"ai_jobs",label:"AI Critical Jobs",cat:"AI & Smart",icon:"✨",desc:"Next 24hr critical job recommendations"},{id:"shift",label:"Shift Summary",cat:"Operations",icon:"🕐",desc:"Crew, activities, manhours"},{id:"lookahead",label:"24hr Look-Ahead",cat:"Operations",icon:"🔭",desc:"Upcoming activities"},{id:"constraints",label:"Constraint Log",cat:"Operations",icon:"🚧",desc:"Open constraints"},{id:"scurve",label:"S-Curve",cat:"Progress",icon:"📈",desc:"Planned vs Actual vs Forecast"},{id:"unitprog",label:"Unit-wise Progress",cat:"Progress",icon:"🏭",desc:"Progress by unit"},{id:"milestone",label:"Milestone Tracker",cat:"Progress",icon:"🎯",desc:"RAG status"},{id:"safety",label:"Safety KPIs",cat:"HSE",icon:"🦺",desc:"LTI, near miss, PTW"},{id:"punch",label:"Punch List Summary",cat:"Quality",icon:"📋",desc:"Cat A/B/C items"},...Object.keys(EQUIP_CFG).map(t=>({id:`eq_${t}`,label:`${t} Table`,cat:"Equipment Tables",icon:"⚙️",desc:`Tag-wise activity status`}))];
const RCARD_CATS=[...new Set(RCARD_DEFS.map(c=>c.cat))];

/* ─── DELIVERY DATA ─────────────────────────────────────────────── */
const INIT_SCHEDULES = [
  {id:1,name:"Morning Briefing",template:"Morning Briefing",recipients:["s.mitchell@relta.io","d.robertson@relta.io"],channels:["Email","WhatsApp","In-App"],freq:"Daily",time:"05:30",active:true,owner:"Admin"},
  {id:2,name:"Client Weekly Report",template:"Management Summary",recipients:["rep@adnoc.ae"],channels:["Email"],freq:"Weekly",time:"08:00",active:true,owner:"Project Manager"},
  {id:3,name:"Shift Handover",template:"Morning Briefing",recipients:["d.robertson@relta.io","o.khalid@relta.io"],channels:["WhatsApp","In-App"],freq:"Shift Change",time:"06:00",active:false,owner:"Planner"},
];
const INIT_DELIVERY_LOG = [
  {id:1,schedule:"Morning Briefing",sent:"10-Mar 05:30",channels:["📧","📱","🔔"],recipients:3,status:"Delivered",pages:3,cards:9},
  {id:2,schedule:"Morning Briefing",sent:"09-Mar 05:30",channels:["📧","📱","🔔"],recipients:3,status:"Delivered",pages:3,cards:9},
  {id:3,schedule:"Client Weekly Report",sent:"07-Mar 08:00",channels:["📧"],recipients:1,status:"Delivered",pages:2,cards:6},
  {id:4,schedule:"Shift Handover",sent:"10-Mar 06:00",channels:["📱","🔔"],recipients:2,status:"Failed",pages:3,cards:9},
  {id:5,schedule:"Morning Briefing",sent:"08-Mar 05:30",channels:["📧","📱","🔔"],recipients:3,status:"Delivered",pages:3,cards:9},
];
const INIT_NOTIFS = [
  {id:1,type:"warning",title:"Schedule Slip Detected",msg:"CDU progress now -7% vs plan. AI recommends crew reallocation.",time:"10-Mar 07:42",read:false},
  {id:2,type:"info",   title:"Morning Report Delivered",msg:"Morning Briefing sent to 3 recipients via Email, WhatsApp & In-App.",time:"10-Mar 05:31",read:false},
  {id:3,type:"danger", title:"Constraint Escalation",msg:"C-002 (OEM parts) now 7 days overdue. Requires immediate action.",time:"10-Mar 06:15",read:false},
  {id:4,type:"success",title:"Milestone Complete",msg:"FCC Reactor Decat completed successfully.",time:"09-Mar 18:20",read:true},
  {id:5,type:"info",   title:"New Punch Item",msg:"Cat-A punch raised on CDU E-301 — flange leak.",time:"09-Mar 14:05",read:true},
  {id:6,type:"warning",title:"Safety Near Miss",msg:"Near miss reported at HDS area — scaffolding incident.",time:"09-Mar 11:30",read:true},
];

/* ─── HELPERS / STYLE ───────────────────────────────────────────── */
const cs={background:"#161b22",border:"1px solid #30363d",borderRadius:12,padding:20};
const hs={fontSize:11,fontWeight:700,color:"#8b949e",textTransform:"uppercase",letterSpacing:1.2,marginBottom:14};
const spiColor=v=>v>=1?"#10b981":v>=0.92?"#f59e0b":"#ef4444";
const impactColor=s=>({High:"#ef4444",Medium:"#f59e0b",Low:"#6b7280",Critical:"#ef4444"})[s]||"#6b7280";
const prioColor=p=>({Critical:"#ef4444",High:"#f59e0b",Medium:"#3b82f6",Low:"#6b7280"})[p]||"#6b7280";
const statusBadge=s=>({complete:{bg:"#10b981",icon:"✅"},"in-progress":{bg:"#3b82f6",icon:"🔄"},"at-risk":{bg:"#ef4444",icon:"🔴"},"on-track":{bg:"#f59e0b",icon:"🟡"}})[s]||{bg:"#6b7280",icon:"⬜"};
const cellStyle=s=>({complete:{icon:"✅",bg:"#10b98112",color:"#10b981"},"in-progress":{icon:"🔄",bg:"#3b82f612",color:"#3b82f6"},overdue:{icon:"🔴",bg:"#ef444412",color:"#ef4444"},"not-started":{icon:"⬜",bg:"transparent",color:"#4b5563"}})[s]||{icon:"⬜",bg:"transparent",color:"#4b5563"};
const notifColor=t=>({warning:{bg:"#f59e0b22",border:"#f59e0b44",icon:"⚠️",color:"#f59e0b"},info:{bg:"#3b82f622",border:"#3b82f644",icon:"ℹ️",color:"#3b82f6"},danger:{bg:"#ef444422",border:"#ef444444",icon:"🚨",color:"#ef4444"},success:{bg:"#10b98122",border:"#10b98144",icon:"✅",color:"#10b981"}})[t]||{bg:"#1c2230",border:"#30363d",icon:"🔔",color:"#8b949e"};
function PctBar({v,color="#f59e0b"}){return(<div style={{height:5,background:"#30363d",borderRadius:3,marginTop:4}}><div style={{width:`${Math.min(v,100)}%`,height:5,background:color,borderRadius:3}}/></div>);}
function MiniBar({v}){const c=v>70?"#10b981":v>40?"#f59e0b":"#ef4444";return(<div style={{width:70,height:4,background:"#30363d",borderRadius:2,display:"inline-block",verticalAlign:"middle",marginRight:5}}><div style={{width:`${v}%`,height:4,background:c,borderRadius:2}}/></div>);}
function ChartTip({active,payload,label}){if(!active||!payload?.length)return null;return(<div style={{background:"#1c2230",border:"1px solid #30363d",borderRadius:8,padding:"8px 12px",fontSize:12}}><div style={{color:"#8b949e",marginBottom:4}}>{label}</div>{payload.map((p,i)=><div key={i} style={{color:p.color}}>{p.name}: <b>{p.value}%</b></div>)}</div>);}
function TH({children,c}){return<th style={{padding:"7px 9px",textAlign:c?"center":"left",color:"#6b7280",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:0.7,border:"1px solid #21262d",whiteSpace:"nowrap",background:"#1c2230"}}>{children}</th>;}
function TD({children,c,s}){return<td style={{padding:"6px 9px",border:"1px solid #21262d",textAlign:c?"center":"left",...(s||{})}}>{children}</td>;}

const AI_CTX=`You are an AI assistant for a Refinery Turnaround (TA/STO) management platform. Project: CDU-3 Turnaround 2026 | Day 23 of 54 | Date: 10-Mar-2026. Progress: Planned 68.2%, Actual 62.4% (-5.8%) | SPI: 0.915 | CPI: 0.943. Forecast MC: 09-Apr-2026 vs Planned 05-Apr-2026 (4 days behind). Units: CDU -7%, HDS +2%, FCC -7%, ARU -1%, SRU +2%, UTL -4%. Open Constraints: 5 (3 High impact). Punch: 187 open (23 Cat-A). Safety: 0 LTI. Answer professionally and concisely.`;

/* ════════════════════════════════════════════════════════════════ */
/* LOGIN SCREEN */
/* ════════════════════════════════════════════════════════════════ */
function LoginScreen({onLogin}) {
  const [email,setEmail]   = useState("");
  const [pass,setPass]     = useState("");
  const [err,setErr]       = useState("");
  const [loading,setLoading]=useState(false);

  const tryLogin = () => {
    setErr("");
    const u = DEMO_USERS.find(u=>u.email===email.trim()&&u.pass===pass);
    if (!u){setErr("Invalid credentials. Try a demo account below.");return;}
    setLoading(true);
    setTimeout(()=>onLogin(u),800);
  };

  return (
    <div style={{minHeight:"100vh",background:"#0d1117",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <div style={{width:420}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:40,marginBottom:8}}>⚙️</div>
          <div style={{fontSize:28,fontWeight:900,color:"#f59e0b",letterSpacing:1}}>RELTA</div>
          <div style={{fontSize:13,color:"#6b7280",marginTop:4}}>TA / STO Intelligence Platform</div>
          <div style={{fontSize:11,color:"#4b5563",marginTop:2}}>CDU-3 Turnaround 2026 • Powered by Syority AI</div>
        </div>
        <div style={{background:"#161b22",border:"1px solid #30363d",borderRadius:14,padding:28}}>
          <div style={{fontSize:14,fontWeight:700,color:"#e6edf3",marginBottom:20}}>Sign In</div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:"#8b949e",marginBottom:5,fontWeight:600}}>EMAIL ADDRESS</div>
            <input value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&tryLogin()} placeholder="your@email.com" style={{width:"100%",background:"#0d1117",border:"1px solid #30363d",borderRadius:8,color:"#e6edf3",padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div style={{marginBottom:20}}>
            <div style={{fontSize:11,color:"#8b949e",marginBottom:5,fontWeight:600}}>PASSWORD</div>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&tryLogin()} placeholder="••••••••" style={{width:"100%",background:"#0d1117",border:"1px solid #30363d",borderRadius:8,color:"#e6edf3",padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          </div>
          {err&&<div style={{background:"#ef444422",border:"1px solid #ef444444",borderRadius:7,padding:"8px 12px",color:"#ef4444",fontSize:12,marginBottom:14}}>{err}</div>}
          <button onClick={tryLogin} disabled={loading} style={{width:"100%",padding:"11px",background:loading?"#1c2230":"#f59e0b",border:"none",borderRadius:8,color:loading?"#6b7280":"#0d1117",fontSize:14,fontWeight:800,cursor:loading?"default":"pointer"}}>
            {loading?"Signing in...":"Sign In →"}
          </button>
        </div>
        <div style={{marginTop:20,background:"#161b22",border:"1px solid #30363d",borderRadius:12,padding:16}}>
          <div style={{fontSize:11,fontWeight:700,color:"#8b949e",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Demo Accounts</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {DEMO_USERS.map((u,i)=>(
              <button key={i} onClick={()=>{setEmail(u.email);setPass(u.pass);}}
                style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",borderRadius:7,border:"1px solid #21262d",background:"#0d1117",cursor:"pointer",textAlign:"left"}}>
                <div style={{width:26,height:26,borderRadius:"50%",background:ROLES[u.role].color+"33",border:`2px solid ${ROLES[u.role].color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:ROLES[u.role].color,flexShrink:0}}>{ROLES[u.role].badge}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:"#e6edf3"}}>{u.name}</div>
                  <div style={{fontSize:10,color:"#6b7280"}}>{u.role} • {u.email}</div>
                </div>
                <div style={{fontSize:10,color:"#4b5563",fontFamily:"monospace"}}>{u.pass}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/* MAIN APP */
/* ════════════════════════════════════════════════════════════════ */
export default function App() {
  const [user,setUser]     = useState(null);
  const [nav,setNav]       = useState("dashboard");
  const [aiOpen,setAiOpen] = useState(false);
  const [msgs,setMsgs]     = useState([{role:"assistant",content:"Hello! I'm your TA Intelligence Assistant.\n\nAsk me anything — schedule, constraints, resources, or risks."}]);
  const [inp,setInp]       = useState("");
  const [chatLoading,setChatLoading] = useState(false);
  const [aiJobs,setAiJobs] = useState(null);
  const [jobsLoading,setJobsLoading] = useState(false);
  const [notifs,setNotifs] = useState(INIT_NOTIFS);
  const [notifOpen,setNotifOpen] = useState(false);
  const [schedules,setSchedules] = useState(INIT_SCHEDULES);
  const [deliveryLog,setDeliveryLog] = useState(INIT_DELIVERY_LOG);
  const endRef = useRef(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[msgs,chatLoading]);

  const login  = (u) => { setUser(u); setNav("dashboard"); };
  const logout = ()  => { setUser(null); setNav("dashboard"); setAiOpen(false); };

  const unreadCount = notifs.filter(n=>!n.read).length;
  const markAllRead = () => setNotifs(n=>n.map(x=>({...x,read:true})));
  const markRead = id => setNotifs(n=>n.map(x=>x.id===id?{...x,read:true}:x));

  const addNotif = (type,title,msg) => {
    const id = Date.now();
    setNotifs(n=>[{id,type,title,msg,time:"Now",read:false},...n]);
  };

  const sendMsg = async (text) => {
    const q=text||inp; if(!q.trim()||chatLoading)return;
    const nm=[...msgs,{role:"user",content:q}];
    setMsgs(nm); setInp(""); setChatLoading(true);
    try {
      const r = await fetch(`/api/projects/demo/ai-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: q,
          chatHistory: nm.filter((m,i)=>m.role!=="assistant"||i>0).map(m=>({role:m.role,content:m.content})),
        }),
      });
      
      if (!r.ok || !r.body) throw new Error("API error");
      
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) text += parsed.text;
          } catch {}
        }
      }
      setMsgs(m=>[...m,{role:"assistant",content:text || "No response."}]);
    } catch { setMsgs(m=>[...m,{role:"assistant",content:"⚠️ Connection error."}]); }
    setChatLoading(false);
  };

  const loadAiJobs = async () => {
    setJobsLoading(true); setAiJobs(null);
    try {
      const r = await fetch(`/api/projects/demo/ai-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `${AI_CTX}\n\nGenerate TOP 6 critical jobs next 24hrs. Return ONLY JSON array: [{id,desc,unit,why,crew,risk}]. No markdown.`,
          chatHistory: [],
        }),
      });
      
      if (!r.ok || !r.body) throw new Error("API error");
      
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) text += parsed.text;
          } catch {}
        }
      }
      setAiJobs(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch { setAiJobs([]); }
    setJobsLoading(false);
  };

  if (!user) return <LoginScreen onLogin={login}/>;

  const role = ROLES[user.role];
  const allowedNav = role.nav;

  const ALL_NAV = [
    {id:"dashboard",  icon:"📊", label:"Dashboard"},
    {id:"lookahead",  icon:"🔭", label:"24hr Look-Ahead"},
    {id:"constraints",icon:"🚧", label:"Constraints"},
    {id:"punch",      icon:"📋", label:"Punch List"},
    {id:"cards",      icon:"🃏", label:"Card Generator"},
    {id:"reports",    icon:"📄", label:"Report Builder"},
    {id:"deliveries", icon:"📬", label:"Deliveries"},
    {id:"admin",      icon:"🛡️", label:"Admin Panel"},
  ];

  return (
    <RoleCtx.Provider value={{user,role}}>
      <div style={{display:"flex",minHeight:"100vh",background:"#0d1117",color:"#e6edf3",fontFamily:"'Segoe UI',system-ui,sans-serif",fontSize:14}}>
        {/* SIDEBAR */}
        <div style={{width:214,background:"#0d1117",borderRight:"1px solid #21262d",display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"14px",borderBottom:"1px solid #21262d"}}>
            <div style={{fontSize:15,fontWeight:800,color:"#f59e0b"}}>⚙️ RELTA</div>
            <div style={{fontSize:10,color:"#6b7280"}}>TA Intelligence Platform</div>
          </div>
          <div style={{padding:"10px 14px",borderBottom:"1px solid #21262d"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>CDU-3 TA 2026</div>
            <div style={{fontSize:10,color:"#6b7280",marginBottom:6}}>Day 23 of 54 • 10-Mar-2026</div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:10,color:"#8b949e"}}>Progress</span><span style={{fontSize:10,fontWeight:700,color:"#f59e0b"}}>62.4%</span></div>
            <PctBar v={62.4}/>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}><span style={{fontSize:10,color:"#8b949e"}}>Planned</span><span style={{fontSize:10,color:"#6b7280"}}>68.2%</span></div>
            <PctBar v={68.2} color="#30363d"/>
          </div>
          <nav style={{flex:1,padding:"8px"}}>
            {ALL_NAV.filter(n=>allowedNav.includes(n.id)).map(n => (
              <button key={n.id} onClick={()=>setNav(n.id)}
                style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"7px 10px",borderRadius:8,marginBottom:2,border:"none",cursor:"pointer",textAlign:"left",background:nav===n.id?"#1c2230":"transparent",color:nav===n.id?"#f59e0b":"#8b949e",fontSize:12}}>
                <span>{n.icon}</span><span style={{flex:1}}>{n.label}</span>
                {n.id==="deliveries"&&<span style={{fontSize:9,background:"#3b82f622",color:"#3b82f6",padding:"1px 5px",borderRadius:4}}>NEW</span>}
              </button>
            ))}
          </nav>
          {role.canAI && (
            <div style={{padding:"0 8px 10px"}}>
              <button onClick={()=>setAiOpen(o=>!o)} style={{width:"100%",padding:"8px 0",borderRadius:8,background:aiOpen?"#f59e0b":"#1c2230",border:"1px solid #f59e0b22",color:aiOpen?"#0d1117":"#f59e0b",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                🤖 {aiOpen?"Close AI Chat":"Ask AI"}
              </button>
            </div>
          )}
          <div style={{padding:"8px 14px 14px",borderTop:"1px solid #21262d",display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:30,height:30,borderRadius:"50%",background:role.color+"33",border:`2px solid ${role.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:role.color,flexShrink:0}}>{role.badge}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.name}</div>
              <div style={{fontSize:10,color:"#6b7280"}}>{user.role}</div>
            </div>
            <button onClick={logout} title="Sign out" style={{background:"none",border:"none",color:"#4b5563",cursor:"pointer",fontSize:14,padding:0}}>⏻</button>
          </div>
        </div>

        {/* MAIN */}
        <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,overflow:"hidden"}}>
          {/* TOPBAR */}
          <div style={{padding:"9px 18px",borderBottom:"1px solid #21262d",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
            <div style={{display:"flex",gap:22}}>
              {[{label:"SPI",val:PROJECT.spi,color:spiColor(PROJECT.spi)},{label:"CPI",val:PROJECT.cpi,color:spiColor(PROJECT.cpi)},{label:"Var.",val:"-5.8%",color:"#ef4444"},{label:"Manhours",val:`${(PROJECT.manhoursActual/1000).toFixed(0)}k/${(PROJECT.manhoursBudget/1000).toFixed(0)}k`,color:"#8b949e"},{label:"Fcast MC",val:PROJECT.forecastMC,color:"#ef4444"},{label:"Safety",val:"0 LTI",color:"#10b981"}].map((k,i)=>(
                <div key={i}><div style={{fontSize:9,color:"#6b7280",textTransform:"uppercase",letterSpacing:0.8,marginBottom:1}}>{k.label}</div><div style={{fontSize:14,fontWeight:800,color:k.color}}>{k.val}</div></div>
              ))}
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <div style={{background:"#1a0d0d",border:"1px solid #ef444444",borderRadius:8,padding:"4px 10px",fontSize:11,color:"#ef4444"}}>🔴 4 Days Behind</div>
              {/* NOTIFICATION BELL */}
              <div style={{position:"relative"}}>
                <button onClick={()=>setNotifOpen(o=>!o)}
                  style={{background:notifOpen?"#1c2230":"transparent",border:`1px solid ${notifOpen?"#30363d":"transparent"}`,borderRadius:8,padding:"5px 10px",cursor:"pointer",color:"#8b949e",fontSize:16,position:"relative"}}>
                  🔔
                  {unreadCount>0&&<span style={{position:"absolute",top:2,right:2,width:16,height:16,background:"#ef4444",borderRadius:"50%",fontSize:9,fontWeight:800,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>{unreadCount}</span>}
                </button>
                {notifOpen && (
                  <div style={{position:"absolute",right:0,top:"calc(100% + 8px)",width:340,background:"#161b22",border:"1px solid #30363d",borderRadius:12,zIndex:500,boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
                    <div style={{padding:"12px 14px",borderBottom:"1px solid #21262d",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{fontSize:13,fontWeight:700,color:"#e6edf3"}}>🔔 Notifications</div>
                      <div style={{display:"flex",gap:8}}>
                        {unreadCount>0&&<button onClick={markAllRead} style={{fontSize:10,color:"#6b7280",background:"none",border:"none",cursor:"pointer"}}>Mark all read</button>}
                        <button onClick={()=>setNotifOpen(false)} style={{background:"none",border:"none",color:"#6b7280",fontSize:18,cursor:"pointer",lineHeight:1}}>×</button>
                      </div>
                    </div>
                    <div style={{maxHeight:340,overflowY:"auto"}}>
                      {notifs.map(n=>{
                        const {bg,border,icon,color}=notifColor(n.type);
                        return (
                          <div key={n.id} onClick={()=>markRead(n.id)} style={{padding:"10px 14px",borderBottom:"1px solid #21262d",cursor:"pointer",background:n.read?"transparent":bg,borderLeft:n.read?"3px solid transparent":`3px solid ${color}`}}>
                            <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                              <span style={{fontSize:14,flexShrink:0,marginTop:1}}>{icon}</span>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                                  <span style={{fontSize:12,fontWeight:n.read?400:700,color:n.read?"#8b949e":"#e6edf3"}}>{n.title}</span>
                                  {!n.read&&<span style={{width:6,height:6,borderRadius:"50%",background:color,flexShrink:0,marginTop:4}}/>}
                                </div>
                                <div style={{fontSize:11,color:"#6b7280",lineHeight:1.4}}>{n.msg}</div>
                                <div style={{fontSize:10,color:"#4b5563",marginTop:3}}>{n.time}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{flex:1,display:"flex",overflow:"hidden"}}>
            <div style={{flex:1,overflowY:"auto",padding:18}}>
              {nav==="dashboard"    && <DashView loadAiJobs={loadAiJobs} aiJobs={aiJobs} jobsLoading={jobsLoading}/>}
              {nav==="lookahead"    && <LookAheadView/>}
              {nav==="constraints"  && <ConstraintsView/>}
              {nav==="punch"        && <PunchView/>}
              {nav==="cards"        && <CardGeneratorView/>}
              {nav==="reports"      && <ReportBuilderView addNotif={addNotif}/>}
              {nav==="deliveries"   && <DeliveriesView schedules={schedules} setSchedules={setSchedules} deliveryLog={deliveryLog} setDeliveryLog={setDeliveryLog} addNotif={addNotif}/>}
              {nav==="admin"        && <AdminView/>}
            </div>

            {/* AI CHAT PANEL */}
            {aiOpen && role.canAI && (
              <div style={{width:320,borderLeft:"1px solid #21262d",background:"#0d1117",display:"flex",flexDirection:"column",flexShrink:0}}>
                <div style={{padding:"12px 14px",borderBottom:"1px solid #21262d",background:"#161b22",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>🤖 TA AI Assistant</div><div style={{fontSize:10,color:"#6b7280"}}>CDU-3 context loaded • {user.role}</div></div>
                  <button onClick={()=>setAiOpen(false)} style={{background:"none",border:"none",color:"#6b7280",fontSize:20,cursor:"pointer",lineHeight:1}}>×</button>
                </div>
                <div style={{flex:1,overflowY:"auto",padding:12,display:"flex",flexDirection:"column",gap:8}}>
                  {msgs.map((m,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                      <div style={{maxWidth:"88%",padding:"8px 12px",borderRadius:10,background:m.role==="user"?"#f59e0b":"#161b22",border:m.role==="user"?"none":"1px solid #30363d",color:m.role==="user"?"#0d1117":"#e6edf3",fontSize:12,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{m.content}</div>
                    </div>
                  ))}
                  {chatLoading&&<div style={{display:"flex",gap:4,padding:"8px 12px",background:"#161b22",border:"1px solid #30363d",borderRadius:10,width:"fit-content"}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"#f59e0b",animation:`bounce 1.2s ${i*0.2}s infinite`}}/>)}</div>}
                  <div ref={endRef}/>
                </div>
                <div style={{padding:10,borderTop:"1px solid #21262d"}}>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>{["Units behind?","Top risks?","Crew recos?","Critical path?"].map(q=><button key={q} onClick={()=>sendMsg(q)} style={{fontSize:10,padding:"3px 7px",background:"#161b22",border:"1px solid #30363d",borderRadius:5,color:"#8b949e",cursor:"pointer"}}>{q}</button>)}</div>
                  <div style={{display:"flex",gap:6}}>
                    <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMsg()} placeholder="Ask about the TA..." style={{flex:1,background:"#161b22",border:"1px solid #30363d",borderRadius:8,padding:"8px 10px",color:"#e6edf3",fontSize:12,outline:"none"}}/>
                    <button onClick={()=>sendMsg()} disabled={chatLoading} style={{background:"#f59e0b",border:"none",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:13,opacity:chatLoading?0.6:1}}>➤</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.5}40%{transform:translateY(-5px);opacity:1}} ::-webkit-scrollbar{width:5px;height:5px} ::-webkit-scrollbar-track{background:#0d1117} ::-webkit-scrollbar-thumb{background:#30363d;border-radius:3px} *{box-sizing:border-box} select,button{outline:none}`}</style>
    </RoleCtx.Provider>
  );
}

/* ─── DELIVERIES VIEW ───────────────────────────────────────────── */
function DeliveriesView({schedules,setSchedules,deliveryLog,setDeliveryLog,addNotif}) {
  const {role} = useRole();
  const [tab,setTab]         = useState("schedules");
  const [editSched,setEditSched] = useState(null);
  const [newSched,setNewSched]   = useState(false);
  const [sending,setSending]     = useState(null);
  const [form,setForm] = useState({name:"",template:"Morning Briefing",recipients:"",channels:["Email"],freq:"Daily",time:"05:30",active:true});

  const TEMPLATES=["Morning Briefing","Management Summary","Custom"];
  const FREQS=["Daily","Shift Change","Weekly","On Demand"];
  const CHANNELS=["Email","WhatsApp","In-App"];
  const chanIcon={"Email":"📧","WhatsApp":"📱","In-App":"🔔"};

  const openNew = () => { setForm({name:"",template:"Morning Briefing",recipients:"",channels:["Email"],freq:"Daily",time:"05:30",active:true}); setNewSched(true); setEditSched(null); };
  const openEdit= s => { setForm({...s,recipients:s.recipients.join(", ")}); setEditSched(s.id); setNewSched(false); };
  const saveForm= () => {
    const rec = form.recipients.split(",").map(r=>r.trim()).filter(Boolean);
    if (!form.name.trim()||rec.length===0) return;
    if (editSched) {
      setSchedules(s=>s.map(x=>x.id===editSched?{...x,...form,recipients:rec}:x));
    } else {
      setSchedules(s=>[...s,{...form,id:Date.now(),recipients:rec,owner:"Current User"}]);
    }
    setNewSched(false); setEditSched(null);
  };
  const toggleActive = id => setSchedules(s=>s.map(x=>x.id===id?{...x,active:!x.active}:x));
  const deleteSched  = id => setSchedules(s=>s.filter(x=>x.id!==id));

  const simulateSend = async (sched) => {
    setSending(sched.id);
    await new Promise(r=>setTimeout(r,1800));
    const entry = {id:Date.now(),schedule:sched.name,sent:"Now",channels:sched.channels.map(c=>chanIcon[c]),recipients:sched.recipients.length,status:"Delivered",pages:3,cards:9};
    setDeliveryLog(l=>[entry,...l]);
    addNotif("success",`Report Delivered: ${sched.name}`,`Sent to ${sched.recipients.length} recipient(s) via ${sched.channels.join(", ")}.`);
    setSending(null);
  };

  const FormPanel = () => (
    <div style={{...cs,marginTop:14}}>
      <div style={{fontSize:13,fontWeight:700,color:"#f59e0b",marginBottom:16}}>{editSched?"✏️ Edit Schedule":"➕ New Schedule"}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {[{label:"Schedule Name",key:"name",type:"text",placeholder:"e.g. Morning Briefing"},{label:"Delivery Time",key:"time",type:"time"}].map(f=>(
          <div key={f.key}>
            <div style={{fontSize:11,color:"#8b949e",fontWeight:600,marginBottom:5}}>{f.label}</div>
            <input type={f.type} value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder||""} style={{width:"100%",background:"#0d1117",border:"1px solid #30363d",borderRadius:7,color:"#e6edf3",padding:"8px 10px",fontSize:12,outline:"none"}}/>
          </div>
        ))}
        <div>
          <div style={{fontSize:11,color:"#8b949e",fontWeight:600,marginBottom:5}}>Template</div>
          <select value={form.template} onChange={e=>setForm(p=>({...p,template:e.target.value}))} style={{width:"100%",background:"#0d1117",border:"1px solid #30363d",borderRadius:7,color:"#e6edf3",padding:"8px 10px",fontSize:12}}>
            {TEMPLATES.map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <div style={{fontSize:11,color:"#8b949e",fontWeight:600,marginBottom:5}}>Frequency</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {FREQS.map(f=><button key={f} onClick={()=>setForm(p=>({...p,freq:f}))} style={{padding:"4px 9px",borderRadius:6,border:`1px solid ${form.freq===f?"#f59e0b":"#30363d"}`,background:form.freq===f?"#f59e0b22":"transparent",color:form.freq===f?"#f59e0b":"#6b7280",fontSize:11,cursor:"pointer"}}>{f}</button>)}
          </div>
        </div>
        <div style={{gridColumn:"1/-1"}}>
          <div style={{fontSize:11,color:"#8b949e",fontWeight:600,marginBottom:5}}>Recipients (comma-separated)</div>
          <input value={form.recipients} onChange={e=>setForm(p=>({...p,recipients:e.target.value}))} placeholder="email1@co.com, email2@co.com" style={{width:"100%",background:"#0d1117",border:"1px solid #30363d",borderRadius:7,color:"#e6edf3",padding:"8px 10px",fontSize:12,outline:"none"}}/>
        </div>
        <div style={{gridColumn:"1/-1"}}>
          <div style={{fontSize:11,color:"#8b949e",fontWeight:600,marginBottom:6}}>Delivery Channels</div>
          <div style={{display:"flex",gap:8}}>
            {CHANNELS.map(ch=>{
              const on=form.channels.includes(ch);
              const colors={"Email":"#f59e0b","WhatsApp":"#10b981","In-App":"#3b82f6"};
              return(
                <button key={ch} onClick={()=>setForm(p=>({...p,channels:on?p.channels.filter(c=>c!==ch):[...p.channels,ch]}))}
                  style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${on?colors[ch]+"88":"#30363d"}`,background:on?colors[ch]+"22":"transparent",color:on?colors[ch]:"#6b7280",fontSize:12,cursor:"pointer",fontWeight:on?700:400}}>
                  {chanIcon[ch]} {ch}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}>
        <button onClick={()=>{setNewSched(false);setEditSched(null);}} style={{padding:"7px 16px",background:"#1c2230",border:"1px solid #30363d",borderRadius:7,color:"#8b949e",fontSize:12,cursor:"pointer"}}>Cancel</button>
        <button onClick={saveForm} style={{padding:"7px 18px",background:"#f59e0b",border:"none",borderRadius:7,color:"#0d1117",fontSize:12,fontWeight:700,cursor:"pointer"}}>💾 Save Schedule</button>
      </div>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:18,fontWeight:800,color:"#f59e0b",marginBottom:2}}>📬 Delivery Manager</div>
          <div style={{fontSize:11,color:"#6b7280"}}>Manage scheduled report delivery across Email, WhatsApp & In-App</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <div style={{display:"flex",gap:2,background:"#161b22",borderRadius:8,padding:3,border:"1px solid #30363d"}}>
            {["schedules","log","whatsapp"].map(t=><button key={t} onClick={()=>setTab(t)} style={{padding:"5px 14px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:tab===t?"#f59e0b":"transparent",color:tab===t?"#0d1117":"#6b7280",textTransform:"capitalize"}}>{t==="log"?"Delivery Log":t==="whatsapp"?"WhatsApp Preview":t}</button>)}
          </div>
          {tab==="schedules"&&role.canBuild&&<button onClick={openNew} style={{padding:"6px 14px",background:"#f59e0b",border:"none",borderRadius:8,color:"#0d1117",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ New Schedule</button>}
        </div>
      </div>

      {/* KPI row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        {[{label:"Active Schedules",val:schedules.filter(s=>s.active).length,color:"#10b981"},{label:"Reports This Week",val:deliveryLog.length,color:"#3b82f6"},{label:"Delivered",val:deliveryLog.filter(d=>d.status==="Delivered").length,color:"#10b981"},{label:"Failed",val:deliveryLog.filter(d=>d.status==="Failed").length,color:"#ef4444"}].map((k,i)=>(
          <div key={i} style={{...cs,padding:"12px 16px"}}>
            <div style={{fontSize:22,fontWeight:800,color:k.color}}>{k.val}</div>
            <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* SCHEDULES TAB */}
      {tab==="schedules" && (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {schedules.map(s=>(
            <div key={s.id} style={{...cs,padding:16,borderLeft:`4px solid ${s.active?"#10b981":"#30363d"}`}}>
              <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:700,color:s.active?"#e6edf3":"#6b7280"}}>{s.name}</span>
                    <span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:s.active?"#10b98122":"#30363d",color:s.active?"#10b981":"#6b7280",fontWeight:600}}>{s.active?"Active":"Paused"}</span>
                  </div>
                  <div style={{display:"flex",gap:12,fontSize:11,color:"#6b7280",flexWrap:"wrap"}}>
                    <span>📋 {s.template}</span>
                    <span>⏰ {s.freq} at {s.time}</span>
                    <span>👥 {s.recipients.length} recipient(s)</span>
                    <span>{s.channels.map(c=>chanIcon[c]).join(" ")} {s.channels.join(", ")}</span>
                  </div>
                  <div style={{fontSize:10,color:"#4b5563",marginTop:3}}>{s.recipients.join(", ")}</div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button onClick={()=>simulateSend(s)} disabled={sending===s.id}
                    style={{padding:"5px 12px",background:sending===s.id?"#1c2230":"#3b82f622",border:`1px solid ${sending===s.id?"#30363d":"#3b82f644"}`,borderRadius:7,color:sending===s.id?"#4b5563":"#3b82f6",fontSize:11,fontWeight:600,cursor:sending===s.id?"default":"pointer",whiteSpace:"nowrap"}}>
                    {sending===s.id?"⏳ Sending...":"📤 Send Now"}
                  </button>
                  {role.canBuild&&<>
                    <button onClick={()=>toggleActive(s.id)} style={{padding:"5px 10px",background:"transparent",border:"1px solid #30363d",borderRadius:7,color:"#8b949e",fontSize:11,cursor:"pointer"}}>{s.active?"⏸ Pause":"▶ Resume"}</button>
                    <button onClick={()=>openEdit(s)} style={{padding:"5px 10px",background:"transparent",border:"1px solid #30363d",borderRadius:7,color:"#8b949e",fontSize:11,cursor:"pointer"}}>✏️</button>
                    {role.canAdmin&&<button onClick={()=>deleteSched(s.id)} style={{padding:"5px 10px",background:"transparent",border:"1px solid #ef444433",borderRadius:7,color:"#ef4444",fontSize:11,cursor:"pointer"}}>🗑️</button>}
                  </>}
                </div>
              </div>
            </div>
          ))}
          {(newSched||editSched) && <FormPanel/>}
        </div>
      )}

      {/* DELIVERY LOG TAB */}
      {tab==="log" && (
        <div style={cs}>
          <div style={hs}>📜 Delivery History</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr>{["Schedule","Sent","Channels","Recipients","Pages","Cards","Status"].map(h=><th key={h} style={{padding:"7px 10px",textAlign:"left",color:"#6b7280",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:0.7,borderBottom:"1px solid #30363d",whiteSpace:"nowrap"}}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {deliveryLog.map((d,i)=>(
                  <tr key={i} style={{borderBottom:"1px solid #21262d"}}>
                    <td style={{padding:"8px 10px",fontWeight:600,color:"#e6edf3"}}>{d.schedule}</td>
                    <td style={{padding:"8px 10px",color:"#8b949e",whiteSpace:"nowrap"}}>{d.sent}</td>
                    <td style={{padding:"8px 10px",fontSize:15}}>{Array.isArray(d.channels)?d.channels.join(" "):d.channels}</td>
                    <td style={{padding:"8px 10px",color:"#3b82f6",fontWeight:700,textAlign:"center"}}>{d.recipients}</td>
                    <td style={{padding:"8px 10px",color:"#8b949e",textAlign:"center"}}>{d.pages}</td>
                    <td style={{padding:"8px 10px",color:"#8b949e",textAlign:"center"}}>{d.cards}</td>
                    <td style={{padding:"8px 10px"}}><span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:d.status==="Delivered"?"#10b98122":"#ef444422",color:d.status==="Delivered"?"#10b981":"#ef4444"}}>{d.status==="Delivered"?"✅ Delivered":"❌ Failed"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WHATSAPP PREVIEW TAB */}
      {tab==="whatsapp" && <WhatsAppPreview/>}
    </div>
  );
}

/* ─── WHATSAPP PREVIEW ──────────────────────────────────────────── */
function WhatsAppPreview() {
  const [waText,setWaText]     = useState("");
  const [waLoading,setWaLoading] = useState(false);
  const [waType,setWaType]       = useState("24hr Progress + Constraints");

  const WA_PROMPTS = {
    "24hr Progress + Constraints": `${AI_CTX}\n\nGenerate a WhatsApp message for the TA site team: last 24hr progress summary + open constraints. Format it naturally for WhatsApp — use emojis, clear sections, keep it under 300 words. Make it feel like a professional but readable field update.`,
    "Shift Handover Summary": `${AI_CTX}\n\nGenerate a WhatsApp shift handover message for the incoming superintendent. Summarise key completed activities, deferrals, open constraints, safety status, and critical jobs for next shift. Use emojis and WhatsApp-style formatting. Under 250 words.`,
    "Management Flash Update": `${AI_CTX}\n\nGenerate a brief WhatsApp flash update for senior management. Focus on overall progress, schedule variance, top 2-3 risks, and bottom line. Executive tone, under 150 words, with key numbers prominent.`,
  };

  const generate = async () => {
    setWaLoading(true); setWaText("");
    try {
      // Use the internal AI assistant route
      const r = await fetch(`/api/projects/demo/ai-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: WA_PROMPTS[waType],
          chatHistory: [],
        }),
      });
      
      if (!r.ok || !r.body) throw new Error("API error");
      
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) text += parsed.text;
          } catch {}
        }
      }
      setWaText(text || "⚠️ Could not generate message.");
    } catch { setWaText("⚠️ Could not generate message. Please try again."); }
    setWaLoading(false);
  };

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <div style={cs}>
        <div style={hs}>📱 WhatsApp Message Generator</div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:"#8b949e",fontWeight:600,marginBottom:6}}>Message Type</div>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {Object.keys(WA_PROMPTS).map(t=>(
              <button key={t} onClick={()=>setWaType(t)}
                style={{padding:"8px 12px",borderRadius:7,border:`1px solid ${waType===t?"#25D366":"#30363d"}`,background:waType===t?"#25D36622":"transparent",color:waType===t?"#25D366":"#8b949e",fontSize:12,cursor:"pointer",textAlign:"left",fontWeight:waType===t?600:400}}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <button onClick={generate} disabled={waLoading}
          style={{width:"100%",padding:"9px",background:waLoading?"#1c2230":"#25D366",border:"none",borderRadius:8,color:waLoading?"#6b7280":"#fff",fontSize:13,fontWeight:700,cursor:waLoading?"default":"pointer"}}>
          {waLoading?"⏳ Generating AI message...":"📱 Generate WhatsApp Message"}
        </button>
        <div style={{marginTop:12,padding:"10px 12px",background:"#1c2230",borderRadius:8,border:"1px solid #30363d",fontSize:11,color:"#6b7280"}}>
          <b style={{color:"#8b949e"}}>How it works:</b> Syority AI analyses the current TA data and generates a WhatsApp-formatted message appropriate for the selected audience. In production, this sends via the WhatsApp Business API.
        </div>
      </div>
      <div style={cs}>
        <div style={hs}>📱 Message Preview</div>
        {/* Phone mockup */}
        <div style={{background:"#1a1a1a",borderRadius:20,padding:"16px 12px",border:"3px solid #333",maxHeight:480,overflow:"hidden",display:"flex",flexDirection:"column"}}>
          <div style={{background:"#075E54",borderRadius:"14px 14px 0 0",padding:"10px 14px",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:"#f59e0b",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#0d1117"}}>TA</div>
            <div><div style={{fontSize:12,fontWeight:700,color:"#fff"}}>CDU-3 TA 2026</div><div style={{fontSize:10,color:"#9de1d4"}}>RELTA Group Chat</div></div>
          </div>
          <div style={{flex:1,background:"#ECE5DD",padding:12,overflowY:"auto",borderRadius:"0 0 14px 14px"}}>
            {!waText && !waLoading && (
              <div style={{textAlign:"center",padding:"30px 10px",color:"#999",fontSize:12}}>Generate a message to preview it here</div>
            )}
            {waLoading && (
              <div style={{textAlign:"center",padding:"30px 10px",color:"#999",fontSize:12}}>🤖 AI is writing your message...</div>
            )}
            {waText && (
              <div style={{background:"#fff",borderRadius:"0 8px 8px 8px",padding:"10px 12px",boxShadow:"0 1px 3px rgba(0,0,0,0.15)",maxWidth:"90%"}}>
                <div style={{fontSize:12,color:"#1a1a1a",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{waText}</div>
                <div style={{fontSize:10,color:"#999",marginTop:6,textAlign:"right"}}>10-Mar-2026 05:31 ✓✓</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── ADMIN PANEL ───────────────────────────────────────────────── */
function AdminView() {
  const [activeTab, setActiveTab] = useState("users");
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{fontSize:18,fontWeight:800,color:"#ef4444",marginBottom:2}}>🛡️ Admin Panel</div>
      <div style={{display:"flex",gap:2,background:"#161b22",borderRadius:8,padding:3,border:"1px solid #30363d",width:"fit-content"}}>
        {["users","permissions","audit"].map(t=><button key={t} onClick={()=>setActiveTab(t)} style={{padding:"5px 16px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:activeTab===t?"#ef4444":"transparent",color:activeTab===t?"#fff":"#6b7280",textTransform:"capitalize"}}>{t}</button>)}
      </div>
      {activeTab==="users" && (
        <div style={cs}>
          <div style={hs}>👥 User Management</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>{["User","Email","Role","Access Level","Status"].map(h=><th key={h} style={{padding:"8px 10px",textAlign:"left",color:"#6b7280",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:0.7,borderBottom:"1px solid #30363d"}}>{h}</th>)}</tr></thead>
            <tbody>
              {DEMO_USERS.map((u,i)=>{
                const r=ROLES[u.role];
                return(
                  <tr key={i} style={{borderBottom:"1px solid #21262d"}}>
                    <td style={{padding:"10px 10px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:28,height:28,borderRadius:"50%",background:r.color+"33",border:`2px solid ${r.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:r.color,flexShrink:0}}>{r.badge}</div>
                        <span style={{fontWeight:600,color:"#e6edf3"}}>{u.name}</span>
                      </div>
                    </td>
                    <td style={{padding:"10px 10px",color:"#6b7280"}}>{u.email}</td>
                    <td style={{padding:"10px 10px"}}><span style={{background:r.color+"22",color:r.color,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:600}}>{u.role}</span></td>
                    <td style={{padding:"10px 10px"}}>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                        {[["AI",r.canAI],["Build",r.canBuild],["Data",r.canData],["Admin",r.canAdmin]].map(([lbl,on])=>(
                          <span key={lbl} style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:on?"#10b98122":"#30363d",color:on?"#10b981":"#4b5563",fontWeight:600}}>{lbl}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{padding:"10px 10px"}}><span style={{fontSize:10,color:"#10b981",fontWeight:600}}>● Active</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {activeTab==="permissions" && (
        <div style={cs}>
          <div style={hs}>🔐 Role Permissions Matrix</div>
          <div style={{overflowX:"auto"}}>
            <table style={{borderCollapse:"collapse",fontSize:12,width:"100%"}}>
              <thead>
                <tr>
                  <th style={{padding:"8px 12px",textAlign:"left",color:"#6b7280",fontSize:10,textTransform:"uppercase",borderBottom:"1px solid #30363d"}}>Feature</th>
                  {Object.keys(ROLES).map(r=><th key={r} style={{padding:"8px 12px",textAlign:"center",color:ROLES[r].color,fontSize:11,fontWeight:700,borderBottom:"1px solid #30363d",whiteSpace:"nowrap"}}>{r}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  {label:"Full Dashboard",check:()=>true},
                  {label:"AI Features",check:r=>ROLES[r].canAI},
                  {label:"Report Builder",check:r=>ROLES[r].canBuild},
                  {label:"Card Generator",check:()=>true},
                  {label:"Data Entry",check:r=>ROLES[r].canData},
                  {label:"Admin Panel",check:r=>ROLES[r].canAdmin},
                  {label:"Receive Reports",check:()=>true},
                ].map((row,i)=>(
                  <tr key={i} style={{borderBottom:"1px solid #21262d",background:i%2===0?"transparent":"#1c220808"}}>
                    <td style={{padding:"10px 12px",fontWeight:600,color:"#e6edf3"}}>{row.label}</td>
                    {Object.keys(ROLES).map(r=>(
                      <td key={r} style={{padding:"10px 12px",textAlign:"center",fontSize:16}}>
                        {row.check(r)?"✅":"❌"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {activeTab==="audit" && (
        <div style={cs}>
          <div style={hs}>📜 Audit Log</div>
          {[
            {time:"10-Mar 07:42",user:"Sarah Mitchell",action:"Opened Report Builder",detail:"Morning Briefing template loaded"},
            {time:"10-Mar 07:38",user:"Omar Khalid",action:"Updated Constraint",detail:"C-003 status updated"},
            {time:"10-Mar 06:15",user:"System",action:"Report Delivered",detail:"Morning Briefing → 3 recipients"},
            {time:"10-Mar 05:31",user:"System",action:"WhatsApp Sent",detail:"24hr Progress Summary → Site Group"},
            {time:"09-Mar 18:20",user:"Dave Robertson",action:"Milestone Marked Complete",detail:"FCC Reactor Decat"},
            {time:"09-Mar 14:05",user:"Omar Khalid",action:"Punch Item Raised",detail:"Cat-A: CDU E-301 flange leak"},
          ].map((a,i)=>(
            <div key={i} style={{display:"flex",gap:12,padding:"8px 0",borderBottom:"1px solid #21262d",fontSize:12}}>
              <span style={{color:"#4b5563",whiteSpace:"nowrap",flexShrink:0}}>{a.time}</span>
              <span style={{color:"#f59e0b",fontWeight:600,flexShrink:0,whiteSpace:"nowrap"}}>{a.user}</span>
              <span style={{color:"#8b949e"}}>{a.action}</span>
              <span style={{color:"#4b5563",fontSize:11}}>{a.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── DASHBOARD ─────────────────────────────────────────────────── */
function DashView({loadAiJobs,aiJobs,jobsLoading}) {
  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
      <div style={{...cs,gridColumn:"1/-1"}}><ShiftCard/></div>
      <div style={{...cs,gridColumn:"span 2"}}><SCurveCard/></div>
      <div style={cs}><SafetyCard/></div>
      <div style={{...cs,gridColumn:"span 2"}}><UnitProgressCard/></div>
      <div style={cs}><MilestoneCard/></div>
      <div style={{...cs,gridColumn:"1/-1"}}><AiJobsCard loadAiJobs={loadAiJobs} aiJobs={aiJobs} jobsLoading={jobsLoading}/></div>
    </div>
  );
}

function ShiftCard() {
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
        <div style={hs}>🕐 Shift Summary</div>
        <span style={{fontSize:11,color:"#6b7280"}}>{SHIFT.date} • {SHIFT.supervisor}</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10,marginBottom:14}}>
        {[{label:"Crew",val:SHIFT.crew,color:"#e6edf3"},{label:"Planned",val:SHIFT.planned,color:"#e6edf3"},{label:"Complete",val:SHIFT.completed,color:"#10b981"},{label:"In Prog.",val:SHIFT.inProgress,color:"#3b82f6"},{label:"Deferred",val:SHIFT.deferred,color:"#ef4444"},{label:"Manhours",val:SHIFT.manhours.toLocaleString(),color:"#f59e0b"}].map((k,i)=>(
          <div key={i} style={{background:"#1c2230",borderRadius:8,padding:"9px",textAlign:"center"}}>
            <div style={{fontSize:18,fontWeight:800,color:k.color}}>{k.val}</div>
            <div style={{fontSize:10,color:"#6b7280",marginTop:1}}>{k.label}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:"#10b981",textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>✅ Highlights</div>
          {SHIFT.highlights.map((h,i)=><div key={i} style={{fontSize:11,color:"#8b949e",padding:"3px 0",borderBottom:"1px solid #21262d"}}>{h}</div>)}
        </div>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:"#ef4444",textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>⚠️ Deferrals</div>
          {SHIFT.deferrals.map((d,i)=><div key={i} style={{fontSize:11,color:"#8b949e",padding:"3px 0",borderBottom:"1px solid #21262d"}}>• {d}</div>)}
        </div>
      </div>
    </div>
  );
}
function SCurveCard() {
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
        <div style={hs}>📈 S-Curve</div>
        <div style={{display:"flex",gap:10,fontSize:11}}>
          <span style={{color:"#3b82f6"}}>● Planned</span><span style={{color:"#10b981"}}>● Actual</span><span style={{color:"#f59e0b"}}>● Forecast</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <AreaChart data={S_CURVE} margin={{top:5,right:5,left:-20,bottom:0}}>
          <defs>
            <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
            <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
            <linearGradient id="gf" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d"/>
          <XAxis dataKey="w" tick={{fill:"#6b7280",fontSize:10}} axisLine={false} tickLine={false}/>
          <YAxis tick={{fill:"#6b7280",fontSize:10}} axisLine={false} tickLine={false} domain={[0,100]}/>
          <Tooltip content={<ChartTip/>}/>
          <Area type="monotone" dataKey="p" stroke="#3b82f6" fill="url(#gp)" strokeWidth={2} name="Planned" dot={false} connectNulls/>
          <Area type="monotone" dataKey="a" stroke="#10b981" fill="url(#ga)" strokeWidth={2} name="Actual" dot={false} connectNulls/>
          <Area type="monotone" dataKey="f" stroke="#f59e0b" fill="url(#gf)" strokeWidth={2} strokeDasharray="5 3" name="Forecast" dot={false} connectNulls/>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
function UnitProgressCard() {
  return (
    <div>
      <div style={hs}>🏭 Unit-wise Progress</div>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={UNITS} barCategoryGap="30%" margin={{top:0,right:5,left:-25,bottom:0}}>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false}/>
          <XAxis dataKey="u" tick={{fill:"#8b949e",fontSize:11}} axisLine={false} tickLine={false}/>
          <YAxis tick={{fill:"#6b7280",fontSize:10}} axisLine={false} tickLine={false} domain={[0,100]}/>
          <Tooltip content={<ChartTip/>}/>
          <Bar dataKey="p" fill="#3b82f6" name="Planned" radius={[3,3,0,0]} opacity={0.5}/>
          <Bar dataKey="a" fill="#f59e0b" name="Actual" radius={[3,3,0,0]} label={{position:"top",fill:"#8b949e",fontSize:10,formatter:v=>`${v}%`}}/>
        </BarChart>
      </ResponsiveContainer>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
        {UNITS.map(u=>{const d=u.a-u.p;return(<div key={u.u} style={{background:"#1c2230",borderRadius:5,padding:"3px 8px",fontSize:11}}><span style={{color:"#8b949e"}}>{u.u} </span><span style={{color:d>=0?"#10b981":Math.abs(d)<=3?"#f59e0b":"#ef4444",fontWeight:700}}>{d>0?"+":""}{d}%</span></div>);})}
      </div>
    </div>
  );
}
function SafetyCard() {
  return (
    <div>
      <div style={hs}>🦺 Safety KPIs</div>
      <div style={{textAlign:"center",marginBottom:12,padding:"10px",background:"#10b98111",border:"1px solid #10b98122",borderRadius:8}}>
        <div style={{fontSize:30,fontWeight:900,color:"#10b981"}}>0</div>
        <div style={{fontSize:11,color:"#10b981",fontWeight:600}}>Lost Time Injuries</div>
        <div style={{fontSize:10,color:"#6b7280",marginTop:1}}>{SAFETY.manhrsLTI.toLocaleString()} manhours LTI-free</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
        {[{label:"Near Miss",val:SAFETY.nearMiss,color:"#f59e0b"},{label:"First Aid",val:SAFETY.firstAid,color:"#f59e0b"},{label:"PTW Issued",val:SAFETY.ptw_issued,color:"#3b82f6"},{label:"PTW Closed",val:SAFETY.ptw_closed,color:"#10b981"},{label:"Toolbox Talks",val:SAFETY.toolboxTalks,color:"#8b949e"}].map((k,i)=>(
          <div key={i} style={{background:"#1c2230",borderRadius:6,padding:"7px 9px"}}>
            <div style={{fontSize:15,fontWeight:800,color:k.color}}>{k.val}</div>
            <div style={{fontSize:10,color:"#6b7280"}}>{k.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function MilestoneCard() {
  return (
    <div>
      <div style={hs}>🎯 Milestones</div>
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {MILESTONES.map((m,i)=>{const {bg,icon}=statusBadge(m.status);return(<div key={i} style={{display:"flex",alignItems:"center",gap:7,padding:"5px 8px",borderRadius:6,background:"#1c2230",borderLeft:`3px solid ${bg}`}}><span>{icon}</span><div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:600,color:"#e6edf3",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.name}</div><div style={{fontSize:10,color:"#6b7280"}}>{m.unit} • {m.planned}</div></div>{m.actual&&<span style={{fontSize:9,color:"#6b7280",flexShrink:0}}>{m.actual}</span>}</div>);})}
      </div>
    </div>
  );
}
function AiJobsCard({loadAiJobs,aiJobs,jobsLoading}) {
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={hs}>🤖 AI Critical Jobs — Next 24hr</div>
        <button onClick={loadAiJobs} disabled={jobsLoading} style={{padding:"5px 14px",background:jobsLoading?"#1c2230":"#f59e0b",border:"none",borderRadius:8,color:jobsLoading?"#6b7280":"#0d1117",fontSize:12,fontWeight:700,cursor:jobsLoading?"default":"pointer"}}>{jobsLoading?"⏳ Analysing...":"✨ Generate Analysis"}</button>
      </div>
      {!aiJobs&&!jobsLoading&&<div style={{textAlign:"center",padding:"24px",background:"#1c2230",borderRadius:8,border:"1px dashed #30363d"}}><div style={{fontSize:24,marginBottom:6}}>🤖</div><div style={{color:"#8b949e",fontSize:12}}>Click "Generate Analysis" to get AI's critical job recommendations</div></div>}
      {jobsLoading&&<div style={{textAlign:"center",padding:"24px",background:"#1c2230",borderRadius:8}}><div style={{fontSize:12,color:"#f59e0b"}}>🤖 Analysing schedule, constraints & resources...</div></div>}
      {aiJobs&&aiJobs.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
          {aiJobs.map((j,i)=>{const bc=i<2?"#ef444433":i<4?"#f59e0b33":"#30363d",tc=i<2?"#ef4444":"#f59e0b";return(<div key={i} style={{background:"#1c2230",borderRadius:8,padding:"11px 13px",border:`1px solid ${bc}`}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}><span style={{fontSize:10,fontWeight:700,color:"#8b949e"}}>{j.id||`JOB-${i+1}`}</span><span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:20,background:tc+"22",color:tc}}>{j.unit}</span></div><div style={{fontSize:11,fontWeight:600,color:"#e6edf3",marginBottom:5,lineHeight:1.4}}>{j.desc}</div><div style={{fontSize:10,color:"#6b7280",marginBottom:5}}><span style={{color:"#f59e0b"}}>Why: </span>{j.why}</div><div style={{display:"flex",gap:6}}><div style={{background:"#161b22",borderRadius:5,padding:"2px 7px",fontSize:10}}><span style={{color:"#6b7280"}}>Crew: </span><span style={{color:"#3b82f6",fontWeight:700}}>{j.crew}</span></div><div style={{background:"#161b22",borderRadius:5,padding:"2px 7px",fontSize:10,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}><span style={{color:"#ef4444"}}>{j.risk}</span></div></div></div>);})}
        </div>
      )}
      {aiJobs&&aiJobs.length===0&&<div style={{textAlign:"center",padding:16,color:"#6b7280",fontSize:12}}>⚠️ Could not parse AI response. Try again.</div>}
    </div>
  );
}

/* ─── LOOK-AHEAD ────────────────────────────────────────────────── */
function LookAheadView() {
  return (
    <div style={cs}>
      <div style={hs}>🔭 24-Hour Look-Ahead — 11-Mar-2026</div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:"1px solid #30363d"}}>{["Act. ID","Description","Unit","Discipline","Contractor","Start","Duration","Crew","Priority"].map(h=><th key={h} style={{padding:"7px 9px",textAlign:"left",color:"#6b7280",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:0.7,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
          <tbody>
            {LOOKAHEAD.map((a,i)=>(
              <tr key={i} style={{borderBottom:"1px solid #21262d"}}>
                <td style={{padding:"8px 9px",color:"#3b82f6",fontWeight:600}}>{a.id}</td>
                <td style={{padding:"8px 9px",color:"#e6edf3"}}>{a.desc}</td>
                <td style={{padding:"8px 9px"}}><span style={{background:"#f59e0b22",color:"#f59e0b",padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{a.unit}</span></td>
                <td style={{padding:"8px 9px",color:"#8b949e"}}>{a.disc}</td>
                <td style={{padding:"8px 9px",color:"#8b949e"}}>{a.contractor}</td>
                <td style={{padding:"8px 9px",color:"#e6edf3",whiteSpace:"nowrap"}}>{a.start}</td>
                <td style={{padding:"8px 9px",color:"#8b949e"}}>{a.dur}</td>
                <td style={{padding:"8px 9px",color:"#3b82f6",fontWeight:700,textAlign:"center"}}>{a.crew}</td>
                <td style={{padding:"8px 9px"}}><span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:20,background:prioColor(a.priority)+"22",color:prioColor(a.priority)}}>{a.priority}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── CONSTRAINTS ───────────────────────────────────────────────── */
function ConstraintsView() {
  return (
    <div style={cs}>
      <div style={hs}>🚧 Constraint Log</div>
      {CONSTRAINTS.map((c,i)=>(
        <div key={i} style={{background:"#1c2230",borderRadius:8,padding:"12px 14px",borderLeft:`4px solid ${impactColor(c.impact)}`,marginBottom:9}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
            <div style={{display:"flex",gap:7,alignItems:"center"}}><span style={{fontSize:11,fontWeight:700,color:"#3b82f6"}}>{c.id}</span><span style={{fontSize:11,fontWeight:600,color:"#e6edf3"}}>{c.desc}</span></div>
            <div style={{display:"flex",gap:5,flexShrink:0,marginLeft:10}}><span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:impactColor(c.impact)+"22",color:impactColor(c.impact)}}>{c.impact}</span><span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:"#ef444422",color:"#ef4444"}}>{c.status}</span></div>
          </div>
          <div style={{display:"flex",gap:16,fontSize:11,color:"#6b7280"}}>
            <span>Owner: <b style={{color:"#8b949e"}}>{c.owner}</b></span>
            <span>Due: <b style={{color:"#ef4444"}}>{c.due}</b></span>
            <span>Age: <b style={{color:c.age>=5?"#ef4444":"#f59e0b"}}>{c.age}d</b></span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── PUNCH LIST ────────────────────────────────────────────────── */
function PunchView() {
  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <div style={{...cs,gridColumn:"1/-1"}}>
        <div style={hs}>📋 Punch List Summary</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
          {[{label:"Total",val:PUNCH.total,color:"#e6edf3"},{label:"Open",val:PUNCH.open,color:"#ef4444"},{label:"Closed",val:PUNCH.closed,color:"#10b981"},{label:"Closure",val:`${((PUNCH.closed/PUNCH.total)*100).toFixed(0)}%`,color:"#f59e0b"}].map((k,i)=>(
            <div key={i} style={{background:"#1c2230",borderRadius:8,padding:"12px",textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:k.color}}>{k.val}</div><div style={{fontSize:10,color:"#6b7280",marginTop:2}}>{k.label}</div></div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
          {[{cat:"Cat-A",sub:"Before startup",d:PUNCH.catA,color:"#ef4444"},{cat:"Cat-B",sub:"Before handover",d:PUNCH.catB,color:"#f59e0b"},{cat:"Cat-C",sub:"Within 90 days",d:PUNCH.catC,color:"#3b82f6"}].map((c,i)=>(
            <div key={i} style={{background:"#1c2230",borderRadius:8,padding:"12px",borderTop:`3px solid ${c.color}`}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:13,fontWeight:700,color:c.color}}>{c.cat}</span><span style={{fontSize:10,color:"#6b7280"}}>{c.sub}</span></div>
              <div style={{display:"flex",gap:10,marginBottom:6}}><div><div style={{fontSize:17,fontWeight:800,color:"#ef4444"}}>{c.d.open}</div><div style={{fontSize:10,color:"#6b7280"}}>Open</div></div><div><div style={{fontSize:17,fontWeight:800,color:"#10b981"}}>{c.d.closed}</div><div style={{fontSize:10,color:"#6b7280"}}>Closed</div></div></div>
              <PctBar v={(c.d.closed/(c.d.open+c.d.closed))*100} color={c.color}/>
            </div>
          ))}
        </div>
      </div>
      <div style={{...cs,gridColumn:"1/-1"}}>
        <div style={hs}>By Discipline</div>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={PUNCH.byDisc} layout="vertical" margin={{top:0,right:30,left:60,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" horizontal={false}/>
            <XAxis type="number" tick={{fill:"#6b7280",fontSize:10}} axisLine={false} tickLine={false}/>
            <YAxis type="category" dataKey="d" tick={{fill:"#8b949e",fontSize:11}} axisLine={false} tickLine={false} width={70}/>
            <Tooltip content={<ChartTip/>}/>
            <Bar dataKey="open" fill="#ef4444" name="Open" radius={[0,3,3,0]} stackId="a"/>
            <Bar dataKey="closed" fill="#10b981" name="Closed" radius={[0,3,3,0]} stackId="a"/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─── CARD GENERATOR ────────────────────────────────────────────── */
function CardGeneratorView() {
  const [equipData,setEquipData]=useState(EQUIP_BASE);
  const [selType,setSelType]=useState("Heat Exchangers");
  const [view,setView]=useState("tag");
  const [filters,setFilters]=useState({unit:"All",area:"All",contr:"All",prio:"All"});
  const [editModal,setEditModal]=useState(false);
  const [newAct,setNewAct]=useState("");
  const [templates,setTemplates]=useState([]);
  const [tplName,setTplName]=useState("");
  const cfg=equipData[selType];
  const filtered=cfg.tags.filter(t=>(filters.unit==="All"||t.unit===filters.unit)&&(filters.area==="All"||t.area===filters.area)&&(filters.contr==="All"||t.contr===filters.contr)&&(filters.prio==="All"||t.prio===filters.prio));
  const rows=view==="atrisk"?filtered.filter(t=>Object.values(t.acts).some(a=>a.s==="overdue")):filtered;
  const tagOverall=t=>{const v=Object.values(t.acts);return Math.round(v.reduce((s,a)=>s+a.p,0)/v.length);};
  const addAct=()=>{if(!newAct.trim())return;setEquipData(d=>({...d,[selType]:{...d[selType],acts:[...d[selType].acts,newAct.trim()]}}));setNewAct("");};
  const removeAct=act=>setEquipData(d=>({...d,[selType]:{...d[selType],acts:d[selType].acts.filter(a=>a!==act)}}));
  const saveTemplate=()=>{if(!tplName.trim())return;setTemplates(t=>[...t,{name:tplName,type:selType,view,filters}]);setTplName("");};
  const summaryByUnit=()=>{const g={};filtered.forEach(t=>{g[t.unit]=g[t.unit]||[];g[t.unit].push(t);});return Object.entries(g).map(([unit,tags])=>{const all=tags.flatMap(t=>Object.values(t.acts));return{unit,total:tags.length,complete:all.filter(a=>a.s==="complete").length,inprog:all.filter(a=>a.s==="in-progress").length,overdue:all.filter(a=>a.s==="overdue").length,pct:Math.round(all.filter(a=>a.s==="complete").length/all.length*100)};});};
  const actSummary=()=>cfg.acts.map(act=>{const all=filtered.map(t=>t.acts[act]).filter(Boolean);return{act,complete:all.filter(a=>a.s==="complete").length,inprog:all.filter(a=>a.s==="in-progress").length,overdue:all.filter(a=>a.s==="overdue").length,notstarted:all.filter(a=>a.s==="not-started").length,pct:all.length?Math.round(all.filter(a=>a.s==="complete").length/all.length*100):0};});
  const contrSummary=()=>{const g={};filtered.forEach(t=>{g[t.contr]=g[t.contr]||[];g[t.contr].push(t);});return Object.entries(g).map(([contr,tags])=>{const all=tags.flatMap(t=>Object.values(t.acts));return{contr,total:tags.length,complete:all.filter(a=>a.s==="complete").length,inprog:all.filter(a=>a.s==="in-progress").length,overdue:all.filter(a=>a.s==="overdue").length,pct:Math.round(all.filter(a=>a.s==="complete").length/all.length*100)};});};
  function SummaryRows({data,kf,kc}) {
    return(<>{data.map((row,i)=>(<tr key={i} style={{background:i%2===0?"transparent":"#1c220808"}}><TD><span style={{fontWeight:700,color:kc||"#f59e0b"}}>{row[kf]}</span></TD><TD c><span style={{color:"#e6edf3",fontWeight:700}}>{row.total}</span></TD><TD c><span style={{color:"#10b981",fontWeight:700}}>{row.complete}</span></TD><TD c><span style={{color:"#3b82f6",fontWeight:700}}>{row.inprog}</span></TD><TD c><span style={{color:"#ef4444",fontWeight:700}}>{row.overdue}</span></TD><TD c><MiniBar v={row.pct}/><span style={{fontWeight:700,color:row.pct>70?"#10b981":row.pct>40?"#f59e0b":"#ef4444",fontSize:12}}>{row.pct}%</span></TD></tr>))}</>);
  }
  return (
    <div style={{display:"flex",gap:14}}>
      <div style={{width:185,flexShrink:0,display:"flex",flexDirection:"column",gap:10}}>
        <div style={{...cs,padding:12}}>
          <div style={{...hs,marginBottom:8}}>Equipment Type</div>
          {Object.keys(EQUIP_CFG).map(type=><button key={type} onClick={()=>setSelType(type)} style={{width:"100%",textAlign:"left",padding:"6px 9px",borderRadius:6,marginBottom:2,border:"none",cursor:"pointer",background:selType===type?"#f59e0b22":"transparent",color:selType===type?"#f59e0b":"#8b949e",fontSize:11,borderLeft:selType===type?"3px solid #f59e0b":"3px solid transparent"}}>{type}<span style={{float:"right",fontSize:10,color:"#4b5563"}}>{EQUIP_CFG[type].n}</span></button>)}
        </div>
        {templates.length>0&&<div style={{...cs,padding:12}}><div style={{...hs,marginBottom:6}}>Saved Templates</div>{templates.map((t,i)=><button key={i} onClick={()=>{setSelType(t.type);setView(t.view);setFilters(t.filters);}} style={{width:"100%",textAlign:"left",padding:"5px 8px",borderRadius:5,marginBottom:3,border:"1px solid #30363d",cursor:"pointer",background:"#1c2230",color:"#8b949e",fontSize:10}}>📋 {t.name}</button>)}</div>}
      </div>
      <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:10}}>
        <div style={{...cs,padding:10,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{display:"flex",gap:2,background:"#0d1117",borderRadius:7,padding:2}}>{[{id:"tag",label:"Tag-wise"},{id:"summary",label:"Unit Summary"},{id:"activity",label:"Activity"},{id:"contractor",label:"Contractor"},{id:"atrisk",label:"⚠️ At-Risk"}].map(v=><button key={v.id} onClick={()=>setView(v.id)} style={{padding:"4px 10px",borderRadius:5,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,background:view===v.id?"#f59e0b":"transparent",color:view===v.id?"#0d1117":"#6b7280",whiteSpace:"nowrap"}}>{v.label}</button>)}</div>
          <div style={{flex:1}}/>
          {[{key:"unit",opts:["All",...UNIT_LIST]},{key:"area",opts:["All",...AREA_LIST]},{key:"contr",opts:["All",...CONTR_LIST]},{key:"prio",opts:["All","Critical","High","Medium","Low"]}].map(f=><select key={f.key} value={filters[f.key]} onChange={e=>setFilters(p=>({...p,[f.key]:e.target.value}))} style={{background:"#1c2230",border:"1px solid #30363d",borderRadius:6,color:"#8b949e",padding:"4px 7px",fontSize:11,cursor:"pointer"}}>{f.opts.map(o=><option key={o}>{o}</option>)}</select>)}
          <button onClick={()=>setEditModal(true)} style={{padding:"4px 10px",background:"#1c2230",border:"1px solid #30363d",borderRadius:6,color:"#8b949e",fontSize:11,cursor:"pointer",whiteSpace:"nowrap"}}>✏️ Columns</button>
        </div>
        <div style={{...cs,overflow:"auto",padding:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div><span style={{fontSize:13,fontWeight:700,color:"#f59e0b"}}>{selType}</span><span style={{fontSize:11,color:"#6b7280",marginLeft:8}}>{rows.length} tags • {cfg.acts.length} activities{view==="atrisk"&&<span style={{color:"#ef4444",marginLeft:6}}>⚠️ Overdue only</span>}</span></div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}><input value={tplName} onChange={e=>setTplName(e.target.value)} placeholder="Template name..." style={{background:"#1c2230",border:"1px solid #30363d",borderRadius:6,color:"#e6edf3",padding:"4px 9px",fontSize:11,outline:"none",width:130}}/><button onClick={saveTemplate} style={{padding:"4px 10px",background:"#f59e0b",border:"none",borderRadius:6,color:"#0d1117",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>💾 Save</button></div>
          </div>
          {(view==="tag"||view==="atrisk")&&(<div style={{overflowX:"auto"}}><table style={{borderCollapse:"collapse",fontSize:11,minWidth:"max-content"}}><thead><tr>{["Tag","Unit","Sys","Contractor","Prio","Overall",...cfg.acts].map(h=><TH key={h} c={h!=="Tag"&&h!=="Contractor"&&h!=="Sys"}>{h}</TH>)}</tr></thead><tbody>{rows.length===0&&<tr><td colSpan={6+cfg.acts.length} style={{padding:20,textAlign:"center",color:"#6b7280"}}>No tags match filters.</td></tr>}{rows.map((tag,i)=>{const ov=tagOverall(tag);return(<tr key={tag.id} style={{background:i%2===0?"transparent":"#1c220808"}}><TD><span style={{color:"#3b82f6",fontWeight:700}}>{tag.id}</span></TD><TD c><span style={{background:"#f59e0b22",color:"#f59e0b",padding:"2px 5px",borderRadius:3,fontSize:10,fontWeight:600}}>{tag.unit}</span></TD><TD c s={{color:"#6b7280"}}>{tag.sys}</TD><TD s={{color:"#8b949e",whiteSpace:"nowrap"}}>{tag.contr}</TD><TD c><span style={{background:prioColor(tag.prio)+"22",color:prioColor(tag.prio),padding:"2px 5px",borderRadius:3,fontSize:10,fontWeight:600}}>{tag.prio}</span></TD><TD c><span style={{fontSize:12,fontWeight:800,color:ov===100?"#10b981":ov>50?"#f59e0b":"#ef4444"}}>{ov}%</span></TD>{cfg.acts.map(act=>{const a=tag.acts[act]||{s:"not-started",p:0};const{icon,bg,color}=cellStyle(a.s);return(<td key={act} style={{padding:"4px 7px",border:"1px solid #21262d",textAlign:"center",background:bg,minWidth:70}}><div style={{fontSize:12,lineHeight:1.1}}>{icon}</div>{a.s==="in-progress"&&<div style={{fontSize:9,color,fontWeight:700}}>{a.p}%</div>}{a.s==="overdue"&&<div style={{fontSize:9,color,fontWeight:700}}>OVRD</div>}</td>);})}</tr>);})}</tbody></table></div>)}
          {view==="summary"&&<table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Unit","Total Tags","✅ Complete","🔄 In Progress","🔴 Overdue","Overall %"].map(h=><TH key={h} c={h!=="Unit"}>{h}</TH>)}</tr></thead><tbody><SummaryRows data={summaryByUnit()} kf="unit"/></tbody></table>}
          {view==="activity"&&<table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Activity","✅ Complete","🔄 In Progress","🔴 Overdue","⬜ Not Started","Completion %"].map(h=><TH key={h} c={h!=="Activity"}>{h}</TH>)}</tr></thead><tbody>{actSummary().map((row,i)=><tr key={i} style={{background:i%2===0?"transparent":"#1c220808"}}><TD><span style={{fontWeight:600,color:"#e6edf3"}}>{row.act}</span></TD><TD c><span style={{color:"#10b981",fontWeight:700}}>{row.complete}</span></TD><TD c><span style={{color:"#3b82f6",fontWeight:700}}>{row.inprog}</span></TD><TD c><span style={{color:"#ef4444",fontWeight:700}}>{row.overdue}</span></TD><TD c><span style={{color:"#6b7280",fontWeight:700}}>{row.notstarted}</span></TD><TD c><MiniBar v={row.pct}/><span style={{fontWeight:700,color:row.pct>70?"#10b981":row.pct>40?"#f59e0b":"#ef4444"}}>{row.pct}%</span></TD></tr>)}</tbody></table>}
          {view==="contractor"&&<table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Contractor","Tags","✅ Complete","🔄 In Progress","🔴 Overdue","Overall %"].map(h=><TH key={h} c={h!=="Contractor"}>{h}</TH>)}</tr></thead><tbody><SummaryRows data={contrSummary()} kf="contr" kc="#3b82f6"/></tbody></table>}
        </div>
        <div style={{display:"flex",gap:14,fontSize:11,color:"#6b7280",paddingLeft:2}}>{[["✅","Complete","#10b981"],["🔄","In Progress","#3b82f6"],["🔴","Overdue","#ef4444"],["⬜","Not Started","#6b7280"]].map(([icon,label,color])=><span key={label}>{icon} <span style={{color}}>{label}</span></span>)}</div>
      </div>
      {editModal&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}><div style={{background:"#161b22",border:"1px solid #30363d",borderRadius:12,padding:22,width:400,maxHeight:"80vh",overflowY:"auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><div><div style={{fontSize:13,fontWeight:700,color:"#f59e0b"}}>✏️ Edit Activity Columns</div><div style={{fontSize:11,color:"#6b7280",marginTop:1}}>{selType}</div></div><button onClick={()=>setEditModal(false)} style={{background:"none",border:"none",color:"#6b7280",fontSize:20,cursor:"pointer",lineHeight:1}}>×</button></div>{cfg.acts.map((act,i)=><div key={act} style={{display:"flex",alignItems:"center",gap:7,padding:"6px 9px",background:"#1c2230",borderRadius:6,marginBottom:5,border:"1px solid #30363d"}}><span style={{color:"#4b5563",fontSize:12}}>⠿</span><span style={{flex:1,fontSize:12,color:"#e6edf3"}}><span style={{color:"#4b5563",marginRight:5}}>{i+1}.</span>{act}</span><button onClick={()=>removeAct(act)} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:16,lineHeight:1}}>×</button></div>)}<div style={{display:"flex",gap:7,marginTop:12}}><input value={newAct} onChange={e=>setNewAct(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addAct()} placeholder="Add activity..." style={{flex:1,background:"#0d1117",border:"1px solid #30363d",borderRadius:6,color:"#e6edf3",padding:"7px 9px",fontSize:12,outline:"none"}}/><button onClick={addAct} style={{padding:"7px 13px",background:"#f59e0b",border:"none",borderRadius:6,color:"#0d1117",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add</button></div><button onClick={()=>setEditModal(false)} style={{width:"100%",marginTop:12,padding:"8px",background:"#1c2230",border:"1px solid #30363d",borderRadius:8,color:"#e6edf3",fontSize:13,fontWeight:600,cursor:"pointer"}}>✓ Done</button></div></div>}
    </div>
  );
}

/* ─── REPORT BUILDER (Phase 3 — preserved) ──────────────────────── */
function ReportBuilderView({addNotif}) {
  const [pages,setPages]=useState([{id:1,name:"Page 1",cards:[]},{id:2,name:"Page 2",cards:[]},{id:3,name:"Page 3",cards:[]}]);
  const [activePage,setActivePage]=useState(0);
  const [dragCard,setDragCard]=useState(null);
  const [dragOver,setDragOver]=useState(null);
  const [previewOpen,setPreviewOpen]=useState(false);
  const [coverText,setCoverText]=useState("");
  const [coverLoading,setCoverLoading]=useState(false);
  const [tplName,setTplName]=useState("");
  const [catOpen,setCatOpen]=useState({});
  const [savedTemplates,setSavedTemplates]=useState([{name:"Morning Briefing",pages:[{id:1,name:"Cover",cards:["ai_cover","shift","safety"]},{id:2,name:"Progress",cards:["scurve","unitprog","milestone"]},{id:3,name:"Operations",cards:["lookahead","constraints","punch"]}]},{name:"Management Summary",pages:[{id:1,name:"Summary",cards:["ai_cover","scurve","unitprog"]},{id:2,name:"Details",cards:["milestone","safety","punch"]},{id:3,name:"",cards:[]}]}]);
  const toggleCat=cat=>setCatOpen(o=>({...o,[cat]:!o[cat]}));
  const pageCards=pages[activePage]?.cards||[];
  const totalCards=pages.reduce((s,p)=>s+p.cards.length,0);
  const cardDef=id=>RCARD_DEFS.find(c=>c.id===id)||{id,label:id,icon:"📄",cat:"",desc:""};
  const onLibDragStart=(e,cardId)=>{setDragCard({src:"lib",cardId});e.dataTransfer.effectAllowed="copy";};
  const onPageDragStart=(e,idx)=>{setDragCard({src:"page",cardIdx:idx});e.dataTransfer.effectAllowed="move";};
  const onDropZone=(e,pageIdx,insertIdx)=>{e.preventDefault();setDragOver(null);if(!dragCard)return;setPages(prev=>{const next=prev.map(p=>({...p,cards:[...p.cards]}));if(dragCard.src==="lib"){next[pageIdx].cards.splice(insertIdx,0,dragCard.cardId);}else{const card=next[pageIdx].cards.splice(dragCard.cardIdx,1)[0];const toIdx=insertIdx>dragCard.cardIdx?insertIdx-1:insertIdx;next[pageIdx].cards.splice(toIdx,0,card);}return next;});setDragCard(null);};
  const onDropPage=(e,pageIdx)=>{e.preventDefault();setDragOver(null);if(!dragCard||dragCard.src!=="lib")return;setPages(prev=>{const n=prev.map(p=>({...p,cards:[...p.cards]}));n[pageIdx].cards.push(dragCard.cardId);return n;});setDragCard(null);};
  const removeCard=(pi,ci)=>setPages(p=>p.map((pg,i)=>i===pi?{...pg,cards:pg.cards.filter((_,j)=>j!==ci)}:pg));
  const addPage=()=>{const id=Date.now();setPages(p=>[...p,{id,name:`Page ${p.length+1}`,cards:[]}]);setActivePage(pages.length);};
  const removePage=idx=>{if(pages.length<=1)return;const n=[...pages];n.splice(idx,1);setPages(n);setActivePage(Math.max(0,idx-1));};
  const renamePage=(idx,val)=>setPages(p=>p.map((pg,i)=>i===idx?{...pg,name:val}:pg));
  const clearPage=idx=>setPages(p=>p.map((pg,i)=>i===idx?{...pg,cards:[]}:pg));
  const loadTemplate=tpl=>{setPages(tpl.pages.map(p=>({...p,cards:[...p.cards]})));setActivePage(0);};
  const saveTemplate=()=>{if(!tplName.trim())return;setSavedTemplates(t=>[...t,{name:tplName,pages:pages.map(p=>({...p,cards:[...p.cards]}))}]);setTplName("");};
  const genCover=async()=>{setCoverLoading(true);setCoverText("");try{
    const r = await fetch(`/api/projects/demo/ai-assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `${AI_CTX}\n\nWrite a professional executive report cover narrative (3–4 paragraphs) for CDU-3 TA 2026 as of 10-Mar-2026. Include overall status, key achievements, risks, and recommended actions. Formal, concise, TA industry appropriate.`,
        chatHistory: [],
      })
    });
    
    if (!r.ok || !r.body) throw new Error("API error");
      
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          if (parsed.text) text += parsed.text;
        } catch {}
      }
    }
    setCoverText(text);
    addNotif("success","AI Cover Generated","Executive narrative ready for the report cover page.");
  }catch{setCoverText("⚠️ Could not generate cover text.");}setCoverLoading(false);};

  function PreviewCard({cardId}) {
    const def=cardDef(cardId);
    return (
      <div style={{background:"#f8f9fa",border:"1px solid #dee2e6",borderRadius:6,padding:"10px 12px",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}><span style={{fontSize:16}}>{def.icon}</span><span style={{fontSize:12,fontWeight:700,color:"#1a1a2e"}}>{def.label}</span><span style={{fontSize:10,color:"#6c757d",marginLeft:"auto"}}>{def.cat}</span></div>
        {cardId==="ai_cover"&&(coverText?<div style={{fontSize:10,color:"#495057",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{coverText}</div>:<div style={{fontSize:10,color:"#adb5bd",fontStyle:"italic"}}>Click "Generate AI Cover" first</div>)}
        {cardId==="shift"&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>{[["Crew",SHIFT.crew,"#1a1a2e"],["Done",SHIFT.completed,"#198754"],["Def.",SHIFT.deferred,"#dc3545"]].map(([l,v,c])=><div key={l} style={{background:"#e9ecef",borderRadius:4,padding:"5px",textAlign:"center"}}><div style={{fontSize:14,fontWeight:800,color:c}}>{v}</div><div style={{fontSize:9,color:"#6c757d"}}>{l}</div></div>)}</div>}
        {cardId==="scurve"&&<ResponsiveContainer width="100%" height={55}><AreaChart data={S_CURVE} margin={{top:2,right:2,left:-40,bottom:0}}><Area type="monotone" dataKey="p" stroke="#0d6efd" fill="#0d6efd22" strokeWidth={1.5} dot={false} connectNulls/><Area type="monotone" dataKey="a" stroke="#198754" fill="#19875422" strokeWidth={1.5} dot={false} connectNulls/></AreaChart></ResponsiveContainer>}
        {cardId==="safety"&&<div style={{fontSize:11,color:"#198754",fontWeight:700}}>✅ 0 LTI — {SAFETY.manhrsLTI.toLocaleString()} manhours LTI-free</div>}
        {cardId==="milestone"&&<div>{MILESTONES.slice(0,4).map((m,i)=><div key={i} style={{display:"flex",gap:5,fontSize:10,color:"#495057",padding:"2px 0",borderBottom:"1px solid #dee2e6"}}><span>{statusBadge(m.status).icon}</span><span style={{flex:1}}>{m.name}</span><span style={{color:"#6c757d"}}>{m.planned}</span></div>)}</div>}
        {cardId==="unitprog"&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4}}>{UNITS.map(u=>{const d=u.a-u.p;return<div key={u.u} style={{background:"#e9ecef",borderRadius:4,padding:"4px 6px",textAlign:"center"}}><div style={{fontSize:11,fontWeight:800,color:"#1a1a2e"}}>{u.a}%</div><div style={{fontSize:9,color:"#6c757d"}}>{u.u}</div><div style={{fontSize:9,color:d>=0?"#198754":"#dc3545",fontWeight:700}}>{d>0?"+":""}{d}%</div></div>})}</div>}
        {cardId==="punch"&&<div style={{fontSize:10,color:"#495057"}}>Open: <b style={{color:"#dc3545"}}>{PUNCH.open}</b> | Closed: <b style={{color:"#198754"}}>{PUNCH.closed}</b> | Cat-A: <b style={{color:"#dc3545"}}>{PUNCH.catA.open}</b></div>}
        {cardId==="constraints"&&<div>{CONSTRAINTS.slice(0,3).map((c,i)=><div key={i} style={{fontSize:9,color:"#495057",padding:"2px 0",borderBottom:"1px solid #dee2e6"}}><span style={{color:impactColor(c.impact),fontWeight:700}}>[{c.impact}]</span> {c.desc}</div>)}</div>}
        {cardId==="lookahead"&&<div>{LOOKAHEAD.slice(0,3).map((a,i)=><div key={i} style={{fontSize:9,color:"#495057",padding:"2px 0",borderBottom:"1px solid #dee2e6"}}>{a.id} — {a.desc} ({a.priority})</div>)}</div>}
        {(cardId==="ai_jobs"||cardId.startsWith("eq_"))&&<div style={{fontSize:10,color:"#6c757d",fontStyle:"italic"}}>{cardId==="ai_jobs"?"AI-generated critical job list":cardId.replace("eq_","")+" tag-wise table"}</div>}
      </div>
    );
  }

  return (
    <div style={{display:"flex",gap:14,height:"calc(100vh - 120px)",minHeight:0}}>
      <div style={{width:210,flexShrink:0,overflowY:"auto",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{...cs,padding:12}}>
          <div style={{...hs,marginBottom:8}}>📚 Card Library</div>
          <div style={{fontSize:10,color:"#6b7280",marginBottom:10}}>Click ▶ to expand, then drag cards →</div>
          {RCARD_CATS.map(cat=>(
            <div key={cat} style={{marginBottom:6}}>
              <button onClick={()=>toggleCat(cat)} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 8px",borderRadius:6,border:"none",cursor:"pointer",background:"#1c2230",color:"#8b949e",fontSize:11,fontWeight:600,textAlign:"left"}}>
                <span>{cat}</span><span style={{fontSize:10}}>{catOpen[cat]?"▼":"▶"}</span>
              </button>
              {catOpen[cat]&&RCARD_DEFS.filter(c=>c.cat===cat).map(card=>(
                <div key={card.id} draggable onDragStart={e=>onLibDragStart(e,card.id)}
                  style={{display:"flex",alignItems:"center",gap:7,padding:"6px 8px",margin:"3px 0 3px 6px",borderRadius:6,background:"#0d1117",border:"1px solid #30363d",cursor:"grab"}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="#f59e0b"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor="#30363d"}>
                  <span style={{fontSize:13,flexShrink:0}}>{card.icon}</span>
                  <div style={{minWidth:0}}><div style={{fontSize:11,fontWeight:600,color:"#e6edf3",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{card.label}</div><div style={{fontSize:9,color:"#6b7280"}}>{card.desc}</div></div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{...cs,padding:12}}>
          <div style={{...hs,marginBottom:8}}>📁 Templates</div>
          {savedTemplates.map((t,i)=><button key={i} onClick={()=>loadTemplate(t)} style={{width:"100%",textAlign:"left",padding:"6px 8px",borderRadius:6,marginBottom:4,border:"1px solid #30363d",cursor:"pointer",background:"#1c2230",color:"#8b949e",fontSize:11,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span>📋 {t.name}</span><span style={{fontSize:9,color:"#4b5563"}}>{t.pages.reduce((s,p)=>s+p.cards.length,0)} cards</span></button>)}
          <div style={{display:"flex",gap:5,marginTop:6}}>
            <input value={tplName} onChange={e=>setTplName(e.target.value)} placeholder="New template name..." style={{flex:1,background:"#0d1117",border:"1px solid #30363d",borderRadius:5,color:"#e6edf3",padding:"5px 7px",fontSize:10,outline:"none"}}/>
            <button onClick={saveTemplate} style={{padding:"5px 8px",background:"#f59e0b",border:"none",borderRadius:5,color:"#0d1117",fontSize:11,fontWeight:700,cursor:"pointer"}}>💾</button>
          </div>
        </div>
      </div>
      <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:10}}>
        <div style={{...cs,padding:10,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#f59e0b"}}>📄 Report Builder</div>
          <div style={{fontSize:11,color:"#6b7280"}}>{totalCards} cards • {pages.length} pages</div>
          <div style={{flex:1}}/>
          <button onClick={genCover} disabled={coverLoading} style={{padding:"5px 12px",background:coverLoading?"#1c2230":"linear-gradient(135deg,#f59e0b,#d97706)",border:"none",borderRadius:7,color:coverLoading?"#6b7280":"#0d1117",fontSize:11,fontWeight:700,cursor:coverLoading?"default":"pointer",whiteSpace:"nowrap"}}>{coverLoading?"⏳ Generating...":"🤖 AI Cover"}</button>
          <button onClick={()=>totalCards>0&&setPreviewOpen(true)} disabled={totalCards===0} style={{padding:"5px 14px",background:totalCards===0?"#1c2230":"#10b981",border:"none",borderRadius:7,color:totalCards===0?"#4b5563":"#fff",fontSize:11,fontWeight:700,cursor:totalCards===0?"default":"pointer",whiteSpace:"nowrap"}}>👁️ Preview PDF</button>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
          {pages.map((pg,idx)=>(
            <div key={pg.id} onClick={()=>setActivePage(idx)} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:8,border:`2px solid ${activePage===idx?"#f59e0b":"#30363d"}`,background:activePage===idx?"#1c2230":"transparent",cursor:"pointer"}}>
              <input value={pg.name} onChange={e=>renamePage(idx,e.target.value)} onClick={e=>e.stopPropagation()} style={{background:"none",border:"none",color:activePage===idx?"#f59e0b":"#8b949e",fontSize:12,fontWeight:600,cursor:"text",width:60,outline:"none"}}/>
              <span style={{fontSize:10,color:"#4b5563",background:"#0d1117",borderRadius:4,padding:"1px 5px"}}>{pg.cards.length}</span>
              {pages.length>1&&<button onClick={e=>{e.stopPropagation();removePage(idx);}} style={{background:"none",border:"none",color:"#ef444488",cursor:"pointer",fontSize:13,lineHeight:1,padding:0}}>×</button>}
            </div>
          ))}
          <button onClick={addPage} style={{padding:"5px 10px",background:"#1c2230",border:"1px dashed #30363d",borderRadius:8,color:"#6b7280",fontSize:11,cursor:"pointer"}}>+ Add Page</button>
        </div>
        <div style={{flex:1,background:"#0d1117",border:`2px dashed ${dragCard?"#f59e0b55":"#21262d"}`,borderRadius:12,padding:14,overflowY:"auto",minHeight:300}}
          onDragOver={e=>e.preventDefault()} onDrop={e=>onDropPage(e,activePage)}>
          {pageCards.length===0?(
            <div style={{textAlign:"center",padding:"40px 20px",color:"#4b5563"}}>
              <div style={{fontSize:36,marginBottom:10}}>📋</div>
              <div style={{fontSize:13,fontWeight:600,color:"#6b7280",marginBottom:4}}>Drop cards here</div>
              <div style={{fontSize:11}}>Expand a category in the library (▶) and drag cards onto this page</div>
            </div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div style={{gridColumn:"1/-1",height:8,borderRadius:4,background:dragOver?.pageIdx===activePage&&dragOver?.cardIdx===0?"#f59e0b44":"transparent"}} onDragOver={e=>{e.preventDefault();setDragOver({pageIdx:activePage,cardIdx:0});}} onDrop={e=>onDropZone(e,activePage,0)}/>
              {pageCards.map((cardId,idx)=>{
                const def=cardDef(cardId);
                return (
                  <div key={`${cardId}-${idx}`}>
                    <div draggable onDragStart={e=>onPageDragStart(e,idx)} style={{background:"#161b22",border:"1px solid #30363d",borderRadius:8,padding:"10px 12px",cursor:"grab"}} onMouseEnter={e=>e.currentTarget.style.borderColor="#f59e0b88"} onMouseLeave={e=>e.currentTarget.style.borderColor="#30363d"}>
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}><span style={{fontSize:16}}>{def.icon}</span><div style={{flex:1}}><div style={{fontSize:12,fontWeight:700,color:"#e6edf3"}}>{def.label}</div><div style={{fontSize:10,color:"#6b7280"}}>{def.cat}</div></div><div style={{display:"flex",gap:4,alignItems:"center"}}><span style={{fontSize:10,color:"#4b5563"}}>⠿</span><button onClick={()=>removeCard(activePage,idx)} style={{background:"#ef444422",border:"1px solid #ef444433",borderRadius:5,color:"#ef4444",cursor:"pointer",fontSize:12,lineHeight:1,padding:"2px 5px"}}>×</button></div></div>
                      <div style={{fontSize:10,color:"#4b5563"}}>{def.desc}</div>
                      {cardId==="ai_cover"&&coverText&&<div style={{marginTop:5,padding:"4px 7px",background:"#10b98111",borderRadius:5,border:"1px solid #10b98122",fontSize:10,color:"#10b981"}}>✅ AI cover ready</div>}
                    </div>
                    <div style={{height:6,borderRadius:4,margin:"4px 0",background:dragOver?.pageIdx===activePage&&dragOver?.cardIdx===idx+1?"#f59e0b44":"transparent"}} onDragOver={e=>{e.preventDefault();setDragOver({pageIdx:activePage,cardIdx:idx+1});}} onDrop={e=>onDropZone(e,activePage,idx+1)}/>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={()=>clearPage(activePage)} style={{padding:"5px 12px",background:"#1c2230",border:"1px solid #ef444433",borderRadius:7,color:"#ef4444",fontSize:11,cursor:"pointer"}}>🗑️ Clear Page</button>
        </div>
      </div>
      {previewOpen&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:2000,overflowY:"auto",padding:"20px 0"}}>
          <div style={{width:"90%",maxWidth:800}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,padding:"0 4px"}}>
              <div><div style={{fontSize:16,fontWeight:800,color:"#f59e0b"}}>📄 PDF Preview</div><div style={{fontSize:11,color:"#6b7280"}}>{pages.filter(p=>p.cards.length>0).length} pages • {totalCards} cards</div></div>
              <div style={{display:"flex",gap:8}}><button onClick={()=>window.print()} style={{padding:"6px 14px",background:"#1c2230",border:"1px solid #30363d",borderRadius:8,color:"#8b949e",fontSize:12,cursor:"pointer"}}>🖨️ Print</button><button onClick={()=>setPreviewOpen(false)} style={{padding:"6px 14px",background:"#ef4444",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>✕ Close</button></div>
            </div>
            {pages.filter(p=>p.cards.length>0).map((pg,pgIdx)=>(
              <div key={pg.id} style={{background:"#fff",borderRadius:8,padding:"28px 32px",marginBottom:20,boxShadow:"0 4px 24px rgba(0,0,0,0.5)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingBottom:12,marginBottom:16,borderBottom:"3px solid #f59e0b"}}>
                  <div><div style={{fontSize:18,fontWeight:900,color:"#1a1a2e"}}>⚙️ RELTA</div><div style={{fontSize:11,color:"#6c757d"}}>TA Intelligence Platform</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:14,fontWeight:700,color:"#1a1a2e"}}>{PROJECT.name}</div><div style={{fontSize:11,color:"#6c757d"}}>10-Mar-2026 | SPI: {PROJECT.spi} | Progress: {PROJECT.overallActual}%</div></div>
                </div>
                <div style={{textAlign:"center",marginBottom:14}}><div style={{fontSize:14,fontWeight:800,color:"#495057",textTransform:"uppercase",letterSpacing:1}}>{pg.name||`Page ${pgIdx+1}`}</div></div>
                <div style={{display:"grid",gridTemplateColumns:pg.cards.length===1?"1fr":"1fr 1fr",gap:12}}>{pg.cards.map((cardId,ci)=><PreviewCard key={ci} cardId={cardId}/>)}</div>
                <div style={{marginTop:16,paddingTop:10,borderTop:"1px solid #dee2e6",display:"flex",justifyContent:"space-between",fontSize:9,color:"#adb5bd"}}><span>CONFIDENTIAL — {PROJECT.name}</span><span>Generated: 10-Mar-2026 | RELTA AI</span><span>Page {pgIdx+1} of {pages.filter(p=>p.cards.length>0).length}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
