import { useState, useEffect, useCallback, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════
   VOUCHERS DO AMOR — v4.0 (Bidirectional + Gifts + Config)
   ═══════════════════════════════════════════════════════════════
   🔧 SUPABASE — Fill in credentials for cross-device sync.
      Leave empty for local-only mode.
   ═══════════════════════════════════════════════════════════════ */

const SUPABASE_URL = "";
const SUPABASE_KEY = "";
const SYNC_INTERVAL = 4000;
const SUPABASE_ON = SUPABASE_URL.length > 0 && SUPABASE_KEY.length > 0;
const LOCAL_KEY = "vouchers-do-amor-v4";
const DEFAULT_STANDARD = 4;
const MONTH_KEY = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()}`; };

/* ─── Supabase REST ─── */
const sbH = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };
const sbGet = async (table) => { const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?order=created_at.desc`, { headers: sbH }); if (!r.ok) throw new Error(r.status); return r.json(); };
const sbPost = async (table, body) => { const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: "POST", headers: sbH, body: JSON.stringify(body) }); if (!r.ok) throw new Error(r.status); return r.json(); };
const sbPatch = async (table, id, body) => { const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method: "PATCH", headers: sbH, body: JSON.stringify(body) }); if (!r.ok) throw new Error(r.status); return r.json(); };
const sbGetSingle = async (table) => { const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?limit=1`, { headers: sbH }); if (!r.ok) throw new Error(r.status); return r.json(); };
const sbUpsert = async (table, body) => { const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: "POST", headers: { ...sbH, Prefer: "return=representation,resolution=merge-duplicates" }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(r.status); return r.json(); };

/* ─── Cute messages (offline, per sender) ─── */
const DUCK_MSGS = [
  r => `Ducku is using a love voucher to ask for: ${r} 🥺🦆 Please say yes, Bunni! 💕`,
  r => `🐰💌 Special delivery! Ducku really wants: ${r}... pretty please? 🥺✨`,
  r => `Ducku has been thinking about this all day: ${r} 🦆💕 Will you make his day, Bunni?`,
  r => `Quack quack! 🦆 That's duck for "please can I have: ${r}" 🥺💕 Love, Ducku`,
  r => `Ducku spent 20 minutes choosing this voucher just to ask: ${r} 🦆🥺 Be kind, Bunni! 💕`,
  r => `Official love request from Ducku 🦆📜: ${r}. Awaiting Bunni's royal decision 🐰👑💕`,
  r => `Breaking news from Duck HQ 🦆📰: Ducku urgently needs ${r}! Only Bunni can help 💕`,
  r => `Ducku whispers softly: "${r}" 🦆🥺 ...and then looks at you with those eyes 💕🐰`,
];
const BUNNI_MSGS = [
  r => `Bunni is cashing in a love voucher for: ${r} 🐰✨ Will Ducku deliver? 💕`,
  r => `🦆💌 Incoming! Bunni really wants: ${r}... pretty please with a carrot on top? 🥕🥺`,
  r => `Bunni has been dreaming about this: ${r} 🐰💕 Make it happen, Ducku!`,
  r => `*nose wiggle* 🐰 That's bunny for "I'd love: ${r}" 💕 Signed, Bunni`,
  r => `Bunni carefully chose this voucher to ask: ${r} 🐰🥺 Be a good duck, Ducku! 🦆💕`,
  r => `Royal decree from Bunni 🐰👑: ${r}. The duck shall comply! 🦆💕`,
  r => `Alert from Bunny HQ 🐰📰: Bunni needs ${r}! Ducku, this is your moment 🦆💕`,
  r => `Bunni whispers with those big eyes: "${r}" 🐰🥺 ...how could Ducku say no? 💕`,
];
const genMsg = (request, from) => {
  const pool = from === "ducku" ? DUCK_MSGS : BUNNI_MSGS;
  return pool[Math.floor(Math.random() * pool.length)](request);
};

