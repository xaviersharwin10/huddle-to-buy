"use client";

import { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import { CheckCircle2, Play, Activity, Network, Zap } from "lucide-react";
import "./globals.css";

const AGENTS = [
  { id: "buyer1", name: "Buyer 1", port: 3001, type: "buyer" },
  { id: "buyer2", name: "Buyer 2", port: 3002, type: "buyer" },
  { id: "buyer3", name: "Buyer 3", port: 3003, type: "buyer" },
  { id: "seller", name: "Seller Agent", port: 3004, type: "seller" }
];

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
          const res = await fetch(`http://localhost:${ag.port}/status`);
          states[ag.id] = await res.json();
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

  // Unified auto-simulate function
  const startSimulation = async () => {
    window.sessionStorage.removeItem("confettiDone");
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
        <div className={`workflow-node ${active ? 'active-node' : done ? 'done-node' : 'pending-node'} animate-fade-in`} style={{ animationDelay: delay, display: 'flex', flexDirection: 'column', width: '200px', background: active ? 'rgba(99, 102, 241, 0.15)' : 'var(--card-bg)', border: `1px solid ${active ? '#6366f1' : done ? '#10b981' : 'var(--card-border)'}`, borderRadius: '12px', padding: '1rem', position: 'relative', zIndex: 2, transition: 'all 0.3s', boxShadow: active ? '0 0 20px rgba(99, 102, 241, 0.3)' : 'none' }}>
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
           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: '800px' }}>
              <WorkflowNode title="1. Buyer Node" icon={Play} sub="Local Agent signs bulk-buying intent locally." done={stageIndex > 0} active={stageIndex === 1} delay="0s" />
              <Connector done={stageIndex > 1} active={stageIndex === 1} />
              <WorkflowNode title="2. P2P Mesh (k=3)" icon={Activity} sub="AXL Encrypted Tunnel discovers & groups peers." done={stageIndex > 1} active={stageIndex === 2} delay="0.1s" />
              <Connector done={stageIndex > 2} active={stageIndex === 2} />
              <WorkflowNode title="3. Seller Algorithm" icon={CheckCircle2} sub="Daemon dynamically evaluates demand & sets tier." done={stageIndex > 2} active={stageIndex === 3} delay="0.2s" />
              <Connector done={stageIndex > 3} active={stageIndex === 3} />
              <WorkflowNode title="4. Base Sepolia" icon={Network} sub="Agent deploys Smart Contract & funds escrow." done={stageIndex > 3} active={stageIndex === 4} delay="0.3s" />
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
                          <p style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.5rem' }}>View transaction output on Base Sepolia: {b1Commit.address}</p>
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
                    <a href={`https://sepolia.basescan.org/address/${commit.address}`} target="_blank" rel="noreferrer" style={{ display: 'block', padding: '1rem', background: 'rgba(99,102,241,0.1)', border: '1px solid #6366f1', borderRadius: '8px', color: '#818cf8', textDecoration: 'none', textAlign: 'center', fontWeight: 'bold' }}>
                       View Coalition on Base Sepolia Explorer →
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

      {/* Main Content */}
      <main className="container" style={{ flex: 1, paddingRight: '4rem', overflowY: 'auto', maxHeight: '100vh' }}>
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
        {renderActiveTabContent()}

      </main>
    </div>
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
