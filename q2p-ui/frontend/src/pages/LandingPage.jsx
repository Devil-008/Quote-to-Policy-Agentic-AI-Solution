import { Link } from 'react-router-dom'

const FEATURES = [
  { icon: '🤖', title: 'Multi-Agent AI',         desc: 'LangGraph-powered orchestration with 8 specialized agents handling every workflow stage automatically.' },
  { icon: '⚡', title: '15-Stage Workflow',       desc: 'End-to-end automation from customer intake to policy issuance with HITL checkpoints at critical stages.' },
  { icon: '🔒', title: 'OTP Consent',             desc: 'Secure SHA-256 hashed OTP flow with 10-min expiry, retry limits, and full audit trail.' },
  { icon: '📊', title: 'Multi-Insurer Quotes',    desc: 'Concurrent quote retrieval from HDFC Life, LIC, and ICICI Prudential with AI-powered ranking.' },
  { icon: '🧠', title: 'RAG Knowledge Base',      desc: 'Local ChromaDB + ArangoDB graph retrieval with multi-turn conversational memory.' },
  { icon: '🚨', title: 'Smart Escalations',       desc: 'Auto-escalate stale workflows every 10 minutes with SMTP notifications to the right persona.' },
  { icon: '🏥', title: 'Medical Coordination',    desc: 'Document upload + ops review workflow for medical underwriting requirements.' },
  { icon: '✅', title: 'Compliance Engine',        desc: 'Exception detection, consent verification, audit logs, and compliance scoring dashboard.' },
]

const PERSONAS = [
  { role: 'Super Admin',  color: '#8b5cf6', desc: 'Platform config, users, audit logs, knowledge base management.' },
  { role: 'Banker / RM',  color: '#6366f1', desc: 'Create cases, compare quotes, approve recommendations, track workflow.' },
  { role: 'Customer',     color: '#2dd4bf', desc: 'View recommendations, give OTP consent, upload documents, track policy.' },
  { role: 'Underwriter',  color: '#f59e0b', desc: 'Review proposals, raise queries, approve or reject policies.' },
  { role: 'Compliance',   color: '#22c55e', desc: 'Audit logs, exception reports, consent records, compliance scores.' },
  { role: 'Ops Admin',    color: '#f97316', desc: 'Medical queue, document verification, SLA monitoring, escalations.' },
]

const STAGES = [
  'Customer Intake','Needs Analysis','Suitability Check','Quote Retrieval',
  'Quote Comparison','Recommendation','Banker Approval','OTP Consent',
  'Proposal Gen','Medical Coord','Underwriting','Policy Issuance',
  'Exception Handling','Escalation','Completed',
]

const AGENTS = [
  ['Orchestrator',         'Main workflow controller with shared state and HITL checkpoints'],
  ['Profile & Needs',      'Customer profiling, financial analysis, risk assessment'],
  ['Suitability & Rules',  'Product eligibility, compliance validation, rule engine'],
  ['Quote Retrieval',      'Concurrent multi-insurer quote aggregation & normalization'],
  ['Comparison & Explain', 'AI-powered quote ranking, tradeoff analysis, recommendations'],
  ['Proposal & Form Fill', 'Auto-fill proposal forms from structured case data'],
  ['Issuance & Tracking',  'Policy issuance coordination, status tracking'],
  ['Exception & Compliance','Exception detection, audit generation, escalation triggers'],
]

