"use client";

import { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { CheckCircle2, Play, Activity, Network, Zap } from "lucide-react";
import "./globals.css";

const AGENTS = [
  { id: "buyer1", name: "Buyer 1", port: 3001, type: "buyer" },
  { id: "buyer2", name: "Buyer 2", port: 3002, type: "buyer" },
  { id: "buyer3", name: "Buyer 3", port: 3003, type: "buyer" },
  { id: "seller", name: "Seller Agent", port: 3004, type: "seller" }
];


function LiveTopologyGraph({ gState, agentsState }: { gState: string; agentsState: any }) {
  const [topology, setTopology] = useState<any>(null);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const r = await fetch("http://localhost:9002/topology");
        if (r.ok) setTopology(await r.json());
      } catch {}
    }, 2000);
    return () => clearInterval(poll);
  }, []);

  const isIdle = gState === "idle";
  const isActive = gState !== "idle";
  const isSettled = gState === "settled" || gState === "paid";

  const ourKey = topology?.our_public_key ?? "";
  const peers = topology?.peers ?? [];
  const allNodes = [
    { key: ourKey, label: "You (B1)", x: 200, y: 200, color: "#6366f1", isSelf: true, up: true },
    ...peers.map((p: any, i: number) => {
      const angle = (i / Math.max(peers.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const r = 140;
      return {
        key: p.public_key,
        label: p.public_key?.startsWith("0d68") ? "Seller" : `Peer ${i + 1}`,
        x: 200 + Math.cos(angle) * r,
        y: 200 + Math.sin(angle) * r,
        color: p.up ? (p.public_key?.startsWith("0d68") ? "#a855f7" : "#06b6d4") : "#555",
        up: p.up,
        isSelf: false,
      };
    }),
  ];

  const b1Commit = agentsState?.buyer1?.myCommits?.[0];
  const originalPrice = b1Commit?.max_unit_price ?? 2.0;
  const negotiatedPrice = b1Commit?.offer?.tierUnitPrice ?? originalPrice;
  const qty = b1Commit?.qty ?? 10;
  const clusterSize = b1Commit?.clusterSize ?? 1;
  const savedPerUnit = originalPrice - negotiatedPrice;
  const savedTotal = savedPerUnit * qty * clusterSize;
  const discountPct = originalPrice > 0 ? ((savedPerUnit / originalPrice) * 100).toFixed(0) : "0";

  return (
    <div className="glass-panel" style={{ position: 'relative', height: '420px', marginBottom: '2rem', background: '#020205', border: '1px solid rgba(6,182,212,0.2)', display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <div style={{ position: 'absolute', top: '12px', left: '16px', zIndex: 10 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '2px' }}>
            AXL P2P Mesh — Live Topology
          </div>
          <div style={{ fontSize: '0.6rem', color: '#555', marginTop: '2px' }}>
            {topology ? `Node: ${ourKey.slice(0, 12)}… | ${peers.length} peers connected` : "Connecting to AXL node..."}
          </div>
        </div>

        <svg viewBox="0 0 400 400" style={{ width: '100%', height: '100%' }}>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(6,182,212,0.06)" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="400" height="400" fill="url(#grid)"/>

          {allNodes.slice(1).map((peer, i) => (
            <g key={`line-${i}`}>
              <line x1={allNodes[0].x} y1={allNodes[0].y} x2={peer.x} y2={peer.y}
                stroke={peer.up ? peer.color : "#333"} strokeWidth={isActive ? 2 : 1}
                strokeDasharray={isActive ? "none" : "4 4"} opacity={peer.up ? (isActive ? 0.8 : 0.4) : 0.2}/>
              {isActive && peer.up && (
                <>
                  <circle r="3" fill={peer.color} opacity="0.8">
                    <animateMotion dur="2s" repeatCount="indefinite" path={`M${allNodes[0].x},${allNodes[0].y} L${peer.x},${peer.y}`}/>
                  </circle>
                </>
              )}
            </g>
          ))}

          {allNodes.slice(1).map((a, i) =>
            allNodes.slice(i + 2).map((b, j) => (
              <line key={`pp-${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="rgba(168,85,247,0.15)" strokeWidth="1" strokeDasharray="2 6"/>
            ))
          )}

          {allNodes.map((node, i) => (
            <g key={`node-${i}`}>
              <circle cx={node.x} cy={node.y} r="30" fill="rgba(6,182,212,0.05)" opacity={isActive ? 1 : 0.3}/>
              <circle cx={node.x} cy={node.y} r={node.isSelf ? 20 : 16}
                fill="rgba(0,0,0,0.8)" stroke={node.color} strokeWidth="2"
                style={{ filter: isActive ? `drop-shadow(0 0 8px ${node.color})` : 'none' }}/>
              <text x={node.x} y={node.y + 1} textAnchor="middle" dominantBaseline="central"
                fill="#fff" fontSize="7" fontWeight="bold" fontFamily="monospace">
                {node.key?.slice(0, 6) ?? "..."}
              </text>
              <text x={node.x} y={node.y + 35} textAnchor="middle"
                fill={node.color} fontSize="8" fontWeight="600" fontFamily="monospace">
                {node.label}
              </text>
              {node.up && isActive && (
                <circle cx={node.x + 18} cy={node.y - 14} r="4" fill="#10b981">
                  <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite"/>
                </circle>
              )}
            </g>
          ))}

          <text x="200" y="385" textAnchor="middle" fill="#555" fontSize="8" fontFamily="monospace" fontWeight="700" letterSpacing="2">
            {isIdle ? "STANDBY" : isSettled ? "SETTLEMENT COMPLETE" : "PROTOCOL ACTIVE"}
          </text>
        </svg>
      </div>

      <div style={{ width: '220px', borderLeft: '1px solid rgba(6,182,212,0.15)', padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1rem' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.5rem' }}>
          Coalition Savings
        </div>

        <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#10b981', lineHeight: 1 }}>
            {savedTotal > 0 ? `$${savedTotal.toFixed(2)}` : "—"}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#71717a', marginTop: '4px' }}>Total Savings</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#06b6d4' }}>{discountPct}%</div>
            <div style={{ fontSize: '0.55rem', color: '#666' }}>Discount</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#eab308' }}>{clusterSize}</div>
            <div style={{ fontSize: '0.55rem', color: '#666' }}>Buyers</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f43f5e', textDecoration: savedPerUnit > 0 ? 'line-through' : 'none' }}>${originalPrice.toFixed(2)}</div>
            <div style={{ fontSize: '0.55rem', color: '#666' }}>Retail</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>${negotiatedPrice.toFixed(2)}</div>
            <div style={{ fontSize: '0.55rem', color: '#666' }}>Huddle</div>
          </div>
        </div>

        <div style={{ fontSize: '0.6rem', color: '#444', lineHeight: 1.5, marginTop: '0.5rem' }}>
          {b1Commit?.statusStr ?? "Waiting for intent submission..."}
        </div>
      </div>
    </div>
  );
}



export default function Dashboard() {
  const [activeTab, setActiveTab] = useState(AGENTS[0]);
  const [agentsState, setAgentsState] = useState<any>({
    buyer1: null, buyer2: null, buyer3: null, seller: null
  });
  
  const [sku, setSku] = useState("h100-pcie-hour");
  const [maxPrice, setMaxPrice] = useState(1.5);
  const [qty, setQty] = useState(10);
  const [simulating, setSimulating] = useState(false);
  const [keeperRunning, setKeeperRunning] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);

  useEffect(() => {
    // Poll all 4 agents natively for a unified network view
    const p = setInterval(async () => {
      const states: any = {};
      for (const ag of AGENTS) {
        try {
          const data = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("GET", `http://localhost:${ag.port}/status`);
            xhr.onload = () => {
              try { resolve(JSON.parse(xhr.responseText)); } 
              catch(e) { reject(e); }
            };
            xhr.onerror = () => reject(new Error("Network Error"));
            xhr.send();
          });
          states[ag.id] = data;
        } catch {
          states[ag.id] = null;
        }
      }
      setAgentsState(states);
    }, 1500);
    return () => clearInterval(p);
  }, []);

  // Track global progress to trigger confetti once when Payment is actually Complete
  useEffect(() => {
    if (paymentComplete && !window.sessionStorage.getItem("confettiDone")) {
       confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } });
       window.sessionStorage.setItem("confettiDone", "true");
    }
  }, [paymentComplete]);

  // ⚡ INDEPENDENT KEEPER WATCHER — fires whenever ANY path (manual or auto) hits "Settled"
  useEffect(() => {
    const b1 = agentsState.buyer1?.myCommits?.[0];
    const isSettled = b1?.statusStr?.includes("Settled");
    const hasAddress = !!b1?.address;
    const alreadyDone = paymentComplete || keeperRunning || window.sessionStorage.getItem("keeperFired");

    if (isSettled && hasAddress && !alreadyDone) {
      window.sessionStorage.setItem("keeperFired", "true");
      setKeeperRunning(true);
      console.log("[Keeper Watcher] Detected settled coalition. Auto-firing keeper for:", b1.address);

      fetch("/api/keeper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: b1.address }),
      })
        .then(r => r.json())
        .then(data => {
          console.log("[Keeper] Result:", data);
          setKeeperRunning(false);
          setPaymentComplete(true);
        })
        .catch(err => {
          console.error("[Keeper] Error:", err);
          setKeeperRunning(false);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentsState]);

  // Unified auto-simulate function
  const startSimulation = async () => {
    window.sessionStorage.removeItem("confettiDone");
    window.sessionStorage.removeItem("keeperFired");
    setSimulating(true);
    setKeeperRunning(false);
    setPaymentComplete(false);

    const intent = { sku, max_unit_price: maxPrice, qty, deadline_ms: Date.now() + 24 * 3600 * 1000 };
    
    try {
      // 1. Submit Buyer 1
      await fetch(`http://localhost:3001/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(intent) });
      
      // 2. Wait 3s, submit Buyer 2 (Simulating decentralized discovery)
      await new Promise(r => setTimeout(r, 3000));
      await fetch(`http://localhost:3002/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(intent) });
      
      // 3. Wait 3s, submit Buyer 3 -> This triggers k=3 logic!
      await new Promise(r => setTimeout(r, 3000));
      await fetch(`http://localhost:3003/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(intent) });
      
      // 4. Poll for Coalition Address explicitly to Trigger Keeper
      let deployedAddr = null;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const res = await fetch(`http://localhost:3001/status`);
        const status = await res.json();
        const commit = status.myCommits?.[0];
        if (commit?.address && commit?.statusStr.includes("Settled")) {
           deployedAddr = commit.address;
           break;
        }
      }

      if (deployedAddr) {
         setKeeperRunning(true);
         const kResp = await fetch(`/api/keeper`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: deployedAddr }) });
         const kData = await kResp.json();
         console.log("Keeper Execution Log:", kData);
         setKeeperRunning(false);
         setPaymentComplete(true);
      }
    } catch(e) {
      console.log(e);
    }
    setSimulating(false);
  };

  const getGlobalState = () => {
     // deduce global state from Buyer 1's perspective
     const c = agentsState.buyer1?.myCommits?.[0];
     if (!c) return "idle";
     if (paymentComplete) return "paid";
     if (c.statusStr.includes("Settled")) return "settled";
     if (c.statusStr.includes("Deploying Coalition")) return "deploying";
     if (c.offer) return "negotiated";
     if (c.clusterSize === 3) return "revealing";
     return "broadcasting"; // k=1 or 2
  };

  const gState = getGlobalState();

  const renderAgentWorkflow = () => {
     // Determine active stage based on gState
     const stageIndex = 
        paymentComplete ? 5 : 
        gState === "settled" ? 4 : 
        gState === "deploying" ? 3 : 
        gState === "negotiated" ? 2 : 
        (gState === "revealing" || gState === "broadcasting" && agentsState.buyer1?.myCommits?.[0]) ? 1 : 0;

     const WorkflowNode = ({ title, icon: Icon, sub, active, done, delay }: any) => (
        <div className={`workflow-node ${active ? 'active-node' : done ? 'done-node' : 'pending-node'} animate-fade-in`} style={{ animationDelay: delay, display: 'flex', flexDirection: 'column', width: '140px', flexShrink: 0, background: active ? 'rgba(99, 102, 241, 0.15)' : 'var(--card-bg)', border: `1px solid ${active ? '#6366f1' : done ? '#10b981' : 'var(--card-border)'}`, borderRadius: '10px', padding: '0.75rem', position: 'relative', zIndex: 2, transition: 'all 0.3s', boxShadow: active ? '0 0 20px rgba(99, 102, 241, 0.3)' : 'none' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ background: active ? '#6366f1' : done ? '#10b981' : '#3f3f46', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}>
                 <Icon size={16} color="#ffffff" />
              </div>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: active || done ? '#fff' : '#a1a1aa' }}>{title}</span>
           </div>
           <p style={{ fontSize: '0.75rem', color: '#a1a1aa', lineHeight: 1.4 }}>{sub}</p>
        </div>
     );

     const Connector = ({ active, done }: any) => (
        <div style={{ flex: 1, height: '2px', background: done ? '#10b981' : 'var(--card-border)', position: 'relative', minWidth: '30px' }}>
           {active && <div className="pulse-line" style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '100%', background: 'linear-gradient(90deg, transparent, #6366f1, transparent)', animation: 'slide-right 1.5s infinite linear' }} />}
        </div>
     );

     return (
        <div style={{ width: '100%', background: '#0a0a0f', borderRadius: '16px', border: '1px solid var(--card-border)', padding: '2rem 1.5rem', marginBottom: '2rem', overflowX: 'auto' }}>
           <style dangerouslySetInnerHTML={{__html: `
              @keyframes slide-right { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
              .workflow-node { box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
              .active-node { transform: translateY(-4px); }
           `}} />
           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: '620px' }}>
              <WorkflowNode title="1. Buyer Node" icon={Play} sub="Local Agent signs bulk-buying intent locally." done={stageIndex > 0} active={stageIndex === 1} delay="0s" />
              <Connector done={stageIndex > 1} active={stageIndex === 1} />
              <WorkflowNode title="2. P2P Mesh (k=3)" icon={Activity} sub="AXL Encrypted Tunnel discovers & groups peers." done={stageIndex > 1} active={stageIndex === 2} delay="0.1s" />
              <Connector done={stageIndex > 2} active={stageIndex === 2} />
              <WorkflowNode title="3. Seller Algorithm" icon={CheckCircle2} sub="Daemon dynamically evaluates demand & sets tier." done={stageIndex > 2} active={stageIndex === 3} delay="0.2s" />
              <Connector done={stageIndex > 3} active={stageIndex === 3} />
              <WorkflowNode title="4. Gensyn L2" icon={Network} sub="Agent deploys Smart Contract & funds escrow." done={stageIndex > 3} active={stageIndex === 4} delay="0.3s" />
              <Connector done={stageIndex > 4} active={stageIndex === 4} />
              <WorkflowNode title="5. KeeperHub" icon={Zap} sub="Node triggers payload sweeping funds to Seller." done={stageIndex >= 5} active={stageIndex === 5 && keeperRunning} delay="0.4s" />
           </div>
           <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: '#71717a', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
             Cryptography Workflow Architecture [Live Telemetry Tracking]
           </div>
        </div>
     );
  };



  const renderActiveTabContent = () => {
    const agState = agentsState[activeTab.id];
    const commit = agState?.myCommits?.[0]; // works for buyers
    const b1Commit = agentsState.buyer1?.myCommits?.[0]; // read source of truth for Seller UI

    // SELLER DASHBOARD ENRICHMENT
    if (activeTab.type === "seller") {
       const isSelling = gState === "negotiated" || gState === "deploying" || gState === "settled" || gState === "paid";
       return (
          <section className="glass-panel animate-fade-in animate-delay-1">
             <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>Dynamic Tier Evaluation</h2>
             {!isSelling ? (
                <div style={{ textAlign: 'center', color: '#a1a1aa', padding: '2rem 0' }}>
                  <p>Awaiting valid bulk coalition signals on encrypted AXL mesh...</p>
                  {agState && <p style={{color: '#6366f1', marginTop: '1rem', fontStyle: 'italic'}}>Listening natively on {agState.axl}</p>}
                </div>
             ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                   <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid #10b981', borderRadius: '12px', padding: '1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                         <CheckCircle2 color="#10b981" />
                         <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>Coalition Request Received & Evaluated</h3>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', color: '#e4e4e7', fontFamily: 'monospace' }}>
                        <p>&gt; Evaluated Total Requested Qty: <b>30 Units</b></p>
                        <p>&gt; Base Retail Price: <b>$2.00 / hr</b></p>
                        <p>&gt; Tier 2 Volume Threshold Met (&gt;= 30 units)</p>
                        <p>&gt; Applied Vendor Discount: <b>-25%</b></p>
                        <div style={{ marginTop: '1rem', padding: '1rem', background: '#000', borderRadius: '6px' }}>
                           <p style={{ color: '#10b981', fontSize: '1.2rem', fontWeight: 'bold' }}>FINAL BINDING OFFER: $1.50 / hr</p>
                           <p style={{ color: '#a1a1aa', fontSize: '0.8rem', marginTop: '0.5rem' }}>Emitted NegotiateResponse via AXL P2P P2P tunnel.</p>
                        </div>
                      </div>
                   </div>

                   {/* Add seller receiving payment visualization explicitly requested */}
                   {paymentComplete && b1Commit && (
                     <div className="animate-fade-in" style={{ background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(16, 185, 129, 0.2))', border: '1px solid #38bdf8', borderRadius: '12px', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                           <span style={{ background: '#38bdf8', color: '#000', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>PAYMENT RECEIVED</span>
                        </div>
                        <div style={{ color: '#fff', fontSize: '1.1rem' }}>
                          <p>The Keeper successfully committed the Coalition Smart Contract logic.</p>
                          <p style={{ marginTop: '0.5rem', fontWeight: 'bold', fontSize: '1.5rem' }}>Funds Swept: <span style={{color: '#10b981'}}>+(30 units * $1.50) = $45.00 USDC</span></p>
                          <p style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.5rem' }}>View transaction output on Gensyn L2: {b1Commit.address}</p>
                        </div>
                     </div>
                   )}
                </div>
             )}
          </section>
       );
    }

    // BUYER DASHBOARD
    return (
      <>
        {!commit && (
          <section className="glass-panel animate-fade-in animate-delay-1">
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>Start Network Sequence</h2>
            <p style={{ color: '#a1a1aa', marginBottom: '2rem' }}>Configure the target constraints. Clicking 'Run Autonomous Sequence' will background-submit intents across independent decentralized nodes to trigger threshold mechanics.</p>
            
            <div className="form-grid" style={{ marginBottom: '2rem' }}>
              <div className="input-group">
                <label>SKU (Product ID)</label>
                <input type="text" value={sku} onChange={e => setSku(e.target.value)} required />
              </div>
              <div className="input-group">
                <label>Maximum Unit Price ($)</label>
                <input type="number" step="0.01" value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value))} required />
              </div>
              <div className="input-group">
                <label>Quantity</label>
                <input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} required />
              </div>
            </div>

            <button onClick={startSimulation} className="cta-button" disabled={simulating || keeperRunning} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%' }}>
              {(simulating || keeperRunning) ? <Activity className="animate-spin" size={20} /> : <Play size={20} />}
              {keeperRunning ? "KeeperHub executing on-chain payment Commit..." : (simulating ? "Mesh Agents Executing..." : "Run Autonomous End-to-End Sequence")}
            </button>
          </section>
        )}

        {commit && (
           <section className="animate-fade-in animate-delay-2">
             <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>Final Execution Receipt & State</h2>
             
             {/* Final Finished View */}
             {(gState === "settled" || gState === "paid") ? (
               <div style={{ background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.1) 0%, rgba(0,0,0,0) 100%)', border: '1px solid #10b981', borderRadius: '16px', padding: '2rem' }}>
                 <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ background: '#10b981', color: '#fff', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                      {keeperRunning ? <Activity className="animate-spin" size={24}/> : <CheckCircle2 size={32} />}
                    </div>
                    <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981' }}>{paymentComplete ? "Purchase & Payment Complete!" : "Contract Settled, Awaiting Keeper..."}</h2>
                    <p style={{ color: '#a1a1aa' }}>{paymentComplete ? "The KeeperHub swept your escrow, deployed the contract, transferred funds to the Seller, and finalized your decentralized order." : "Coalition threshold met. Waiting for autonomous Keeper script to execute the payment."}</p>
                 </div>

                 <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '12px', padding: '1.5rem', fontFamily: 'monospace' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333', paddingBottom: '1rem', marginBottom: '1rem' }}>
                     <span style={{ color: '#a1a1aa' }}>Ordered Item</span>
                     <span style={{ fontWeight: 600, color: '#fff' }}>{commit.sku}</span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333', paddingBottom: '1rem', marginBottom: '1rem' }}>
                     <span style={{ color: '#a1a1aa' }}>Order Qty</span>
                     <span style={{ fontWeight: 600, color: '#fff' }}>{commit.qty} Units</span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333', paddingBottom: '1rem', marginBottom: '1rem' }}>
                     <span style={{ color: '#a1a1aa' }}>Unit Price (Original)</span>
                     <span style={{ fontWeight: 600, color: '#f43f5e', textDecoration: 'line-through' }}>$2.00</span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '1rem' }}>
                     <span style={{ color: '#a1a1aa' }}>Unit Price (Auto-Negotiated)</span>
                     <span style={{ fontWeight: 800, color: '#10b981', fontSize: '1.25rem' }}>${commit.offer?.tierUnitPrice?.toFixed(2)}</span>
                   </div>
                 </div>

                 <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <a href={`https://gensyn-mainnet.explorer.alchemy.com/address/${commit.address}`} target="_blank" rel="noreferrer" style={{ display: 'block', padding: '1rem', background: 'rgba(99,102,241,0.1)', border: '1px solid #6366f1', borderRadius: '8px', color: '#818cf8', textDecoration: 'none', textAlign: 'center', fontWeight: 'bold' }}>
                       View Coalition on Gensyn L2 Explorer →
                    </a>
                    <a href="#" style={{ display: 'block', padding: '1rem', background: 'rgba(56,189,248,0.1)', border: '1px solid #38bdf8', borderRadius: '8px', color: '#7dd3fc', textDecoration: 'none', textAlign: 'center', fontWeight: 'bold' }}>
                       Verify Buyer Preferences zeroG Storage iNFT →
                    </a>
                 </div>
               </div>
             ) : (
               <div className="glass-panel status-card border-glow">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{commit.sku}</h3>
                    <span className="status-badge badge-forming animate-pulse">{commit.statusStr}</span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#a1a1aa', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                    <p>Mesh Members Confirmed: {commit.clusterSize} / 3</p>
                    <p>Target Qty: {commit.qty}</p>
                    <p>Constraints: Max ${commit.max_unit_price.toFixed(2)}</p>
                    {commit.offer && (
                        <p style={{ color: '#10b981', fontWeight: 600 }}>Discount Evaluated: ${commit.offer.tierUnitPrice.toFixed(2)}</p>
                    )}
                  </div>
               </div>
             )}
           </section>
        )}
      </>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw' }}>
      {/* Sidebar */}
      <aside style={{ width: '250px', background: 'rgba(255,255,255,0.02)', borderRight: '1px solid var(--card-border)', padding: '2rem 1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '2rem', paddingLeft: '1rem', background: 'linear-gradient(135deg, var(--foreground), var(--primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Huddle Network
        </h2>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {AGENTS.map(agent => (
            <button 
              key={agent.id}
              onClick={() => setActiveTab(agent)}
              style={{
                background: activeTab.id === agent.id ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                border: `1px solid ${activeTab.id === agent.id ? 'var(--primary)' : 'transparent'}`,
                color: activeTab.id === agent.id ? 'var(--primary)' : 'var(--foreground)',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                textAlign: 'left',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {agent.name} {agentsState[agent.id]?.myCommits?.[0] ? "🟢" : ""}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content & Terminal Layout Container */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* Center Canvas */}
        <main className="container" style={{ flex: 1, paddingRight: '2rem', overflowY: 'auto', maxHeight: '100vh' }}>
          <div className="bg-blobs">
            <div className="blob blob-1"></div>
            <div className="blob blob-2"></div>
          </div>
          
          <header className="header animate-fade-in" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 className="header-title">{activeTab.name} View</h1>
              <div className="agent-info" style={{ color: '#a1a1aa', fontWeight: 500, marginTop: '0.5rem' }}>
                {agentsState[activeTab.id] ? (
                   <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                     <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span> 
                     Agent Sync Active (Port: {activeTab.port})
                   </span>
                ) : (
                   <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                     <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#f43f5e' }}></span> 
                     Agent Offline
                   </span>
                )}
              </div>
            </div>
          </header>

          {renderAgentWorkflow()}
          <LiveTopologyGraph gState={gState} agentsState={agentsState} />
          {renderActiveTabContent()}

        </main>

        {/* Right Sidebar - Interactive Terminal */}
        <TerminalPanel
          activeTab={activeTab}
          agentState={agentsState[activeTab.id]}
          paymentComplete={paymentComplete}
          onReset={() => { setPaymentComplete(false); setSimulating(false); setKeeperRunning(false); }}
        />

      </div>
    </div>
  );
}

// ─── Terminal Panel Component ─────────────────────────────────────────────────
function TerminalPanel({ activeTab, agentState, paymentComplete, onReset }: any) {
  const [agentRunning, setAgentRunning] = useState(false);
  const [localSku, setLocalSku] = useState("h100-pcie-hour");
  const [localPrice, setLocalPrice] = useState("1.5");
  const [localQty, setLocalQty] = useState("10");
  const [posting, setPosting] = useState(false);
  const [cmdLog, setCmdLog] = useState<string[]>([]);
  const logsEndRef = (el: HTMLDivElement | null) => el?.scrollIntoView({ behavior: "smooth" });

  const addLog = (msg: string) => setCmdLog(prev => [...prev.slice(-49), `[${new Date().toISOString().substring(11, 19)}] ${msg}`]);

  const handleStartAgent = async () => {
    setAgentRunning(true);
    addLog(`$ Spawning daemon for ${activeTab.name} on port ${activeTab.port}...`);
    try {
      const res = await fetch("/api/spawn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: activeTab.id, port: activeTab.port, type: activeTab.type })
      });
      const data = await res.json();
      if (data.success) addLog(`✓ Agent daemon started. PID: ${data.pid ?? "OK"}`);
      else { addLog(`✗ Failed: ${data.error}`); setAgentRunning(false); }
    } catch(e) {
      addLog(`✗ API error: ${(e as Error).message}`);
      setAgentRunning(false);
    }
  };

  const handleStopAgent = async () => {
    addLog(`$ Sending SIGTERM to ${activeTab.name} daemon (port ${activeTab.port})...`);
    try {
      await fetch("/api/spawn", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port: activeTab.port })
      });
      addLog(`✓ Agent stopped.`);
      setAgentRunning(false);
    } catch(e) {
      addLog(`✗ Stop failed: ${(e as Error).message}`);
    }
  };

  const handlePostIntent = async () => {
    if (!agentState) { addLog("✗ Agent offline — start it first."); return; }
    setPosting(true);
    const intent = { sku: localSku, max_unit_price: Number(localPrice), qty: Number(localQty), deadline_ms: Date.now() + 24 * 3600 * 1000 };
    addLog(`$ POST http://localhost:${activeTab.port}/submit`);
    addLog(`  body: ${JSON.stringify(intent)}`);
    try {
      const res = await fetch(`http://localhost:${activeTab.port}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(intent)
      });
      const data = await res.json();
      if (data.success) addLog(`✓ Intent accepted by agent. Propagating to AXL mesh...`);
      else addLog(`✗ Agent rejected: ${JSON.stringify(data)}`);
    } catch(e) {
      addLog(`✗ Fetch error: ${(e as Error).message}`);
    }
    setPosting(false);
  };

  const handleReset = () => {
    addLog("$ Clearing session state. Ready for new round.");
    window.sessionStorage.removeItem("confettiDone");
    window.sessionStorage.removeItem("keeperFired");
    onReset();
  };

  const isOnline = !!agentState;
  const isBuyer = activeTab.type === "buyer";
  const daemonLogs: string[] = agentState?.logs ?? [];
  const combinedLogs = [...cmdLog, ...daemonLogs];

  return (
    <aside style={{ width: '420px', background: '#030305', borderLeft: '1px solid #1f1f2e', display: 'flex', flexDirection: 'column', height: '100vh', boxShadow: '-10px 0 30px rgba(0,0,0,0.6)' }}>
      {/* Title bar */}
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #1f1f2e', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#f43f5e' }}></div>
            <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#eab308' }}></div>
            <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#10b981' }}></div>
          </div>
          <span style={{ color: '#8b8b99', fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 700, marginLeft: '4px' }}>
            {activeTab.name.toUpperCase()} // LIVE CONSOLE
          </span>
        </div>
        <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', padding: '2px 8px', borderRadius: '4px', background: isOnline ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)', color: isOnline ? '#10b981' : '#f43f5e', border: `1px solid ${isOnline ? '#10b981' : '#f43f5e'}` }}>
          {isOnline ? "● ONLINE" : "○ OFFLINE"}
        </span>
      </div>

      {/* Agent controls */}
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #1f1f2e', background: '#05050a', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {!isOnline ? (
          <button onClick={handleStartAgent} style={{ flex: 1, padding: '0.5rem', background: 'rgba(99,102,241,0.15)', border: '1px solid #6366f1', color: '#818cf8', borderRadius: '6px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700 }}>
            ▶ Start Agent
          </button>
        ) : (
          <button onClick={handleStopAgent} style={{ flex: 1, padding: '0.5rem', background: 'rgba(244,63,94,0.1)', border: '1px solid #f43f5e', color: '#fb7185', borderRadius: '6px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700 }}>
            ■ Stop Agent
          </button>
        )}
        {paymentComplete && (
          <button onClick={handleReset} style={{ flex: 1, padding: '0.5rem', background: 'rgba(234,179,8,0.1)', border: '1px solid #eab308', color: '#facc15', borderRadius: '6px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700 }}>
            ↺ New Round
          </button>
        )}
      </div>

      {/* Live log stream */}
      <div style={{ flex: 1, padding: '0.75rem 1rem', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.6, color: '#10b981' }}>
        {combinedLogs.length === 0 && (
          <p style={{ color: '#555', fontStyle: 'italic' }}>Awaiting daemon output...</p>
        )}
        {combinedLogs.map((log, idx) => (
          <div key={idx} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginBottom: '4px', color: log.startsWith("[") ? '#10b981' : '#a3e635' }}>
            <span style={{ color: '#0ea5e9', marginRight: '6px' }}>{">"}</span>{log}
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>

      {/* Intent Command Input (buyers only) */}
      {isBuyer && (
        <div style={{ padding: '1rem', borderTop: '1px solid #1f1f2e', background: '#0a0a0f', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <p style={{ color: '#555', fontSize: '0.7rem', fontFamily: 'monospace', marginBottom: '0.25rem' }}>$ post_intent --agent {activeTab.id}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
            <input value={localSku} onChange={e => setLocalSku(e.target.value)} placeholder="SKU" style={{ background: '#111', border: '1px solid #333', color: '#10b981', borderRadius: '4px', padding: '0.4rem', fontFamily: 'monospace', fontSize: '0.72rem' }} />
            <input value={localPrice} onChange={e => setLocalPrice(e.target.value)} type="number" placeholder="Max $" style={{ background: '#111', border: '1px solid #333', color: '#10b981', borderRadius: '4px', padding: '0.4rem', fontFamily: 'monospace', fontSize: '0.72rem' }} />
            <input value={localQty} onChange={e => setLocalQty(e.target.value)} type="number" placeholder="Qty" style={{ background: '#111', border: '1px solid #333', color: '#10b981', borderRadius: '4px', padding: '0.4rem', fontFamily: 'monospace', fontSize: '0.72rem' }} />
          </div>
          <button onClick={handlePostIntent} disabled={posting || !isOnline} style={{ padding: '0.5rem', background: posting ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.15)', border: '1px solid #10b981', color: '#10b981', borderRadius: '6px', cursor: isOnline ? 'pointer' : 'not-allowed', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700 }}>
            {posting ? "Posting..." : "$ post intent →"}
          </button>
        </div>
      )}
    </aside>
  );
}

// Mini inner component for the graph graphic
function MeshNode({ label, active, right, x, y, isSeller = false }: any) {
   return (
      <div style={{ position: 'absolute', [right ? 'right' : 'left']: `${x}px`, top: `${y}px`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
         <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: isSeller ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)', border: `2px solid ${active ? (isSeller ? '#10b981' : '#6366f1') : '#333'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.5s', boxShadow: active ? `0 0 15px ${isSeller ? '#10b981' : '#6366f1'}` : 'none' }}>
           <span style={{ fontSize: '0.75rem' }}>{isSeller ? "S" : "B"}</span>
         </div>
         <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: active ? '#fff' : '#666', fontWeight: active ? 'bold' : 'normal' }}>{label}</span>
      </div>
   )
}
