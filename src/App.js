import { useState, useEffect, useRef } from "react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// ─── CONFIGURAÇÕES REAIS ──────────────────────────────────────────────────────
const SUPABASE_URL = "https://bvyahupcsejxcwjnnjim.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2eWFodXBjc2VqeGN3am5uamltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwODEzMDcsImV4cCI6MjA4NjY1NzMwN30.GqeY0Bb3h6qanxthhq90TgdABbPPZjZ2ySsDIsCHEPE";
const EVO_URL     = "https://korvax-apps-evolution-api.obeisx.easypanel.host";
const EVO_KEY     = "E33F4A79FB80-4AF1-BC04-CD6039771DA6";
const EVO_INST    = "salon";

// ─── SUPABASE HELPER ──────────────────────────────────────────────────────────
async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...opts.headers,
    },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function getClients() {
  return sbFetch("dados_cliente?select=*&order=created_at.desc");
}

async function getChatHistory(telefone) {
  const data = await sbFetch(`n8n_chat_histories?session_id=eq.${encodeURIComponent(telefone)}&order=id.asc&limit=100`);
  return (data || []).map(row => {
    try {
      const msg = typeof row.message === "string" ? JSON.parse(row.message) : row.message;
      return {
        type: msg.type === "human" ? "human" : "ai",
        content: msg.content || "",
        hora: new Date(row.created_at || Date.now()).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" }),
      };
    } catch { return null; }
  }).filter(Boolean);
}

async function updateClientIA(telefone, status) {
  return sbFetch(`dados_cliente?telefone=eq.${encodeURIComponent(telefone)}`, {
    method: "PATCH",
    body: JSON.stringify({ atendimento_ia: status }),
  });
}

async function updateClientSetor(telefone, setor) {
  return sbFetch(`dados_cliente?telefone=eq.${encodeURIComponent(telefone)}`, {
    method: "PATCH",
    body: JSON.stringify({ setor }),
  });
}

// ─── EVOLUTION HELPER ─────────────────────────────────────────────────────────
async function sendEvoMessage(telefone, texto) {
  const number = telefone.replace("@s.whatsapp.net", "");
  const res = await fetch(`${EVO_URL}/message/sendText/${EVO_INST}`, {
    method: "POST",
    headers: {
      "apikey": EVO_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ number, text: texto, delay: 1200 }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const SETOR_COLOR = { VENDAS: "#22c55e", SUPORTE: "#f59e0b", REUNIAO: "#3b82f6", REUNIÃO: "#3b82f6", "": "#6b7280" };
const SETOR_LABEL = { VENDAS: "Vendas", SUPORTE: "Suporte", REUNIAO: "Reunião", REUNIÃO: "Reunião", "": "Sem setor" };
const AV_COLORS   = ["#6366f1","#ec4899","#14b8a6","#f59e0b","#8b5cf6","#ef4444","#10b981","#3b82f6"];

const MSGS_DATA = [
  { hora:"08h", msgs:4 },{ hora:"09h", msgs:7 },{ hora:"10h", msgs:12 },
  { hora:"11h", msgs:9 },{ hora:"12h", msgs:5 },{ hora:"13h", msgs:14 },
  { hora:"14h", msgs:18 },{ hora:"15h", msgs:13 },{ hora:"16h", msgs:20 },
  { hora:"17h", msgs:22 },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmtPhone(t = "") {
  const n = t.replace("@s.whatsapp.net", "");
  if (n.length < 12) return n;
  return `+${n.slice(0,2)} (${n.slice(2,4)}) ${n.slice(4,9)}-${n.slice(9)}`;
}

function buildGrowthData(clients) {
  const map = {};
  clients.forEach(c => {
    const d = new Date(c.created_at);
    const key = d.toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit" });
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map).slice(-7).map(([dia, clientes]) => ({ dia, clientes }));
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
function Avatar({ name = "?", size = 38 }) {
  const idx = (name || "?").charCodeAt(0) % AV_COLORS.length;
  const initials = (name || "?").split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase();
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:AV_COLORS[idx], display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:size*.36, color:"#fff", flexShrink:0 }}>
      {initials}
    </div>
  );
}

function Badge({ setor = "", onClick }) {
  const c = SETOR_COLOR[setor] || "#6b7280";
  return (
    <span onClick={onClick} style={{ background:c+"22", color:c, border:`1px solid ${c}45`, borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:700, letterSpacing:.8, textTransform:"uppercase", cursor:onClick?"pointer":"default" }}>
      {SETOR_LABEL[setor] || "Sem setor"}
    </span>
  );
}

function IaDot({ active }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12, color:active?"#22c55e":"#f59e0b", fontWeight:600 }}>
      <span style={{ width:7, height:7, borderRadius:"50%", background:active?"#22c55e":"#f59e0b", boxShadow:`0 0 7px ${active?"#22c55e":"#f59e0b"}` }} />
      {active ? "IA Ativa" : "Pausada"}
    </span>
  );
}

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3200); return () => clearTimeout(t); }, []);
  const colors = { ok:"#22c55e", warn:"#f59e0b", info:"#6366f1", err:"#ef4444" };
  return (
    <div style={{ background:colors[type]||"#22c55e", color:"#fff", padding:"12px 20px", borderRadius:10, fontWeight:600, fontSize:13, boxShadow:`0 8px 30px ${colors[type]}55`, display:"flex", alignItems:"center", gap:8, animation:"slideUp .3s ease" }}>
      {msg}
    </div>
  );
}

