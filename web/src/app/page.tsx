"use client";

import { useState, useEffect } from "react";
import "./globals.css";

export default function Dashboard() {
  const [sku, setSku] = useState("h100-pcie-hour");
  const [maxPrice, setMaxPrice] = useState(1.5);
  const [qty, setQty] = useState(10);
  const [deadlineHours, setDeadlineHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<any>(null);
  const [intents, setIntents] = useState<any[]>([]);

  useEffect(() => {
    // Poll agent status on mount
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch("http://localhost:3001/status");
      const data = await res.json();
      setAgentStatus(data);
    } catch (e) {
      // API Offline
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const intent = {
        sku,
        max_unit_price: maxPrice,
        qty,
        deadline_ms: Date.now() + deadlineHours * 3600 * 1000
      };

      const res = await fetch("http://localhost:3001/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intent)
      });
      
      if (res.ok) {
        setIntents(prev => [{...intent, status: "broadcasting"}, ...prev]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>
      
      <main className="container">
        <header className="header animate-fade-in">
          <h1 className="header-title">Huddle Dashboard</h1>
          <div className="agent-info" style={{ color: '#a1a1aa', fontWeight: 500 }}>
            {agentStatus ? (
               <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span> 
                 Agent Online (AXL Node: {agentStatus.axl})
               </span>
            ) : (
               <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#f43f5e' }}></span> 
                 Agent Offline
               </span>
            )}
          </div>
        </header>

        <section className="glass-panel animate-fade-in animate-delay-1">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>Submit Purchase Intent</h2>
          <form className="form-grid" onSubmit={handleSubmit}>
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

            <div className="input-group">
              <label>Deadline (Hours)</label>
              <input type="number" value={deadlineHours} onChange={e => setDeadlineHours(Number(e.target.value))} required />
            </div>

            <div className="input-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" className="cta-button" disabled={loading || !agentStatus}>
                {loading ? "Matching..." : "Submit to Mesh"}
              </button>
            </div>
          </form>
        </section>

        <section className="animate-fade-in animate-delay-2">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>Active Intents & Coalitions</h2>
          
          {intents.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', color: '#a1a1aa', padding: '3rem 0' }}>
              No active intents. Submit an intent above to form a coalition.
            </div>
          ) : (
            <div className="status-grid">
              {intents.map((intent, i) => (
                <div key={i} className="glass-panel status-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{intent.sku}</h3>
                    <span className="status-badge badge-forming">Discovering Mesh</span>
                  </div>
                  
                  <div style={{ fontSize: '0.875rem', color: '#a1a1aa', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
                    <p>Qty: {intent.qty}</p>
                    <p>Max Price: ${intent.max_unit_price.toFixed(2)}</p>
                    <p>Expiry: {new Date(intent.deadline_ms).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