/* ─── Notifications ─── */
const reqNotifPerm = async () => { if (!("Notification" in window)) return "denied"; if (Notification.permission !== "default") return Notification.permission; return await Notification.requestPermission(); };
const notify = (title, body, icon = "💌") => { try { if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body, icon: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${icon}</text></svg>`, tag: "vda-" + Date.now(), vibrate: [100, 50, 100] }); } catch {} };

/* ─── Reset countdown ─── */
const getDaysToReset = () => {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.ceil((next - now) / 86400000);
};

/* ═══════════ SVG ILLUSTRATIONS ═══════════ */
const DuckSVG = ({ size = 40, flip = false }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: flip ? "scaleX(-1)" : "none", flexShrink: 0 }}>
    <ellipse cx="50" cy="62" rx="30" ry="24" fill="#FFD966"/><circle cx="50" cy="36" r="18" fill="#FFD966"/>
    <circle cx="43" cy="32" r="3" fill="#333"/><circle cx="57" cy="32" r="3" fill="#333"/>
    <ellipse cx="50" cy="40" rx="8" ry="4" fill="#FF9933"/>
    <ellipse cx="30" cy="70" rx="10" ry="4" fill="#FF9933" transform="rotate(-15 30 70)"/>
    <ellipse cx="70" cy="70" rx="10" ry="4" fill="#FF9933" transform="rotate(15 70 70)"/>
    <path d="M60 22 Q65 10 58 18" stroke="#FFD966" strokeWidth="3" fill="none"/>
    <circle cx="44" cy="31" r="1" fill="#fff"/><circle cx="58" cy="31" r="1" fill="#fff"/>
  </svg>
);
const BunnySVG = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
    <ellipse cx="50" cy="65" rx="22" ry="20" fill="#FFB6C1"/><circle cx="50" cy="42" r="16" fill="#FFB6C1"/>
    <ellipse cx="40" cy="18" rx="6" ry="18" fill="#FFB6C1"/><ellipse cx="40" cy="18" rx="3" ry="12" fill="#FFC0CB"/>
    <ellipse cx="60" cy="18" rx="6" ry="18" fill="#FFB6C1"/><ellipse cx="60" cy="18" rx="3" ry="12" fill="#FFC0CB"/>
    <circle cx="44" cy="40" r="2.5" fill="#333"/><circle cx="56" cy="40" r="2.5" fill="#333"/>
    <ellipse cx="50" cy="46" rx="3" ry="2" fill="#FF8CAD"/>
    <line x1="50" y1="48" x2="50" y2="52" stroke="#FF8CAD" strokeWidth="1"/>
    <circle cx="44" cy="39" r="0.8" fill="#fff"/><circle cx="56" cy="39" r="0.8" fill="#fff"/>
    <circle cx="42" cy="48" r="4" fill="#FFD1DC" opacity="0.5"/><circle cx="58" cy="48" r="4" fill="#FFD1DC" opacity="0.5"/>
  </svg>
);
const HeartSVG = ({ size = 20, color = "#FF6B8A" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
  </svg>
);

const FloatingElements = () => (
  <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
    {[...Array(5)].map((_, i) => (
      <div key={i} style={{ position: "absolute", left: `${8+i*20}%`, top: "-10%", animation: `floatDown ${14+i*3}s linear infinite`, animationDelay: `${i*2.5}s`, opacity: 0.12 }}>
        <HeartSVG size={16+i*5} color={i%2===0?"#FFB6C1":"#FFD966"}/>
      </div>
    ))}
  </div>
);

const Toast = ({ message, onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, [onDone]);
  return (<div style={{ position:"fixed",top:0,left:0,right:0,zIndex:200,display:"flex",justifyContent:"center",padding:"env(safe-area-inset-top,12px) 16px 0",pointerEvents:"none" }}>
    <div style={{ marginTop:12,background:"#fff",borderRadius:20,padding:"14px 24px",boxShadow:"0 8px 40px rgba(0,0,0,0.15)",animation:"toastIn 0.4s cubic-bezier(.175,.885,.32,1.275)",fontFamily:"var(--font-body)",fontSize:14,fontWeight:600,color:"#555",maxWidth:340,textAlign:"center",pointerEvents:"auto" }}>{message}</div>
  </div>);
};

const SyncBadge = ({ status }) => {
  const c = { synced:{bg:"#E8F8E8",color:"#4A7C4A",border:"#A8DBA8",text:"Synced ✓",icon:"🔄"}, syncing:{bg:"#FFF3B0",color:"#8B7D00",border:"#FFE066",text:"Syncing...",icon:"⏳"}, offline:{bg:"#F0F0F0",color:"#999",border:"#DDD",text:"Local",icon:"📱"}, error:{bg:"#FFF0F0",color:"#C66",border:"#EAADAD",text:"Offline",icon:"⚠️"} }[status] || { bg:"#F0F0F0",color:"#999",border:"#DDD",text:"Local",icon:"📱" };
  return (<div style={{ background:c.bg,border:`1.5px solid ${c.border}`,borderRadius:10,padding:"2px 6px",fontSize:9,fontWeight:700,fontFamily:"var(--font-body)",color:c.color,display:"flex",alignItems:"center",gap:2,animation:status==="syncing"?"pulse 1.5s ease infinite":"none" }}><span style={{fontSize:9}}>{c.icon}</span>{c.text}</div>);
};

/* ═══════════ REUSABLE COMPONENTS ═══════════ */

const NotifBanner = ({ onAllow, onDismiss, partnerName }) => (
  <div style={{ background:"linear-gradient(135deg,#FFF8E1,#FFF3CD)",borderRadius:18,padding:16,margin:"0 0 14px",border:"2px solid #FFE082",animation:"slideUp 0.4s ease" }}>
    <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
      <span style={{fontSize:24}}>🔔</span>
      <p style={{ fontFamily:"var(--font-body)",fontSize:13,color:"#666",fontWeight:500,margin:0,lineHeight:1.4 }}>Allow notifications to know when {partnerName} needs something 💕</p>
    </div>
    <div style={{ display:"flex",gap:8 }}>
      <button onClick={onAllow} style={{ flex:1,padding:"11px 0",borderRadius:12,border:"none",background:"linear-gradient(135deg,#FF6B8A,#FF8FAB)",color:"#fff",fontSize:13,fontWeight:700,fontFamily:"var(--font-display)",cursor:"pointer",minHeight:44 }}>Allow</button>
      <button onClick={onDismiss} style={{ padding:"11px 16px",borderRadius:12,border:"none",background:"rgba(0,0,0,0.06)",color:"#999",fontSize:13,fontWeight:600,fontFamily:"var(--font-body)",cursor:"pointer",minHeight:44 }}>Later</button>
    </div>
  </div>
);

/* ─── Voucher Card ─── */
const VoucherCard = ({ index, used, onUse, disabled, returnedTag, senderName }) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [aiMsg, setAiMsg] = useState("");

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 500 + Math.random() * 400));
    const msg = genMsg(text.trim(), senderName === "Ducku" ? "ducku" : "bunni");
    setAiMsg(msg);
    setSending(false);
    setSent(true);
    onUse(text, msg);
  };

  if (used) return (<div style={{ background:"linear-gradient(135deg,#ECECEC,#DCDCDC)",borderRadius:20,padding:18,border:"2px dashed #C0C0C0",opacity:0.4,minHeight:70,display:"flex",alignItems:"center",justifyContent:"center" }}><span style={{ fontSize:13,color:"#999",fontFamily:"var(--font-body)",fontWeight:600 }}>Voucher Used ✓</span></div>);
  if (sent) return (<div style={{ background:"linear-gradient(135deg,#E8F8E8,#D4F5D4)",borderRadius:20,padding:18,border:"2px solid #8FCB8F",animation:"popIn 0.4s ease" }}><div style={{textAlign:"center",marginBottom:6}}><HeartSVG size={24} color="#FF6B8A"/></div><p style={{ fontSize:13,color:"#4A7C4A",textAlign:"center",fontFamily:"var(--font-body)",fontWeight:500,lineHeight:1.4,margin:0 }}>{aiMsg}</p><p style={{ fontSize:11,color:"#8FCB8F",textAlign:"center",fontFamily:"var(--font-body)",fontWeight:600,marginTop:6 }}>Sent! 💌</p></div>);
  if (disabled) return (<div style={{ background:"linear-gradient(135deg,#F4F4F4,#EAEAEA)",borderRadius:20,padding:18,border:"2px dashed #D0D0D0",opacity:0.3,minHeight:70,display:"flex",alignItems:"center",justifyContent:"center" }}><span style={{ fontSize:12,color:"#BBB",fontFamily:"var(--font-body)",fontWeight:600 }}>🔒 No vouchers left</span></div>);

  const colors = [["#BDE0FE","#A2D2FF","#7EC4FF"],["#FFF3B0","#FFE066","#FFD633"],["#FFD6E0","#FFB3C6","#FF8FAB"],["#D4ECFF","#B0D9FF","#8CC8FF"]];
  const [c1, c2] = colors[index % 4];
  const icons = [<DuckSVG size={26}/>,<BunnySVG size={26}/>,<DuckSVG size={26} flip/>,<BunnySVG size={26}/>];

  return (
    <div style={{ background:`linear-gradient(135deg,${c1},${c2})`,borderRadius:20,padding:"16px 14px",boxShadow:"0 3px 16px rgba(0,0,0,0.05)",animation:`slideUp 0.4s ease ${index*0.07}s both`,position:"relative",overflow:"hidden" }}>
      <div style={{ position:"absolute",left:-8,top:"50%",transform:"translateY(-50%)",width:16,height:16,borderRadius:"50%",background:"rgba(255,255,255,0.5)" }}/>
      <div style={{ position:"absolute",right:-8,top:"50%",transform:"translateY(-50%)",width:16,height:16,borderRadius:"50%",background:"rgba(255,255,255,0.5)" }}/>
      {returnedTag && <div style={{ position:"absolute",top:6,right:10,background:"#6BCB77",color:"#fff",borderRadius:10,padding:"2px 7px",fontSize:9,fontWeight:700,fontFamily:"var(--font-body)",animation:"popIn 0.3s ease" }}>Returned! 🎟️</div>}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
        <div style={{ display:"flex",alignItems:"center",gap:6 }}>{icons[index]}<span style={{ fontFamily:"var(--font-display)",fontSize:14,fontWeight:700,color:"#555" }}>Voucher #{index+1}</span></div>
        <span style={{ background:"rgba(255,255,255,0.6)",borderRadius:16,padding:"2px 8px",fontSize:10,fontWeight:700,color:"#888",fontFamily:"var(--font-body)" }}>💌 Available</span>
      </div>
      <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="What would you like to ask for? 💕" rows={2} style={{ width:"100%",borderRadius:14,border:"2px solid rgba(255,255,255,0.6)",background:"rgba(255,255,255,0.7)",padding:"10px 12px",fontSize:15,fontFamily:"var(--font-body)",resize:"none",outline:"none",boxSizing:"border-box",color:"#444",WebkitAppearance:"none",lineHeight:1.4 }}/>
      <button onClick={handleSend} disabled={!text.trim()||sending} style={{ width:"100%",marginTop:8,padding:"13px 0",borderRadius:14,border:"none",background:text.trim()?"linear-gradient(135deg,#FF6B8A,#FF8FAB)":"#ddd",color:text.trim()?"#fff":"#aaa",fontSize:15,fontWeight:700,fontFamily:"var(--font-display)",cursor:text.trim()?"pointer":"not-allowed",boxShadow:text.trim()?"0 4px 14px rgba(255,107,138,0.3)":"none",minHeight:48,WebkitAppearance:"none",transition:"all 0.2s" }}>
        {sending ? "Sending with love... 💕" : `Use Voucher ${senderName === "Ducku" ? "🦆" : "🐰"}✨`}
      </button>
    </div>
  );
};

/* ─── History Item ─── */
const HistoryItem = ({ item, onAccept, onReject, isReceiver }) => {
  const d = new Date(item.date);
  const dateStr = d.toLocaleDateString("en-GB",{day:"2-digit",month:"short"});
  const timeStr = d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
  const fromIcon = item.from === "ducku" ? <DuckSVG size={20}/> : <BunnySVG size={20}/>;
  const label = item.from === "ducku" ? "Ducku" : "Bunni";

  return (
    <div style={{ background:item.status==="accepted"?"linear-gradient(135deg,#E8F8E8,#D4F5D4)":item.status==="rejected"?"linear-gradient(135deg,#FFF0F0,#FFE4E4)":"linear-gradient(135deg,#fff,#FAFAFA)",borderRadius:18,padding:14,marginBottom:10,border:item.status==="accepted"?"2px solid #A8DBA8":item.status==="rejected"?"2px solid #EAADAD":"2px solid #E8E8E8",boxShadow:"0 2px 8px rgba(0,0,0,0.03)",animation:"slideUp 0.3s ease" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6 }}>
        <div style={{ display:"flex",alignItems:"center",gap:5 }}>
          {fromIcon}
          <span style={{ fontFamily:"var(--font-display)",fontSize:11,color:"#AAA" }}>{label} · {dateStr} · {timeStr}</span>
        </div>
        {item.status==="accepted" && <span style={{fontSize:16}}>✅</span>}
        {item.status==="rejected" && <div style={{display:"flex",alignItems:"center",gap:3}}><span style={{fontSize:16}}>❌</span>{item.returned && <span style={{fontSize:9,fontWeight:700,color:"#6BCB77",fontFamily:"var(--font-body)",background:"#E8F8E8",padding:"1px 5px",borderRadius:6}}>🎟️</span>}</div>}
        {item.status==="pending" && <span style={{ background:"#FFE066",borderRadius:10,padding:"2px 8px",fontSize:10,fontWeight:700,fontFamily:"var(--font-body)",color:"#8B7D00" }}>New!</span>}
      </div>
      <p style={{ fontSize:14,color:"#444",margin:"0 0 3px",fontFamily:"var(--font-body)",fontWeight:600,lineHeight:1.4 }}>"{item.request}"</p>
      {item.aiMessage && <p style={{ fontSize:12,color:"#999",margin:"0 0 8px",fontFamily:"var(--font-body)",fontStyle:"italic",lineHeight:1.3 }}>{item.aiMessage}</p>}
      {item.status==="pending" && isReceiver && (
        <div style={{ display:"flex",gap:8 }}>
          <button onClick={()=>onAccept(item.id)} style={{ flex:1,padding:"12px 0",borderRadius:12,border:"none",background:"linear-gradient(135deg,#6BCB77,#8FDB8F)",color:"#fff",fontSize:14,fontWeight:700,fontFamily:"var(--font-display)",cursor:"pointer",minHeight:46,WebkitAppearance:"none" }}>Accept ✅</button>
          <button onClick={()=>onReject(item.id)} style={{ flex:1,padding:"12px 0",borderRadius:12,border:"none",background:"linear-gradient(135deg,#FF6B6B,#FF8F8F)",color:"#fff",fontSize:14,fontWeight:700,fontFamily:"var(--font-display)",cursor:"pointer",minHeight:46,WebkitAppearance:"none" }}>Reject ❌</button>
        </div>
      )}
      {item.status==="pending" && !isReceiver && <p style={{ fontSize:11,color:"#CCC",fontFamily:"var(--font-body)",fontWeight:600 }}>⏳ Waiting for response...</p>}
    </div>
  );
};

/* ─── Gift Modal ─── */
const GiftModal = ({ from, to, onGift, onClose }) => {
  const [amount, setAmount] = useState(1);
  const fromName = from === "ducku" ? "Ducku" : "Bunni";
  const toName = to === "ducku" ? "Ducku" : "Bunni";
  const toIcon = to === "ducku" ? "🦆" : "🐰";
  return (
    <div style={{ position:"fixed",inset:0,zIndex:150,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }} onClick={onClose}>
      <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.3)",backdropFilter:"blur(6px)" }}/>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff",borderRadius:24,padding:24,width:"100%",maxWidth:340,position:"relative",animation:"popIn 0.3s ease",textAlign:"center" }}>
        <span style={{ fontSize:40,display:"block",marginBottom:8 }}>🎁</span>
        <h3 style={{ fontFamily:"var(--font-display)",fontSize:20,color:"#555",margin:"0 0 4px" }}>Gift Vouchers to {toName} {toIcon}</h3>
        <p style={{ fontFamily:"var(--font-body)",fontSize:13,color:"#999",margin:"0 0 18px",fontWeight:500 }}>Extra vouchers on top of their monthly pool!</p>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:16,marginBottom:20 }}>
          <button onClick={()=>setAmount(Math.max(1,amount-1))} style={{ width:44,height:44,borderRadius:14,border:"2px solid #EEE",background:"#FAFAFA",fontSize:20,fontWeight:700,cursor:"pointer",fontFamily:"var(--font-display)",color:"#888",display:"flex",alignItems:"center",justifyContent:"center" }}>−</button>
          <span style={{ fontFamily:"var(--font-display)",fontSize:36,color:"#FF6B8A",fontWeight:800,minWidth:50,textAlign:"center" }}>{amount}</span>
          <button onClick={()=>setAmount(Math.min(10,amount+1))} style={{ width:44,height:44,borderRadius:14,border:"2px solid #EEE",background:"#FAFAFA",fontSize:20,fontWeight:700,cursor:"pointer",fontFamily:"var(--font-display)",color:"#888",display:"flex",alignItems:"center",justifyContent:"center" }}>+</button>
        </div>
        <button onClick={()=>{onGift(amount);onClose()}} style={{ width:"100%",padding:"14px 0",borderRadius:16,border:"none",background:"linear-gradient(135deg,#FF6B8A,#FF8FAB)",color:"#fff",fontSize:16,fontWeight:700,fontFamily:"var(--font-display)",cursor:"pointer",minHeight:50,WebkitAppearance:"none",boxShadow:"0 4px 16px rgba(255,107,138,0.3)" }}>
          Gift {amount} Voucher{amount>1?"s":""} 🎁💕
        </button>
        <button onClick={onClose} style={{ marginTop:10,background:"none",border:"none",color:"#CCC",fontSize:13,fontFamily:"var(--font-body)",fontWeight:600,cursor:"pointer" }}>Cancel</button>
      </div>
    </div>
  );
};

/* ─── Settings Modal ─── */
const SettingsModal = ({ standard, onSave, onClose }) => {
  const [val, setVal] = useState(standard);
  return (
    <div style={{ position:"fixed",inset:0,zIndex:150,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }} onClick={onClose}>
      <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.3)",backdropFilter:"blur(6px)" }}/>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff",borderRadius:24,padding:24,width:"100%",maxWidth:340,position:"relative",animation:"popIn 0.3s ease",textAlign:"center" }}>
        <span style={{ fontSize:40,display:"block",marginBottom:8 }}>⚙️</span>
        <h3 style={{ fontFamily:"var(--font-display)",fontSize:20,color:"#555",margin:"0 0 4px" }}>Monthly Standard</h3>
        <p style={{ fontFamily:"var(--font-body)",fontSize:13,color:"#999",margin:"0 0 18px",fontWeight:500 }}>Vouchers each partner gets per month. Applies to both equally from next reset.</p>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:16,marginBottom:20 }}>
          <button onClick={()=>setVal(Math.max(1,val-1))} style={{ width:44,height:44,borderRadius:14,border:"2px solid #EEE",background:"#FAFAFA",fontSize:20,fontWeight:700,cursor:"pointer",fontFamily:"var(--font-display)",color:"#888",display:"flex",alignItems:"center",justifyContent:"center" }}>−</button>
          <span style={{ fontFamily:"var(--font-display)",fontSize:36,color:"#4A6FA5",fontWeight:800,minWidth:50,textAlign:"center" }}>{val}</span>
          <button onClick={()=>setVal(Math.min(20,val+1))} style={{ width:44,height:44,borderRadius:14,border:"2px solid #EEE",background:"#FAFAFA",fontSize:20,fontWeight:700,cursor:"pointer",fontFamily:"var(--font-display)",color:"#888",display:"flex",alignItems:"center",justifyContent:"center" }}>+</button>
        </div>
        <button onClick={()=>{onSave(val);onClose()}} style={{ width:"100%",padding:"14px 0",borderRadius:16,border:"none",background:"linear-gradient(135deg,#4A9EFF,#6BB3FF)",color:"#fff",fontSize:16,fontWeight:700,fontFamily:"var(--font-display)",cursor:"pointer",minHeight:50,WebkitAppearance:"none" }}>
          Save — {val} vouchers each ✓
        </button>
        <button onClick={onClose} style={{ marginTop:10,background:"none",border:"none",color:"#CCC",fontSize:13,fontFamily:"var(--font-body)",fontWeight:600,cursor:"pointer" }}>Cancel</button>
      </div>
    </div>
  );
};

/* ─── Dashboard Gauge (per user) ─── */
const DashGauge = ({ used, total, bonus, accepted, rejected, pending }) => {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div style={{ background:"linear-gradient(135deg,#fff,#FFF8F0)",borderRadius:20,padding:18,border:"2px solid #FFE4CC",animation:"slideUp 0.4s ease" }}>
      <p style={{ fontFamily:"var(--font-display)",fontSize:14,color:"#999",margin:"0 0 10px",textAlign:"center" }}>Your Vouchers This Month</p>
      <div style={{ width:"100%",height:12,borderRadius:8,background:"#F0F0F0",overflow:"hidden",marginBottom:8 }}>
        <div style={{ height:"100%",borderRadius:8,background:pct>75?"linear-gradient(90deg,#FF6B8A,#FF4D6D)":pct>50?"linear-gradient(90deg,#FFB347,#FF9500)":"linear-gradient(90deg,#6BCB77,#4CAF50)",width:`${pct}%`,transition:"width 0.8s ease" }}/>
      </div>
      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:12 }}>
        <span style={{ fontFamily:"var(--font-body)",fontSize:12,color:"#888",fontWeight:600 }}>{used} used</span>
        <span style={{ fontFamily:"var(--font-body)",fontSize:12,color:"#888",fontWeight:600 }}>{total-used} left {bonus>0?`(+${bonus} gifted)`:""}</span>
      </div>
      <div style={{ display:"flex",gap:6 }}>
        {[{l:"Pending",v:pending,bg:"#FFF3B0",c:"#8B7D00",b:"#FFE066"},{l:"Accepted",v:accepted,bg:"#E8F8E8",c:"#4A7C4A",b:"#A8DBA8"},{l:"Rejected",v:rejected,bg:"#FFF0F0",c:"#C66",b:"#EAADAD"}].map(s=>(
          <div key={s.l} style={{ flex:1,background:s.bg,borderRadius:12,padding:"8px 4px",textAlign:"center",border:`1.5px solid ${s.b}` }}>
            <p style={{ fontFamily:"var(--font-display)",fontSize:18,color:s.c,margin:0,fontWeight:700 }}>{s.v}</p>
            <p style={{ fontFamily:"var(--font-body)",fontSize:9,color:s.c,margin:0,fontWeight:600,opacity:0.8 }}>{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Bottom Nav ─── */
const BottomNav = ({ activeTab, onTab, pendingCount, color }) => {
  const tabs = [
    { id:"vouchers", label:"Vouchers", icon:"🎟️" },
    { id:"inbox", label:"Inbox", icon:"💌", badge:pendingCount },
    { id:"history", label:"History", icon:"📜" },
  ];
  return (
    <div style={{ position:"fixed",bottom:0,left:0,right:0,zIndex:60,background:"rgba(255,255,255,0.92)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",borderTop:"1px solid rgba(0,0,0,0.06)",display:"flex",paddingBottom:"env(safe-area-inset-bottom,8px)",boxShadow:"0 -2px 20px rgba(0,0,0,0.04)" }}>
      {tabs.map(tab => {
        const active = activeTab === tab.id;
        return (
          <button key={tab.id} onClick={()=>onTab(tab.id)} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"10px 0 6px",border:"none",background:"none",cursor:"pointer",position:"relative",minHeight:56,WebkitAppearance:"none" }}>
            <span style={{ fontSize:20,filter:active?"none":"grayscale(0.6)",transition:"all 0.2s",transform:active?"scale(1.15)":"scale(1)" }}>{tab.icon}</span>
            <span style={{ fontFamily:"var(--font-body)",fontSize:10,fontWeight:700,color:active?color:"#BBB",marginTop:2 }}>{tab.label}</span>
            {tab.badge>0 && <span style={{ position:"absolute",top:4,right:"calc(50% - 18px)",background:"#FF4D6D",color:"#fff",borderRadius:"50%",width:18,height:18,fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",animation:"popIn 0.3s ease" }}>{tab.badge}</span>}
            {active && <div style={{ position:"absolute",top:0,left:"30%",right:"30%",height:3,borderRadius:2,background:`linear-gradient(90deg,${color},${color}44)` }}/>}
          </button>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════ */
export default function VouchersDoAmor() {
  const [view, setView] = useState("splash"); // splash | ducku | bunni
  const [tab, setTab] = useState("vouchers");
  const [data, setData] = useState({ vouchers:[], gifts:[], settings:{ standard:DEFAULT_STANDARD } });
  const [toast, setToast] = useState(null);
  const [syncStatus, setSyncStatus] = useState(SUPABASE_ON ? "syncing" : "offline");
  const [showNotifBanner, setShowNotifBanner] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [returnedSlots, setReturnedSlots] = useState(new Set());
  const deferredPromptRef = useRef(null);

  const me = view === "ducku" ? "ducku" : "bunni";
  const partner = me === "ducku" ? "bunni" : "ducku";
  const myName = me === "ducku" ? "Ducku" : "Bunni";
  const partnerName = partner === "ducku" ? "Ducku" : "Bunni";
  const myColor = me === "ducku" ? "#4A6FA5" : "#C4597A";

  /* ─── PERSISTENCE ─── */
  const saveLocal = useCallback(async (d) => {
    try { if (window.storage?.set) await window.storage.set(LOCAL_KEY, JSON.stringify(d)); } catch {}
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(d)); } catch {}
  }, []);

  const loadAll = useCallback(async () => {
    // Try Supabase first
    if (SUPABASE_ON) {
      try {
        setSyncStatus("syncing");
        const [vRows, gRows, sRows] = await Promise.all([sbGet("vouchers"), sbGet("gifts"), sbGetSingle("app_settings")]);
        const vouchers = vRows.map(r => ({ id:r.id, from:r.from_user, to:r.to_user, request:r.request, aiMessage:r.ai_message, date:r.created_at, status:r.status, returned:r.returned||false, monthKey:r.month_key }));
        const gifts = gRows.map(r => ({ id:r.id, from:r.from_user, to:r.to_user, amount:r.amount, date:r.created_at, monthKey:r.month_key }));
        const settings = sRows.length > 0 ? { standard: sRows[0].standard || DEFAULT_STANDARD } : { standard: DEFAULT_STANDARD };
        const d = { vouchers, gifts, settings };
        setData(d);
        saveLocal(d);
        setSyncStatus("synced");
        return;
      } catch { setSyncStatus("error"); }
    }
    // Fallback
    try {
      if (window.storage?.get) {
        const r = await window.storage.get(LOCAL_KEY);
        if (r) { const p = JSON.parse(r.value); setData(p); return; }
      }
    } catch {}
    try { const raw = localStorage.getItem(LOCAL_KEY); if (raw) { setData(JSON.parse(raw)); return; } } catch {}
    setData({ vouchers:[], gifts:[], settings:{ standard:DEFAULT_STANDARD } });
  }, [saveLocal]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Polling
  useEffect(() => {
    if (!SUPABASE_ON || view === "splash") return;
    const iv = setInterval(() => loadAll(), SYNC_INTERVAL);
    return () => clearInterval(iv);
  }, [view, loadAll]);

  // PWA
  useEffect(() => { const h = e => { e.preventDefault(); deferredPromptRef.current = e; }; window.addEventListener("beforeinstallprompt", h); return () => window.removeEventListener("beforeinstallprompt", h); }, []);

  useEffect(() => {
    if (view !== "splash") {
      setTab("vouchers");
      if ("Notification" in window && Notification.permission === "default") setShowNotifBanner(true);
    }
  }, [view]);

  /* ─── COMPUTED ─── */
  const mk = MONTH_KEY();
  const standard = data.settings?.standard || DEFAULT_STANDARD;
  const myVouchers = data.vouchers.filter(v => v.from === me && (v.monthKey || "").startsWith(mk.split("-")[0])).filter(v => { const d2 = new Date(v.date); return `${d2.getFullYear()}-${d2.getMonth()}` === mk; });
  const myRejected = myVouchers.filter(v => v.status === "rejected").length;
  const myEffectiveUsed = myVouchers.length - myRejected;
  const myBonusReceived = data.gifts.filter(g => g.to === me).filter(g => { const d2 = new Date(g.date); return `${d2.getFullYear()}-${d2.getMonth()}` === mk; }).reduce((s, g) => s + (g.amount || 0), 0);
  const myTotal = standard + myBonusReceived;
  const myRemaining = Math.max(0, myTotal - myEffectiveUsed);

  const inboxVouchers = data.vouchers.filter(v => v.to === me && v.status === "pending");
  const inboxCount = inboxVouchers.length;

  const myAccepted = myVouchers.filter(v => v.status === "accepted").length;
  const myPending = myVouchers.filter(v => v.status === "pending").length;

  const allMyHistory = [...data.vouchers.filter(v => v.from === me || v.to === me)].sort((a, b) => new Date(b.date) - new Date(a.date));

  const daysToReset = getDaysToReset();

  const showToast = (msg) => { setToast(null); setTimeout(() => setToast(msg), 30); };

  /* ─── ACTIONS ─── */
  const handleUseVoucher = async (text, aiMsg) => {
    const v = { id: Date.now().toString(), from: me, to: partner, request: text, aiMessage: aiMsg, date: new Date().toISOString(), status: "pending", returned: false, monthKey: mk };
    const nd = { ...data, vouchers: [v, ...data.vouchers] };
    setData(nd);
    await saveLocal(nd);
    if (SUPABASE_ON) try { await sbPost("vouchers", { id:v.id, from_user:v.from, to_user:v.to, request:v.request, ai_message:v.aiMessage, created_at:v.date, status:v.status, returned:v.returned, month_key:v.monthKey }); setSyncStatus("synced"); } catch { setSyncStatus("error"); }
    notify("Vouchers do Amor 💌", `${myName} wants: ${text}`, "💌");
    showToast(`Voucher sent to ${partnerName}! 💌✨`);
  };

  const handleAccept = async (id) => {
    const nd = { ...data, vouchers: data.vouchers.map(v => v.id === id ? { ...v, status: "accepted" } : v) };
    setData(nd); await saveLocal(nd);
    if (SUPABASE_ON) try { await sbPatch("vouchers", id, { status: "accepted" }); setSyncStatus("synced"); } catch { setSyncStatus("error"); }
    const item = data.vouchers.find(v => v.id === id);
    notify("Vouchers do Amor ✅", `${myName} accepted: "${item?.request}" 💕`, "✅");
    showToast("Request accepted! 💕");
  };

  const handleReject = async (id) => {
    const nd = { ...data, vouchers: data.vouchers.map(v => v.id === id ? { ...v, status: "rejected", returned: true } : v) };
    setData(nd); await saveLocal(nd);
    if (SUPABASE_ON) try { await sbPatch("vouchers", id, { status: "rejected", returned: true }); setSyncStatus("synced"); } catch { setSyncStatus("error"); }
    notify("Vouchers do Amor ❌", `${myName} rejected — voucher returned 🎟️`, "❌");
    setReturnedSlots(prev => { const n = new Set(prev); n.add(myEffectiveUsed - 1); return n; });
    setTimeout(() => setReturnedSlots(new Set()), 3000);
    showToast("Rejected — Voucher returned! 🎟️");
  };

  const handleGift = async (amount) => {
    const g = { id: Date.now().toString(), from: me, to: partner, amount, date: new Date().toISOString(), monthKey: mk };
    const nd = { ...data, gifts: [g, ...data.gifts] };
    setData(nd); await saveLocal(nd);
    if (SUPABASE_ON) try { await sbPost("gifts", { id:g.id, from_user:g.from, to_user:g.to, amount:g.amount, created_at:g.date, month_key:g.monthKey }); setSyncStatus("synced"); } catch { setSyncStatus("error"); }
    notify("Vouchers do Amor 🎁", `${myName} gifted ${amount} extra voucher${amount>1?"s":""} to ${partnerName}! 💕`, "🎁");
    showToast(`You gifted ${amount} voucher${amount>1?"s":""} to ${partnerName} 🎁💕`);
  };

  const handleSaveStandard = async (val) => {
    const nd = { ...data, settings: { ...data.settings, standard: val } };
    setData(nd); await saveLocal(nd);
    if (SUPABASE_ON) try { await sbUpsert("app_settings", { id: "main", standard: val }); setSyncStatus("synced"); } catch { setSyncStatus("error"); }
    showToast(`Monthly standard set to ${val} vouchers each ✓`);
  };

  const handleAllowNotifs = async () => { await reqNotifPerm(); setShowNotifBanner(false); if (Notification.permission === "granted") showToast("Notifications enabled! 🔔💕"); };

  /* ═══════════ STYLES ═══════════ */
  const globalStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&family=Nunito:wght@400;500;600;700;800&display=swap');
    :root{--font-display:'Baloo 2',cursive;--font-body:'Nunito',sans-serif}
    *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
    html{-webkit-text-size-adjust:100%}
    @keyframes floatDown{0%{transform:translateY(-100vh) rotate(0)}100%{transform:translateY(120vh) rotate(360deg)}}
    @keyframes popIn{0%{transform:scale(.5);opacity:0}50%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
    @keyframes slideUp{0%{transform:translateY(24px);opacity:0}100%{transform:translateY(0);opacity:1}}
    @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
    @keyframes wiggle{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
    @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
    @keyframes toastIn{0%{transform:translateY(-30px) scale(.9);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}
    textarea::placeholder{color:#bbb}button:active{transform:scale(.97)!important}::-webkit-scrollbar{width:0}input,textarea,button{font-size:16px}
  `;

  /* ═══════════ SPLASH ═══════════ */
  if (view === "splash") {
    return (
      <div style={{ minHeight:"100vh",minHeight:"100dvh",background:"linear-gradient(160deg,#BDE0FE 0%,#FFD6E0 40%,#FFF3B0 80%,#FFB6C1 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px",position:"relative",overflow:"hidden",paddingTop:"env(safe-area-inset-top,24px)" }}>
        <style>{globalStyles}</style>
        <FloatingElements/>
        <div style={{ animation:"popIn 0.6s ease",zIndex:1,textAlign:"center",width:"100%",maxWidth:320 }}>
          <div style={{ display:"flex",justifyContent:"center",gap:12,marginBottom:20 }}>
            <div style={{animation:"bounce 2s ease infinite"}}><DuckSVG size={58}/></div>
            <div style={{animation:"pulse 2s ease infinite 0.5s",display:"flex",alignItems:"center"}}><HeartSVG size={34} color="#FF6B8A"/></div>
            <div style={{animation:"bounce 2s ease infinite 0.3s"}}><BunnySVG size={58}/></div>
          </div>
          <h1 style={{ fontFamily:"var(--font-display)",fontSize:32,color:"#FF6B8A",textShadow:"0 2px 12px rgba(255,107,138,0.2)",marginBottom:4,lineHeight:1.1 }}>Vouchers do Amor</h1>
          <p style={{ fontFamily:"var(--font-body)",fontSize:14,color:"#999",fontWeight:600,marginBottom:36 }}>Ducku 🦆 & Bunni 🐰</p>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <button onClick={()=>setView("ducku")} style={{ padding:"16px 0",borderRadius:20,border:"none",background:"linear-gradient(135deg,#BDE0FE,#A2D2FF)",color:"#4A6FA5",fontSize:18,fontWeight:700,fontFamily:"var(--font-display)",cursor:"pointer",boxShadow:"0 6px 20px rgba(162,210,255,0.4)",minHeight:58,WebkitAppearance:"none" }}>🦆 I'm Ducku</button>
            <button onClick={()=>setView("bunni")} style={{ padding:"16px 0",borderRadius:20,border:"none",background:"linear-gradient(135deg,#FFD6E0,#FFB3C6)",color:"#C4597A",fontSize:18,fontWeight:700,fontFamily:"var(--font-display)",cursor:"pointer",boxShadow:"0 6px 20px rgba(255,179,198,0.4)",minHeight:58,WebkitAppearance:"none" }}>🐰 I'm Bunni</button>
          </div>
          <p style={{ fontFamily:"var(--font-body)",fontSize:11,color:"#CCC",marginTop:28,fontWeight:600 }}>
            {standard} vouchers each per month · Both can request & gift 💕
          </p>
        </div>
      </div>
    );
  }

  /* ═══════════ MAIN LAYOUT ═══════════ */
  const isBf = me === "ducku";
  const bgTop = isBf ? "#BDE0FE" : "#FFD6E0";
  const bgMid = isBf ? "#E8F4FF" : "#FFF0F3";

  return (
    <div style={{ minHeight:"100vh",minHeight:"100dvh",background:`linear-gradient(180deg,${bgTop} 0%,${bgMid} 30%,#FFF8F0 100%)`,fontFamily:"var(--font-display)",position:"relative",overflow:"hidden",paddingBottom:"calc(64px + env(safe-area-inset-bottom,8px))" }}>
      <style>{globalStyles}</style>
      <FloatingElements/>
      {toast && <Toast message={toast} onDone={()=>setToast(null)}/>}
      {showGiftModal && <GiftModal from={me} to={partner} onGift={handleGift} onClose={()=>setShowGiftModal(false)}/>}
      {showSettingsModal && <SettingsModal standard={standard} onSave={handleSaveStandard} onClose={()=>setShowSettingsModal(false)}/>}

      {/* Header */}
      <div style={{ position:"sticky",top:0,zIndex:50,background:isBf?"rgba(189,224,254,0.92)":"rgba(255,214,224,0.92)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",padding:"0 10px",paddingTop:"env(safe-area-inset-top,10px)",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 2px 16px rgba(0,0,0,0.05)",height:"calc(54px + env(safe-area-inset-top,0px))" }}>
        <button onClick={()=>setView("splash")} style={{ background:"rgba(255,255,255,0.5)",border:"none",borderRadius:12,padding:"7px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"var(--font-body)",color:"#666",minHeight:34,WebkitAppearance:"none" }}>← Back</button>
        <div style={{ display:"flex",alignItems:"center",gap:6 }}>
          {isBf?<DuckSVG size={22}/>:<BunnySVG size={22}/>}
          <span style={{ fontSize:15,fontWeight:700,color:myColor }}>{myName}</span>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:4 }}>
          <SyncBadge status={syncStatus}/>
          <div style={{ background:"rgba(255,255,255,0.6)",borderRadius:12,padding:"4px 8px",fontSize:11,fontWeight:800,fontFamily:"var(--font-body)",color:myRemaining>0?"#6BCB77":"#FF6B6B",display:"flex",alignItems:"center",gap:3 }}>🎟️{myRemaining}/{myTotal}</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding:"14px 12px 24px",maxWidth:480,margin:"0 auto",position:"relative",zIndex:1,width:"100%" }}>

        {/* ── Reset countdown + action buttons ── */}
        <div style={{ display:"flex",gap:8,marginBottom:14,animation:"slideUp 0.3s ease" }}>
          <div style={{ flex:1,background:"rgba(255,255,255,0.7)",borderRadius:14,padding:"10px 12px",display:"flex",alignItems:"center",gap:6,border:"1.5px solid rgba(0,0,0,0.04)" }}>
            <span style={{fontSize:16}}>🗓️</span>
            <div>
              <p style={{ fontFamily:"var(--font-body)",fontSize:11,color:"#999",margin:0,fontWeight:600 }}>Resets in {daysToReset} day{daysToReset!==1?"s":""}</p>
              <p style={{ fontFamily:"var(--font-body)",fontSize:9,color:"#CCC",margin:0,fontWeight:600 }}>{standard} vouchers each · 1st of month</p>
            </div>
          </div>
          <button onClick={()=>setShowGiftModal(true)} style={{ background:"linear-gradient(135deg,#FFE066,#FFD633)",border:"none",borderRadius:14,padding:"10px 14px",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"var(--font-display)",color:"#8B7D00",minHeight:44,WebkitAppearance:"none",whiteSpace:"nowrap" }}>🎁 Gift</button>
          <button onClick={()=>setShowSettingsModal(true)} style={{ background:"rgba(255,255,255,0.7)",border:"1.5px solid rgba(0,0,0,0.06)",borderRadius:14,padding:"10px 12px",cursor:"pointer",fontSize:16,minHeight:44,WebkitAppearance:"none",display:"flex",alignItems:"center",justifyContent:"center" }}>⚙️</button>
        </div>

        {/* ── Notification banner ── */}
        {showNotifBanner && <NotifBanner partnerName={partnerName} onAllow={handleAllowNotifs} onDismiss={()=>setShowNotifBanner(false)}/>}

        {/* ── TAB: VOUCHERS ── */}
        {tab === "vouchers" && (
          <>
            <div style={{ textAlign:"center",marginBottom:16,animation:"slideUp 0.3s ease" }}>
              <h2 style={{ fontSize:20,color:myColor,marginBottom:2 }}>Your Vouchers {isBf?"🦆":"🐰"}</h2>
              <p style={{ fontFamily:"var(--font-body)",fontSize:12,color:"#999",fontWeight:600 }}>
                {myRemaining > 0 ? `You have ${myRemaining} voucher${myRemaining>1?"s":""} to use on ${partnerName}!` : `No vouchers left this month 😢`}
              </p>
            </div>
            <DashGauge used={myEffectiveUsed} total={myTotal} bonus={myBonusReceived} accepted={myAccepted} rejected={myRejected} pending={myPending}/>
            <div style={{ display:"flex",flexDirection:"column",gap:12,marginTop:14 }}>
              {[...Array(myTotal)].map((_, i) => (
                <VoucherCard key={`v-${i}-${mk}`} index={i} used={i<myEffectiveUsed} disabled={i>myEffectiveUsed} onUse={handleUseVoucher} returnedTag={returnedSlots.has(i)} senderName={myName}/>
              ))}
            </div>
          </>
        )}

        {/* ── TAB: INBOX ── */}
        {tab === "inbox" && (
          <>
            <div style={{ textAlign:"center",marginBottom:16,animation:"slideUp 0.3s ease" }}>
              <h2 style={{ fontSize:20,color:myColor,marginBottom:2 }}>
                <span style={{animation:"wiggle 1s ease infinite",display:"inline-block"}}>💌</span> Requests From {partnerName}
              </h2>
              <p style={{ fontFamily:"var(--font-body)",fontSize:12,color:"#999",fontWeight:600 }}>
                {inboxCount>0 ? `${inboxCount} pending request${inboxCount>1?"s":""}!` : `No pending requests right now`}
              </p>
            </div>
            {inboxVouchers.length > 0 ? inboxVouchers.map(v => (
              <HistoryItem key={v.id} item={v} onAccept={handleAccept} onReject={handleReject} isReceiver={true}/>
            )) : (
              <div style={{ textAlign:"center",padding:36,animation:"slideUp 0.4s ease" }}>
                <div style={{animation:"float 3s ease infinite"}}>{isBf?<BunnySVG size={65}/>:<DuckSVG size={65}/>}</div>
                <p style={{ fontFamily:"var(--font-body)",fontSize:13,color:"#CCC",fontWeight:600,marginTop:12 }}>All caught up! 💕</p>
              </div>
            )}
          </>
        )}

        {/* ── TAB: HISTORY ── */}
        {tab === "history" && (
          <>
            <div style={{ textAlign:"center",marginBottom:16,animation:"slideUp 0.3s ease" }}>
              <h2 style={{ fontSize:20,color:myColor,marginBottom:2 }}>History 📜</h2>
            </div>

            {/* Gift log */}
            {data.gifts.filter(g => g.from === me || g.to === me).length > 0 && (
              <div style={{ marginBottom:14 }}>
                <p style={{ fontFamily:"var(--font-display)",fontSize:13,color:"#999",marginBottom:8 }}>🎁 Gift Log</p>
                {data.gifts.filter(g => g.from === me || g.to === me).sort((a,b) => new Date(b.date) - new Date(a.date)).map(g => {
                  const d2 = new Date(g.date);
                  const isSent = g.from === me;
                  const otherName = isSent ? partnerName : myName;
                  return (
                    <div key={g.id} style={{ background:"linear-gradient(135deg,#FFF8E1,#FFF3CD)",borderRadius:14,padding:"10px 12px",marginBottom:6,border:"1.5px solid #FFE082",animation:"slideUp 0.3s ease" }}>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                        <span style={{ fontFamily:"var(--font-body)",fontSize:13,color:"#8B7D00",fontWeight:600 }}>
                          {isSent ? `You gifted ${g.amount} to ${otherName}` : `${otherName} gifted you ${g.amount}`} 🎁
                        </span>
                        <span style={{ fontFamily:"var(--font-body)",fontSize:10,color:"#CCC",fontWeight:600 }}>{d2.toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Voucher history */}
            {allMyHistory.filter(v=>v.status!=="pending").length > 0 ? allMyHistory.filter(v=>v.status!=="pending").map(v => (
              <HistoryItem key={v.id} item={v} onAccept={handleAccept} onReject={handleReject} isReceiver={v.to===me}/>
            )) : (
              <div style={{ textAlign:"center",padding:36,animation:"slideUp 0.4s ease" }}>
                <div style={{animation:"float 3s ease infinite"}}>{isBf?<DuckSVG size={65}/>:<BunnySVG size={65}/>}</div>
                <p style={{ fontFamily:"var(--font-body)",fontSize:13,color:"#CCC",fontWeight:600,marginTop:12 }}>No history yet {isBf?"🦆":"🐰"}</p>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav activeTab={tab} onTab={setTab} pendingCount={inboxCount} color={myColor}/>
    </div>
  );
}