function Spinner() {
  return <div style={{ width:20, height:20, border:"2px solid #6366f130", borderTop:"2px solid #6366f1", borderRadius:"50%", animation:"spin .7s linear infinite" }} />;
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin, dark }) {
  const [user, setUser] = useState(""); const [pass, setPass] = useState(""); const [err, setErr] = useState("");
  const handle = () => {
    if (user === "admin" && pass === "admin123") onLogin();
    else setErr("Usuário ou senha incorretos");
  };
  return (
    <div style={{ height:"100vh", background:dark?"#0a0c10":"#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ background:dark?"#13151c":"#fff", border:`1px solid ${dark?"#1e2130":"#e2e8f0"}`, borderRadius:20, padding:"40px 44px", width:380, boxShadow:"0 20px 60px rgba(0,0,0,.15)" }}>
        <div style={{ textAlign:"center", marginBottom:30 }}>
          <div style={{ width:52, height:52, borderRadius:14, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, margin:"0 auto 14px" }}>⚡</div>
          <div style={{ fontFamily:"Syne,sans-serif", fontWeight:800, fontSize:22, color:dark?"#f1f5f9":"#0f172a" }}>FlowDesk</div>
          <div style={{ fontSize:13, color:dark?"#64748b":"#94a3b8", marginTop:4 }}>Painel de Atendimento IA</div>
        </div>
        {[{label:"Usuário",val:user,set:setUser,type:"text"},{label:"Senha",val:pass,set:setPass,type:"password"}].map(f=>(
          <div key={f.label} style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, fontWeight:600, color:dark?"#94a3b8":"#64748b", display:"block", marginBottom:6 }}>{f.label}</label>
            <input value={f.val} onChange={e=>{f.set(e.target.value);setErr("");}} type={f.type} onKeyDown={e=>e.key==="Enter"&&handle()}
              style={{ width:"100%", background:dark?"#1a1d26":"#f8fafc", border:`1px solid ${dark?"#1e2130":"#e2e8f0"}`, borderRadius:10, padding:"11px 14px", color:dark?"#e2e8f0":"#0f172a", fontFamily:"'DM Sans',sans-serif", fontSize:14, outline:"none" }} />
          </div>
        ))}
        {err && <div style={{ color:"#ef4444", fontSize:12, marginBottom:10, textAlign:"center" }}>{err}</div>}
        <button onClick={handle} style={{ width:"100%", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff", border:"none", borderRadius:10, padding:13, fontFamily:"Syne,sans-serif", fontWeight:700, fontSize:15, cursor:"pointer", marginTop:4 }}>
          Entrar
        </button>
        <div style={{ textAlign:"center", fontSize:11, color:dark?"#374151":"#94a3b8", marginTop:14 }}>admin / admin123</div>
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [loggedIn, setLoggedIn]   = useState(false);
  const [dark, setDark]           = useState(true);
  const [tab, setTab]             = useState("overview");
  const [clients, setClients]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState(null);
  const [search, setSearch]       = useState("");
  const [filterSetor, setFilterSetor] = useState("TODOS");
  const [toasts, setToasts]       = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sectorModal, setSectorModal] = useState(null);
  const [msgInput, setMsgInput]   = useState("");
  const [sending, setSending]     = useState(false);
  const [evoStatus, setEvoStatus] = useState("checking");
  const [chatHistory, setChatHistory] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({behavior:"smooth"}); }, [chatHistory]);

  useEffect(() => {
    if (!selected) return;
    setChatHistory([]);
    setLoadingChat(true);
    getChatHistory(selected.telefone)
      .then(h => setChatHistory(h))
      .catch(() => setChatHistory([]))
      .finally(() => setLoadingChat(false));
  }, [selected?.telefone]);

  // Carrega clientes do Supabase
  async function loadClients() {
    setLoading(true);
    try {
      const data = await getClients();
      setClients(data || []);
    } catch(e) {
      toast("Erro ao carregar clientes: " + e.message, "err");
    } finally {
      setLoading(false);
    }
  }

  // Verifica Evolution
  async function checkEvolution() {
    try {
      const res = await fetch(`${EVO_URL}/instance/fetchInstances`, {
        headers: { "apikey": EVO_KEY }
      });
      setEvoStatus(res.ok ? "ok" : "err");
    } catch { setEvoStatus("err"); }
  }

  useEffect(() => {
    if (loggedIn) { loadClients(); checkEvolution(); }
  }, [loggedIn]);

  // Auto-refresh a cada 30s
  useEffect(() => {
    if (!loggedIn) return;
    const t = setInterval(loadClients, 30000);
    return () => clearInterval(t);
  }, [loggedIn]);

  function toast(msg, type="ok") {
    const id = Date.now();
    setToasts(p=>[...p,{id,msg,type}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)), 3200);
  }

  async function toggleIA(client, e) {
    e?.stopPropagation();
    const next = client.atendimento_ia === "pause" ? "reativada" : "pause";
    // Otimista
    setClients(prev => prev.map(c => c.id===client.id ? {...c, atendimento_ia:next} : c));
    if (selected?.id===client.id) setSelected(s=>({...s, atendimento_ia:next}));
    try {
      await updateClientIA(client.telefone, next);
      toast(next==="pause" ? `IA pausada — ${client.nomewpp}` : `IA reativada — ${client.nomewpp}`, next==="pause"?"warn":"ok");
    } catch(e) {
      // Reverte
      setClients(prev => prev.map(c => c.id===client.id ? {...c, atendimento_ia:client.atendimento_ia} : c));
      toast("Erro ao atualizar: " + e.message, "err");
    }
  }

  async function changeSetor(id, setor) {
    const client = clients.find(c=>c.id===id);
    setClients(prev=>prev.map(c=>c.id===id?{...c,setor}:c));
    if (selected?.id===id) setSelected(s=>({...s,setor}));
    try {
      await updateClientSetor(client.telefone, setor);
      toast(`Setor → ${SETOR_LABEL[setor]||"Sem setor"}`, "info");
    } catch(e) {
      setClients(prev=>prev.map(c=>c.id===id?{...c,setor:client.setor}:c));
      toast("Erro: " + e.message, "err");
    }
    setSectorModal(null);
  }

  async function sendMessage() {
    if (!msgInput.trim() || !selected || sending) return;
    setSending(true);
    try {
      await sendEvoMessage(selected.telefone, msgInput);
      toast("Mensagem enviada via WhatsApp!", "ok");
      setMsgInput("");
    } catch(e) {
      toast("Erro ao enviar: " + e.message, "err");
    } finally { setSending(false); }
  }

  const vars = dark
    ? { bg:"#0a0c10", card:"#13151c", border:"#1e2130", text:"#e2e8f0", muted:"#64748b", sub:"#374151", input:"#1a1d26" }
    : { bg:"#f1f5f9", card:"#ffffff", border:"#e2e8f0", text:"#0f172a", muted:"#64748b", sub:"#94a3b8", input:"#f8fafc" };

  const total    = clients.length;
  const ativos   = clients.filter(c=>c.atendimento_ia!=="pause").length;
  const pausados = clients.filter(c=>c.atendimento_ia==="pause").length;
  const pieData  = ["VENDAS","SUPORTE","REUNIAO",""].map(s=>({ name:SETOR_LABEL[s], value:clients.filter(c=>c.setor===s||(!c.setor&&s==="")).length, color:SETOR_COLOR[s] })).filter(d=>d.value>0);
  const growthData = buildGrowthData(clients);

  const filtered = clients.filter(c => {
    const s = search.toLowerCase();
    return (c.nomewpp?.toLowerCase().includes(s) || c.telefone?.includes(s)) &&
           (filterSetor==="TODOS" || c.setor===filterSetor);
  });

  const NAV = [
    {id:"overview",icon:"◈",label:"Visão Geral"},
    {id:"clientes",icon:"◎",label:"Clientes"},
    {id:"conversas",icon:"◉",label:"Conversas"},
    {id:"setores",icon:"▦",label:"Setores"},
  ];

  if (!loggedIn) return <Login onLogin={()=>setLoggedIn(true)} dark={dark} />;

  return (
    <div style={{ display:"flex", height:"100vh", background:"var(--bg)", color:"var(--text)", fontFamily:"'DM Sans',sans-serif", overflow:"hidden", ...Object.fromEntries(Object.entries(vars).map(([k,v])=>[`--${k}`,v])) }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:5px;} ::-webkit-scrollbar-track{background:transparent;} ::-webkit-scrollbar-thumb{background:var(--border);border-radius:10px;}
        .card{background:var(--card);border:1px solid var(--border);border-radius:14px;}
        .nav-item{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;cursor:pointer;font-size:14px;font-weight:500;color:var(--muted);transition:all .2s;margin-bottom:3px;white-space:nowrap;}
        .nav-item:hover{background:var(--border);color:var(--text);}
        .nav-item.active{background:linear-gradient(135deg,#6366f115,#8b5cf615);color:#a5b4fc;border:1px solid #6366f130;}
        .row{transition:background .15s;cursor:pointer;}
        .row:hover{background:var(--input) !important;}
        .inp{background:var(--input);border:1px solid var(--border);border-radius:9px;padding:10px 14px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;outline:none;transition:border .2s;}
        .inp:focus{border-color:#6366f1;} .inp::placeholder{color:var(--muted);}
        .btn{border:none;border-radius:8px;padding:9px 18px;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;font-size:13px;transition:all .2s;display:inline-flex;align-items:center;gap:6px;}
        .btn-p{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;} .btn-p:hover{opacity:.85;}
        .btn-d{background:#ef444420;color:#ef4444;border:1px solid #ef444440;} .btn-d:hover{background:#ef444430;}
        .btn-s{background:#22c55e20;color:#22c55e;border:1px solid #22c55e40;} .btn-s:hover{background:#22c55e30;}
        .btn-g{background:var(--border);color:var(--muted);border:1px solid var(--border);} .btn-g:hover{color:var(--text);}
        .chip{padding:5px 14px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;cursor:pointer;border:1px solid;transition:all .2s;}
        @keyframes slideUp{from{transform:translateY(16px);opacity:0;}to{transform:translateY(0);opacity:1;}}
        @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
        @keyframes spin{to{transform:rotate(360deg);}}
        .anim{animation:fadeIn .25s ease;}
      `}</style>

      {/* TOASTS */}
      <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999, display:"flex", flexDirection:"column", gap:8 }}>
        {toasts.map(t=><Toast key={t.id} msg={t.msg} type={t.type} onClose={()=>setToasts(p=>p.filter(x=>x.id!==t.id))} />)}
      </div>

      {/* MODAL SETOR */}
      {sectorModal && (
        <div onClick={()=>setSectorModal(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div onClick={e=>e.stopPropagation()} className="card anim" style={{ padding:28, width:310 }}>
            <div style={{ fontFamily:"Syne,sans-serif", fontWeight:700, fontSize:15, color:"var(--text)", marginBottom:6 }}>Alterar Setor</div>
            <div style={{ fontSize:13, color:"var(--muted)", marginBottom:18 }}>{sectorModal.nomewpp}</div>
            {["VENDAS","SUPORTE","REUNIAO",""].map(s=>(
              <div key={s} onClick={()=>changeSetor(sectorModal.id,s)} className="row" style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:10, marginBottom:4, background:sectorModal.setor===s?"var(--input)":"transparent" }}>
                <span style={{ width:10, height:10, borderRadius:"50%", background:SETOR_COLOR[s], flexShrink:0 }} />
                <span style={{ fontSize:14, fontWeight:600, color:"var(--text)" }}>{SETOR_LABEL[s]}</span>
                {sectorModal.setor===s && <span style={{ marginLeft:"auto", color:"#6366f1" }}>✓</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <div style={{ width:sidebarOpen?232:64, background:"var(--card)", borderRight:`1px solid var(--border)`, padding:"22px 14px", display:"flex", flexDirection:"column", transition:"width .28s ease", overflow:"hidden", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:30, paddingLeft:4 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>⚡</div>
          {sidebarOpen && <span style={{ fontFamily:"Syne,sans-serif", fontWeight:800, fontSize:17, background:"linear-gradient(135deg,#a5b4fc,#c4b5fd)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", whiteSpace:"nowrap" }}>FlowDesk</span>}
        </div>
        {NAV.map(n=>(
          <div key={n.id} className={`nav-item ${tab===n.id?"active":""}`} onClick={()=>setTab(n.id)} title={n.label}>
            <span style={{ fontSize:15, flexShrink:0 }}>{n.icon}</span>
            {sidebarOpen && <span>{n.label}</span>}
          </div>
        ))}
        <div style={{ flex:1 }} />
        <div className="nav-item" onClick={loadClients} title="Atualizar">
          <span style={{ fontSize:15 }}>{loading ? "⏳" : "↺"}</span>
          {sidebarOpen && <span>Atualizar</span>}
        </div>
        <div className="nav-item" onClick={()=>setDark(!dark)} title="Tema">
          <span style={{ fontSize:15 }}>{dark?"☀":"◗"}</span>
          {sidebarOpen && <span>{dark?"Modo Claro":"Modo Escuro"}</span>}
        </div>
        <div className="nav-item" onClick={()=>setLoggedIn(false)}>
          <span style={{ fontSize:15 }}>⎋</span>
          {sidebarOpen && <span>Sair</span>}
        </div>
        <div className="nav-item" onClick={()=>setSidebarOpen(!sidebarOpen)}>
          <span style={{ fontSize:15 }}>{sidebarOpen?"◁":"▷"}</span>
          {sidebarOpen && <span>Recolher</span>}
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex:1, overflow:"auto", padding:"26px 28px" }} className="anim">

        {/* HEADER */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <div>
            <div style={{ fontFamily:"Syne,sans-serif", fontWeight:800, fontSize:21, color:"var(--text)" }}>{NAV.find(n=>n.id===tab)?.label}</div>
            <div style={{ color:"var(--muted)", fontSize:12, marginTop:2 }}>{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"})}</div>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            {loading && <Spinner />}
            <div style={{ background:evoStatus==="ok"?"#22c55e18":"#ef444418", color:evoStatus==="ok"?"#22c55e":"#ef4444", border:`1px solid ${evoStatus==="ok"?"#22c55e30":"#ef444430"}`, borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:evoStatus==="ok"?"#22c55e":"#ef4444", boxShadow:`0 0 8px ${evoStatus==="ok"?"#22c55e":"#ef4444"}` }} />
              {evoStatus==="ok" ? "Evolution Conectada" : evoStatus==="checking" ? "Verificando..." : "Evolution Offline"}
            </div>
            <div style={{ background:"#6366f118", color:"#a5b4fc", border:"1px solid #6366f130", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
              🗄 Supabase • {total} registros
            </div>
          </div>
        </div>

        {/* STATS */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:14, marginBottom:22 }}>
          {[
            {label:"Total",value:total,color:"#6366f1"},
            {label:"IA Ativa",value:ativos,color:"#22c55e"},
            {label:"IA Pausada",value:pausados,color:"#f59e0b"},
            {label:"Vendas",value:clients.filter(c=>c.setor==="VENDAS").length,color:"#22c55e"},
            {label:"Suporte",value:clients.filter(c=>c.setor==="SUPORTE").length,color:"#f59e0b"},
            {label:"Reunião",value:clients.filter(c=>c.setor==="REUNIAO"||c.setor==="REUNIÃO").length,color:"#3b82f6"},
          ].map((s,i)=>(
            <div key={i} className="card" style={{ padding:"18px 20px" }}>
              <div style={{ fontSize:10, color:"var(--muted)", fontWeight:700, letterSpacing:.6, textTransform:"uppercase", marginBottom:8 }}>{s.label}</div>
              <div style={{ fontFamily:"Syne,sans-serif", fontSize:32, fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ height:3, background:"var(--border)", borderRadius:10, marginTop:12 }}>
                <div style={{ height:"100%", width:`${total>0?(s.value/total)*100:0}%`, background:s.color, borderRadius:10, transition:"width .6s ease" }} />
              </div>
            </div>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab==="overview" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
            <div className="card" style={{ padding:22 }}>
              <div style={{ fontFamily:"Syne,sans-serif", fontWeight:700, fontSize:14, color:"var(--text)", marginBottom:18 }}>Crescimento de Clientes</div>
              {growthData.length > 0 ? (
                <ResponsiveContainer width="100%" height={170}>
                  <LineChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={dark?"#1e2130":"#e2e8f0"} />
                    <XAxis dataKey="dia" tick={{fill:"var(--muted)",fontSize:11}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:"var(--muted)",fontSize:11}} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:8,color:"var(--text)",fontSize:12}} />
                    <Line type="monotone" dataKey="clientes" stroke="#6366f1" strokeWidth={2.5} dot={{fill:"#6366f1",r:4}} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div style={{ height:170, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--muted)" }}>Carregando dados...</div>}
            </div>

            <div className="card" style={{ padding:22 }}>
              <div style={{ fontFamily:"Syne,sans-serif", fontWeight:700, fontSize:14, color:"var(--text)", marginBottom:18 }}>Mensagens por Hora</div>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={MSGS_DATA} barSize={12}>
                  <CartesianGrid strokeDasharray="3 3" stroke={dark?"#1e2130":"#e2e8f0"} />
                  <XAxis dataKey="hora" tick={{fill:"var(--muted)",fontSize:10}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:"var(--muted)",fontSize:10}} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:8,fontSize:12}} />
                  <Bar dataKey="msgs" fill="#8b5cf6" radius={[5,5,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding:22 }}>
              <div style={{ fontFamily:"Syne,sans-serif", fontWeight:700, fontSize:14, color:"var(--text)", marginBottom:18 }}>Distribuição por Setor</div>
              {pieData.length > 0 ? (
                <div style={{ display:"flex", alignItems:"center", gap:20 }}>
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value" paddingAngle={3}>
                        {pieData.map((d,i)=><Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:8,fontSize:12}} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex:1 }}>
                    {pieData.map((d,i)=>(
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                        <span style={{ width:10, height:10, borderRadius:"50%", background:d.color, flexShrink:0 }} />
                        <span style={{ fontSize:13, color:"var(--text)", flex:1 }}>{d.name}</span>
                        <span style={{ fontFamily:"Syne,sans-serif", fontWeight:700, color:d.color }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <div style={{ height:160, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--muted)" }}>Sem dados</div>}
            </div>

            <div className="card" style={{ padding:22 }}>
              <div style={{ fontFamily:"Syne,sans-serif", fontWeight:700, fontSize:14, color:"var(--text)", marginBottom:18 }}>Últimos Clientes</div>
              {clients.slice(0,6).map((c,i)=>(
                <div key={i} onClick={()=>{setSelected(c);setTab("conversas");}} className="row" style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 8px", borderRadius:8, borderBottom:i<5?`1px solid var(--border)`:"none" }}>
                  <div style={{ position:"relative" }}>
                    <Avatar name={c.nomewpp||"?"} size={34} />
                    <span style={{ position:"absolute", bottom:0, right:0, width:9, height:9, borderRadius:"50%", background:c.atendimento_ia==="pause"?"#f59e0b":"#22c55e", border:`2px solid var(--card)` }} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{c.nomewpp || fmtPhone(c.telefone)}</div>
                    <div style={{ fontSize:11, color:"var(--muted)" }}>{fmtPhone(c.telefone)}</div>
                  </div>
                  <Badge setor={c.setor||""} />
                </div>
              ))}
              {clients.length===0 && !loading && <div style={{ textAlign:"center", color:"var(--muted)", padding:"20px 0", fontSize:13 }}>Nenhum cliente ainda</div>}
            </div>
          </div>
        )}

        {/* ── CLIENTES ── */}
        {tab==="clientes" && (
          <div>
            <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
              <input className="inp" placeholder="🔍 Buscar por nome ou telefone..." value={search} onChange={e=>setSearch(e.target.value)} style={{ flex:1, minWidth:200 }} />
              {["TODOS","VENDAS","SUPORTE","REUNIAO"].map(s=>{
                const c=SETOR_COLOR[s]||"#6366f1"; const act=filterSetor===s;
                return <button key={s} className="chip" onClick={()=>setFilterSetor(s)} style={{ background:act?c+"25":"transparent", color:act?c:"var(--muted)", borderColor:act?c+"50":"var(--border)" }}>{s==="TODOS"?"Todos":SETOR_LABEL[s]}</button>;
              })}
              <button className="btn btn-g" onClick={loadClients}>{loading ? <Spinner /> : "↺ Atualizar"}</button>
            </div>
            <div className="card" style={{ overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid var(--border)` }}>
                    {["Cliente","Telefone","Setor","Status IA","Cadastro","Ações"].map(h=>(
                      <th key={h} style={{ padding:"13px 16px", textAlign:"left", fontSize:10, fontWeight:700, color:"var(--muted)", letterSpacing:.8, textTransform:"uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c,i)=>(
                    <tr key={c.id} className="row" style={{ borderBottom:i<filtered.length-1?`1px solid var(--border)`:"none" }} onClick={()=>{setSelected(c);setTab("conversas");}}>
                      <td style={{ padding:"13px 16px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <Avatar name={c.nomewpp||"?"} size={32} />
                          <span style={{ fontWeight:600, fontSize:13 }}>{c.nomewpp || "—"}</span>
                        </div>
                      </td>
                      <td style={{ padding:"13px 16px", fontSize:11, color:"var(--muted)", fontFamily:"monospace" }}>{fmtPhone(c.telefone)}</td>
                      <td style={{ padding:"13px 16px" }}><Badge setor={c.setor||""} onClick={e=>{e.stopPropagation();setSectorModal(c);}} /></td>
                      <td style={{ padding:"13px 16px" }}><IaDot active={c.atendimento_ia!=="pause"} /></td>
                      <td style={{ padding:"13px 16px", fontSize:11, color:"var(--muted)" }}>
                        {c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td style={{ padding:"13px 16px" }} onClick={e=>e.stopPropagation()}>
                        {c.atendimento_ia==="pause"
                          ? <button className="btn btn-s" style={{ fontSize:12, padding:"7px 14px" }} onClick={e=>toggleIA(c,e)}>▶ Reativar</button>
                          : <button className="btn btn-d" style={{ fontSize:12, padding:"7px 14px" }} onClick={e=>toggleIA(c,e)}>⏸ Pausar</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length===0 && !loading && <div style={{ padding:40, textAlign:"center", color:"var(--muted)", fontSize:13 }}>Nenhum cliente encontrado</div>}
              {loading && <div style={{ padding:30, display:"flex", justifyContent:"center" }}><Spinner /></div>}
            </div>
            <div style={{ marginTop:10, fontSize:12, color:"var(--muted)" }}>{filtered.length} de {total} clientes · atualiza a cada 30s</div>
          </div>
        )}

        {/* ── CONVERSAS ── */}
        {tab==="conversas" && (
          <div style={{ display:"grid", gridTemplateColumns:"270px 1fr", gap:16, height:"calc(100vh - 200px)" }}>
            <div className="card" style={{ overflow:"auto", padding:0 }}>
              <div style={{ padding:"12px 14px", borderBottom:`1px solid var(--border)` }}>
                <input className="inp" placeholder="🔍 Buscar..." value={search} onChange={e=>setSearch(e.target.value)} style={{ width:"100%" }} />
              </div>
              {clients.filter(c=>(c.nomewpp||"").toLowerCase().includes(search.toLowerCase())).map((c,i)=>(
                <div key={c.id} className="row" onClick={()=>setSelected(c)} style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", borderBottom:`1px solid var(--border)`, background:selected?.id===c.id?"var(--input)":"transparent" }}>
                  <div style={{ position:"relative" }}>
                    <Avatar name={c.nomewpp||"?"} size={36} />
                    <span style={{ position:"absolute", bottom:0, right:0, width:9, height:9, borderRadius:"50%", background:c.atendimento_ia==="pause"?"#f59e0b":"#22c55e", border:`2px solid var(--card)` }} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13 }}>{c.nomewpp || fmtPhone(c.telefone)}</div>
                    <div style={{ fontSize:11, color:"var(--muted)" }}>{fmtPhone(c.telefone)}</div>
                  </div>
                  <Badge setor={c.setor||""} />
                </div>
              ))}
            </div>
            <div className="card" style={{ display:"flex", flexDirection:"column", overflow:"hidden", padding:0 }}>
              {selected ? (
                <>
                  <div style={{ padding:"14px 20px", borderBottom:`1px solid var(--border)`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <Avatar name={selected.nomewpp||"?"} size={38} />
                      <div>
                        <div style={{ fontWeight:700, fontSize:14 }}>{selected.nomewpp || "—"}</div>
                        <div style={{ fontSize:11, color:"var(--muted)" }}>{fmtPhone(selected.telefone)}</div>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <Badge setor={selected.setor||""} onClick={()=>setSectorModal(selected)} />
                      <IaDot active={selected.atendimento_ia!=="pause"} />
                      {selected.atendimento_ia==="pause"
                        ? <button className="btn btn-s" style={{ fontSize:12, padding:"7px 14px" }} onClick={()=>toggleIA(selected)}>▶ Reativar IA</button>
                        : <button className="btn btn-d" style={{ fontSize:12, padding:"7px 14px" }} onClick={()=>toggleIA(selected)}>⏸ Pausar IA</button>}
                    </div>
                  </div>
                  <div style={{ flex:1, overflow:"auto", padding:20, display:"flex", flexDirection:"column", gap:10 }}>
                    {loadingChat && (
                      <div style={{ display:"flex", justifyContent:"center", padding:20 }}><Spinner /></div>
                    )}
                    {!loadingChat && chatHistory.length === 0 && (
                      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"var(--muted)", gap:8 }}>
                        <div style={{ fontSize:40, opacity:.15 }}>◉</div>
                        <div style={{ fontSize:13 }}>Nenhuma mensagem encontrada</div>
                      </div>
                    )}
                    {chatHistory.map((msg, i) => (
                      <div key={i} style={{ display:"flex", justifyContent:msg.type==="human"?"flex-end":"flex-start" }}>
                        <div style={{ maxWidth:"72%" }}>
                          <div style={{ background:msg.type==="human"?"linear-gradient(135deg,#6366f1,#8b5cf6)":"var(--input)", borderRadius:msg.type==="human"?"12px 0 12px 12px":"0 12px 12px 12px", padding:"10px 14px", fontSize:13, color:msg.type==="human"?"#fff":"var(--text)", lineHeight:1.5 }}>
                            {msg.content}
                          </div>
                          <div style={{ fontSize:10, color:"var(--sub)", marginTop:4, textAlign:msg.type==="human"?"right":"left" }}>{msg.hora}</div>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <div style={{ padding:"12px 16px", borderTop:`1px solid var(--border)`, display:"flex", gap:10 }}>
                    <input className="inp" placeholder="Digite uma mensagem para enviar via WhatsApp..." value={msgInput} onChange={e=>setMsgInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMessage()} style={{ flex:1 }} />
                    <button className="btn btn-p" onClick={sendMessage} disabled={sending}>
                      {sending ? <Spinner /> : "Enviar ↑"}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"var(--muted)" }}>
                  <div style={{ fontSize:48, opacity:.15, marginBottom:12 }}>◉</div>
                  <div>Selecione um contato para enviar mensagem</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SETORES ── */}
        {tab==="setores" && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:18 }}>
            {["VENDAS","SUPORTE","REUNIAO",""].map(setor=>{
              const color=SETOR_COLOR[setor];
              const grupo=clients.filter(c=>(c.setor||"")===setor||(setor==="REUNIAO"&&c.setor==="REUNIÃO"));
              return (
                <div key={setor} className="card" style={{ padding:20, borderTop:`3px solid ${color}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                    <span style={{ fontFamily:"Syne,sans-serif", fontWeight:700, fontSize:15 }}>{SETOR_LABEL[setor]}</span>
                    <span style={{ background:color+"22", color, border:`1px solid ${color}40`, borderRadius:20, padding:"2px 12px", fontSize:13, fontWeight:700 }}>{grupo.length}</span>
                  </div>
                  {grupo.length===0 && <div style={{ color:"var(--sub)", fontSize:12, textAlign:"center", padding:"18px 0" }}>Nenhum cliente</div>}
                  {grupo.map((c,i)=>(
                    <div key={i} onClick={()=>{setSelected(c);setTab("conversas");}} className="row" style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 8px", borderRadius:8, borderBottom:i<grupo.length-1?`1px solid var(--border)`:"none" }}>
                      <Avatar name={c.nomewpp||"?"} size={30} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{c.nomewpp||fmtPhone(c.telefone)}</div>
                        <IaDot active={c.atendimento_ia!=="pause"} />
                      </div>
                      {c.atendimento_ia==="pause"
                        ? <button className="btn btn-s" style={{ fontSize:11, padding:"5px 10px" }} onClick={e=>toggleIA(c,e)}>▶</button>
                        : <button className="btn btn-d" style={{ fontSize:11, padding:"5px 10px" }} onClick={e=>toggleIA(c,e)}>⏸</button>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