export default function LandingPage() {
  return (
    <div style={{ background:'#0a0d16', color:'#e8eaf0', fontFamily:'DM Sans,sans-serif', overflowX:'hidden' }}>

      {/* ── Nav ── */}
      <nav style={{ position:'sticky', top:0, zIndex:50, background:'rgba(10,13,22,0.9)',
                    backdropFilter:'blur(12px)', borderBottom:'1px solid #1e2235',
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'0 5%', height:64 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:9, background:'linear-gradient(135deg,#6366f1,#2dd4bf)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        color:'#fff', fontWeight:800, fontSize:13 }}>Q2P</div>
          <span style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:16 }}>Quote-to-Policy Platform</span>
        </div>
        <div style={{ display:'flex', gap:12 }}>
          <Link to="/login" style={{ padding:'8px 20px', borderRadius:8, border:'1px solid #2a2f45',
            color:'#e8eaf0', textDecoration:'none', fontSize:13, fontWeight:600 }}>Sign In</Link>
          <Link to="/register" style={{ padding:'8px 20px', borderRadius:8,
            background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'#fff',
            textDecoration:'none', fontSize:13, fontWeight:600 }}>Get Started</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ textAlign:'center', padding:'100px 5% 80px', position:'relative' }}>
        <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
          <div style={{ position:'absolute', top:'10%', left:'20%', width:400, height:400,
                        borderRadius:'50%', background:'radial-gradient(circle,#6366f133,transparent 70%)' }} />
          <div style={{ position:'absolute', top:'20%', right:'15%', width:300, height:300,
                        borderRadius:'50%', background:'radial-gradient(circle,#2dd4bf22,transparent 70%)' }} />
        </div>
        <div style={{ display:'inline-block', padding:'6px 16px', borderRadius:20,
                      background:'#6366f122', border:'1px solid #6366f144',
                      color:'#a5b4fc', fontSize:12, fontWeight:600, marginBottom:24 }}>
          Enterprise AI-Native Insurance Platform
        </div>
        <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'clamp(2.2rem,6vw,4rem)',
                     fontWeight:800, lineHeight:1.1, marginBottom:24, maxWidth:800, margin:'0 auto 24px' }}>
          Automate Your{' '}
          <span style={{ background:'linear-gradient(135deg,#6366f1,#2dd4bf)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            Quote-to-Policy
          </span>{' '}
          Lifecycle with AI
        </h1>
        <p style={{ fontSize:18, color:'#9ca3af', maxWidth:600, margin:'0 auto 40px', lineHeight:1.7 }}>
          Multi-agent orchestration, RAG knowledge base, real-time escalations, and OTP-based consent —
          all in one production-grade platform.
        </p>
        <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
          <Link to="/register" style={{ padding:'14px 32px', borderRadius:10,
            background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'#fff',
            textDecoration:'none', fontSize:15, fontWeight:700 }}>Start Free Trial</Link>
          <Link to="/login" style={{ padding:'14px 32px', borderRadius:10,
            border:'1px solid #2a2f45', color:'#e8eaf0',
            textDecoration:'none', fontSize:15, fontWeight:600 }}>View Dashboard →</Link>
        </div>
      </section>

      {/* ── Workflow Pipeline ── */}
      <section style={{ padding:'60px 5%', background:'#0d1120' }}>
        <h2 style={{ fontFamily:'Syne,sans-serif', textAlign:'center', fontSize:28, fontWeight:700, marginBottom:8 }}>
          15-Stage Automated Workflow
        </h2>
        <p style={{ textAlign:'center', color:'#6b7280', marginBottom:40, fontSize:14 }}>
          Complete end-to-end automation from customer intake to policy issuance
        </p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center' }}>
          {STAGES.map((s, i) => (
            <div key={s} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ background:'#161b2e', border:'1px solid #2a2f45', borderRadius:8,
                            padding:'8px 14px', fontSize:12, fontWeight:600,
                            borderLeft:`3px solid ${i < 7 ? '#6366f1' : i < 12 ? '#2dd4bf' : '#f59e0b'}` }}>
                <span style={{ color:'#6b7280', marginRight:6 }}>{i+1}.</span>{s}
              </div>
              {i < STAGES.length - 1 && <span style={{ color:'#2a2f45', fontSize:18 }}>›</span>}
            </div>
          ))}
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section style={{ padding:'80px 5%' }}>
        <h2 style={{ fontFamily:'Syne,sans-serif', textAlign:'center', fontSize:28, fontWeight:700, marginBottom:48 }}>
          Platform Capabilities
        </h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ background:'#161b2e', border:'1px solid #2a2f45',
                                         borderRadius:14, padding:24 }}>
              <div style={{ fontSize:28, marginBottom:12 }}>{f.icon}</div>
              <h3 style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:8, fontSize:16 }}>{f.title}</h3>
              <p style={{ color:'#9ca3af', fontSize:13, lineHeight:1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Multi-Agent System ── */}
      <section style={{ padding:'80px 5%', background:'#0d1120' }}>
        <h2 style={{ fontFamily:'Syne,sans-serif', textAlign:'center', fontSize:28, fontWeight:700, marginBottom:48 }}>
          Multi-Agent Architecture
        </h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:16 }}>
          {AGENTS.map(([name, desc]) => (
            <div key={name} style={{ display:'flex', gap:14, background:'#161b2e',
                                      border:'1px solid #2a2f45', borderRadius:12, padding:18,
                                      alignItems:'flex-start' }}>
              <div style={{ width:36, height:36, borderRadius:8, background:'#6366f122',
                             border:'1px solid #6366f144', display:'flex', alignItems:'center',
                             justifyContent:'center', fontSize:16, flexShrink:0 }}>🤖</div>
              <div>
                <p style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>{name} Agent</p>
                <p style={{ color:'#9ca3af', fontSize:12, lineHeight:1.5 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Personas ── */}
      <section style={{ padding:'80px 5%' }}>
        <h2 style={{ fontFamily:'Syne,sans-serif', textAlign:'center', fontSize:28, fontWeight:700, marginBottom:12 }}>
          6 Persona Dashboards
        </h2>
        <p style={{ textAlign:'center', color:'#6b7280', marginBottom:48, fontSize:14 }}>
          Role-based access with tailored workflows for every stakeholder
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:16 }}>
          {PERSONAS.map(p => (
            <div key={p.role} style={{ background:'#161b2e', border:`1px solid ${p.color}33`,
                                        borderRadius:14, padding:24 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:p.color, marginBottom:12 }} />
              <h3 style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:8, fontSize:15, color:p.color }}>{p.role}</h3>
              <p style={{ color:'#9ca3af', fontSize:13, lineHeight:1.6 }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── RAG Section ── */}
      <section style={{ padding:'80px 5%', background:'#0d1120' }}>
        <div style={{ maxWidth:800, margin:'0 auto', textAlign:'center' }}>
          <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:28, fontWeight:700, marginBottom:16 }}>
            Advanced RAG Knowledge System
          </h2>
          <p style={{ color:'#9ca3af', fontSize:15, lineHeight:1.7, marginBottom:32 }}>
            Upload PDF, DOCX, or TXT documents. They're automatically chunked, embedded via
            <strong style={{ color:'#e8eaf0' }}> all-MiniLM-L6-v2</strong>, stored in local{' '}
            <strong style={{ color:'#2dd4bf' }}>ChromaDB</strong>, and cross-referenced in{' '}
            <strong style={{ color:'#6366f1' }}>ArangoDB</strong> graph.
            Ask questions in natural language — the system retrieves semantically relevant chunks,
            merges graph relationships, and sends a grounded prompt to{' '}
            <strong style={{ color:'#f59e0b' }}>local Mistral LLM</strong> with full conversation memory.
          </p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            {['Local ChromaDB','ArangoDB Graph','Mistral LLM','Multi-turn Memory','Source Citations'].map(t => (
              <span key={t} style={{ padding:'6px 14px', borderRadius:20, background:'#6366f122',
                                      border:'1px solid #6366f144', color:'#a5b4fc', fontSize:12, fontWeight:600 }}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section style={{ padding:'60px 5%' }}>
        <h2 style={{ fontFamily:'Syne,sans-serif', textAlign:'center', fontSize:24, fontWeight:700, marginBottom:32 }}>
          Tech Stack
        </h2>
        <div style={{ display:'flex', flexWrap:'wrap', gap:12, justifyContent:'center' }}>
          {['FastAPI','React 18','LangGraph','LangChain','Local Mistral','ChromaDB (local)','ArangoDB',
            'MySQL','Redux Toolkit','Vite','Tailwind CSS','JWT Auth','APScheduler','Alembic'].map(t => (
            <span key={t} style={{ padding:'8px 16px', borderRadius:8, background:'#161b2e',
                                    border:'1px solid #2a2f45', fontSize:13, fontWeight:500 }}>{t}</span>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding:'80px 5%', background:'linear-gradient(135deg,#6366f111,#2dd4bf11)',
                         borderTop:'1px solid #2a2f45', textAlign:'center' }}>
        <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:32, fontWeight:800, marginBottom:16 }}>
          Ready to Automate Your Insurance Workflow?
        </h2>
        <p style={{ color:'#9ca3af', marginBottom:32, fontSize:15 }}>
          Deploy the platform, connect your local Mistral instance, and go live.
        </p>
        <div style={{ display:'flex', gap:16, justifyContent:'center' }}>
          <Link to="/register" style={{ padding:'14px 36px', borderRadius:10,
            background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'#fff',
            textDecoration:'none', fontSize:15, fontWeight:700 }}>Create Account</Link>
          <Link to="/login" style={{ padding:'14px 36px', borderRadius:10,
            border:'1px solid #2a2f45', color:'#e8eaf0',
            textDecoration:'none', fontSize:15, fontWeight:600 }}>Login →</Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ padding:'32px 5%', borderTop:'1px solid #1e2235', display:'flex',
                        justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:28, height:28, borderRadius:7, background:'linear-gradient(135deg,#6366f1,#2dd4bf)',
                        display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:11 }}>Q2P</div>
          <span style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:14 }}>Q2P Platform</span>
        </div>
        <p style={{ color:'#6b7280', fontSize:12 }}>
          Enterprise AI-Native Insurance Workflow Automation Platform
        </p>
      </footer>
    </div>
  )
}
