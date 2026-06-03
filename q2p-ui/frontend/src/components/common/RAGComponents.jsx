import { useState, useEffect, useRef } from 'react'
import { Badge, Card, SectionHeader, Btn, Input, Alert, Spinner, DataTable, Modal } from './index'
import { Upload, Trash2, Eye } from 'lucide-react'
import api from '../../services/api'

// ── Dropzone helper component ─────────────────────────────────────────
function FileDropzone({ file, onFileChange, onClear, description, label = 'Document Upload', disabled = false }) {
  const inputRef = useRef(null)

  const openPicker = () => {
    if (!disabled) inputRef.current?.click()
  }

  const handleDrop = (event) => {
    event.preventDefault()
    if (disabled) return
    const dropped = event.dataTransfer.files?.[0]
    if (dropped) onFileChange(dropped)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openPicker}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openPicker()
        }
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      className={`group rounded-xl border border-dashed border-[#2a2f45] bg-[linear-gradient(180deg,#15192a_0%,#101423_100%)] p-5 transition-colors text-left ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-[#6366f1] hover:bg-[#15192f]'}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        className="hidden"
        onChange={(event) => onFileChange(event.target.files?.[0] || null)}
      />
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#6366f1]/15 text-[#7c83ff]">
          <Upload size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#e8eaf0]">{label}</p>
          <p className="mt-1 text-sm text-[#6b7280]">{description}</p>
          <p className="mt-2 text-xs text-[#93a1c6]">Drop a PDF, DOCX, or TXT file here or click to browse.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#2a2f45] bg-[#0f1117] px-3 py-2 text-sm">
        <span className="text-[#6b7280]">Selected file:</span>
        <span className="truncate font-medium text-[#e8eaf0]">{file?.name || 'No file selected'}</span>
        {file && onClear && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onClear()
            }}
            className="ml-auto rounded-lg border border-[#2a2f45] px-3 py-1 text-xs font-semibold text-[#e8eaf0] hover:bg-[#1e2235]"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

// ── Reusable Knowledge Base ──────────────────────────────────────────
export function KnowledgeBase() {
  const [docs, setDocs]       = useState([])
  const [file, setFile]       = useState(null)
  const [title, setTitle]     = useState('')
  const [titleLoading, setTitleLoading] = useState(false)
  const [loading, setL]       = useState(true)
  const [uploading, setUploading] = useState(false)
  const [err, setErr]         = useState(null)
  const [ok, setOk]         = useState(null)
  const [selectedDocId, setSelectedDocId] = useState(null)
  const [selectedDocTitle, setSelectedDocTitle] = useState('')
  const [viewOpen, setViewOpen] = useState(false)

  const load = () => {
    api.get('/rag/documents')
      .then(r => setDocs(r.data.documents || []))
      .catch(e => setErr(e.response?.data?.detail || 'Failed to load documents'))
      .finally(() => setL(false))
  }
  
  useEffect(load, [])

  const handleFileChange = async (selectedFile) => {
    if (!selectedFile) {
      setFile(null)
      setTitle('')
      return
    }
    setFile(selectedFile)
    setTitleLoading(true)
    setTitle('')
    setErr(null)
    setOk(null)
    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      const { data } = await api.post('/rag/documents/suggest-title', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (data.suggested_title) {
        setTitle(data.suggested_title)
      }
    } catch (e) {
      const guessed = selectedFile.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim()
      setTitle(guessed.charAt(0).toUpperCase() + guessed.slice(1))
    } finally {
      setTitleLoading(false)
    }
  }

  const upload = async () => {
    if (!file || !title) return
    setUploading(true); setErr(null); setOk(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', title)
      await api.post('/rag/documents/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setOk('Document indexed successfully')
      setFile(null)
      setTitle('')
      load()
    } catch (e) {
      setErr(e.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleView = (id, title) => {
    setSelectedDocId(id)
    setSelectedDocTitle(title)
    setViewOpen(true)
  }

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return
    try {
      await api.delete(`/rag/documents/${id}`)
      setDocs(d => d.filter(x => x.id !== id))
    } catch (e) {
      setErr(e.response?.data?.detail || 'Delete failed')
    }
  }

  const cols = [
    { key:'title',       label:'Title' },
    { key:'file_name',   label:'File' },
    { key:'status',      label:'Status', render: r => <Badge label={r.status} /> },
    { key:'chunk_count', label:'Chunks' },
    { key:'created_at',  label:'Uploaded', render: r => r.created_at ? new Date(r.created_at).toLocaleDateString() : '—' },
    { key:'action',      label:'Action',   render: r => (
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleView(r.id, r.title)}
          className="p-1.5 rounded-lg border border-[#2a2f45] bg-[#1a1f36] text-[#93a1c6] hover:text-[#6366f1] hover:border-[#6366f1] transition-colors cursor-pointer"
          title="View Document"
        >
          <Eye size={16} />
        </button>
        <button
          onClick={() => handleDelete(r.id, r.title)}
          className="p-1.5 rounded-lg border border-[#2a2f45] bg-[#1a1f36] text-[#93a1c6] hover:text-red-400 hover:border-red-400 transition-colors cursor-pointer"
          title="Delete Document"
        >
          <Trash2 size={16} />
        </button>
      </div>
    )},
  ]

  return (
    <div>
      <SectionHeader title="Knowledge Base" subtitle="Upload documents to the RAG pipeline" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <Card>
          <p className="text-sm font-semibold mb-3">Upload Document</p>
          {err && <Alert type="error" message={err} />}
          {ok  && <Alert type="success" message={ok} />}
          <FileDropzone
            file={file}
            onFileChange={handleFileChange}
            onClear={() => { setFile(null); setTitle('') }}
            description="Drag and drop a PDF, DOCX, or TXT document here to automatically index it."
            disabled={uploading}
          />
        </Card>
        
        <Card className="flex flex-col justify-between">
          <div>
            <p className="text-sm font-semibold mb-3">Document Details</p>
            <Input 
              label={titleLoading ? "Title (AI Generating...)" : "Title"} 
              value={title} 
              onChange={setTitle} 
              placeholder={titleLoading ? "AI is analyzing content..." : "Enter document title..."} 
              disabled={titleLoading || uploading}
              required
            />
            {titleLoading && <p className="text-xs text-[#6366f1] mt-2 animate-pulse">Reading document & suggesting title via local LLM...</p>}
          </div>
          <Btn onClick={upload} disabled={uploading || titleLoading || !file || !title} className="mt-5 w-full">
            {uploading ? 'Indexing…' : 'Upload & Index'}
          </Btn>
        </Card>
      </div>
      <Card>{loading ? <Spinner /> : <DataTable columns={cols} rows={docs} emptyText="No documents indexed." />}</Card>

      <Modal open={viewOpen} onClose={() => setViewOpen(false)} title={selectedDocTitle} className="max-w-4xl">
        <div className="w-full h-[70vh] bg-[#0f1117] rounded-lg overflow-hidden border border-[#2a2f45] relative">
          {selectedDocId ? (
            <iframe
              src={`/api/v1/rag/documents/${selectedDocId}/view?token=${encodeURIComponent(localStorage.getItem('access_token'))}`}
              className="w-full h-full border-none"
              title={selectedDocTitle}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-[#6b7280]">No document selected</div>
          )}
        </div>
      </Modal>
    </div>
  )
}

// ── Reusable RAG Chat ────────────────────────────────────────────────
export function RAGChat({ 
  title = "RAG Knowledge Chat", 
  subtitle = "Ask questions from indexed documents using local Mistral LLM", 
  placeholder = "Ask about insurance products, rules, policies…" 
}) {
  const [sessions, setSessions] = useState([])
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [loading, setL]         = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(true)

  const loadSessions = async () => {
    try {
      const { data } = await api.get('/rag/sessions')
      setSessions(data.sessions || [])
    } catch (e) {
      console.error('Failed to load sessions', e)
    } finally {
      setSessionsLoading(false)
    }
  }

  const loadSessionMessages = async (sid) => {
    setL(true)
    try {
      const { data } = await api.get(`/rag/sessions/${sid}/messages`)
      setMessages(data.messages || [])
      setSessionId(sid)
    } catch (e) {
      console.error('Failed to load session messages', e)
    } finally {
      setL(false)
    }
  }

  const deleteSession = async (sid) => {
    if (!window.confirm("Are you sure you want to delete this chat session?")) return
    try {
      await api.delete(`/rag/sessions/${sid}`)
      if (sessionId === sid) {
        startNewChat()
      }
      loadSessions()
    } catch (e) {
      console.error('Failed to delete session', e)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  const startNewChat = () => {
    setSessionId(null)
    setMessages([])
  }

  const send = async () => {
    if (!input.trim()) return
    const userMsg = { role: 'user', content: input }
    setMessages(m => [...m, userMsg])
    setInput('')
    setL(true)
    try {
      const { data } = await api.post('/rag/chat', { message: input, session_id: sessionId })
      const isNew = !sessionId
      setSessionId(data.session_id)
      setMessages(m => [...m, { role: 'assistant', content: data.response, sources: data.sources }])
      if (isNew) {
        loadSessions()
      }
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: 'Error: ' + (e.response?.data?.detail || 'Failed to get response') }])
    } finally {
      setL(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-112px)] overflow-hidden">
      <div className="flex-shrink-0">
        <SectionHeader title={title} subtitle={subtitle} />
      </div>
      <Card className="flex-1 p-0 overflow-hidden flex min-h-0">
        {/* Left Sidebar - Recent Chats */}
        <div className="w-64 border-r border-[#2a2f45] bg-[#0f111a] flex flex-col h-full flex-shrink-0">
          <div className="p-3 border-b border-[#2a2f45]">
            <Btn onClick={startNewChat} className="w-full text-xs py-2" variant="primary">
              + New Chat
            </Btn>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <p className="text-[10px] uppercase font-bold tracking-wider text-[#6b7280] px-2 mb-2">Recent Chats</p>
            {sessionsLoading ? (
              <div className="text-center py-4"><Spinner /></div>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-[#6b7280] px-2 py-3">No recent chats</p>
            ) : (
              sessions.map(s => {
                const isActive = sessionId === s.id
                return (
                  <div key={s.id} className="group relative flex items-center justify-between rounded-lg">
                    <button
                      onClick={() => loadSessionMessages(s.id)}
                      className={`flex-1 text-left px-3 py-2 pr-8 rounded-lg text-xs truncate transition-colors cursor-pointer ${
                        isActive 
                          ? 'bg-[#6366f1]/15 text-[#6366f1] font-semibold border border-[#6366f1]/30' 
                          : 'text-[#94a3b8] hover:bg-[#1e2235] border border-transparent'
                      }`}
                    >
                      {s.title || 'Untitled Session'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteSession(s.id)
                      }}
                      className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-[#6b7280] transition-opacity cursor-pointer"
                      title="Delete Session"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Main Chat Feed */}
        <div className="flex-1 flex flex-col h-full bg-[#161b2e] p-4 min-w-0">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
            {messages.length === 0 && (
              <div className="text-center text-[#6b7280] text-sm mt-10">
                <p className="text-base font-semibold text-[#e8eaf0] mb-1">Welcome to RAG Support</p>
                <p className="text-xs">Ask anything about guidelines, policy terms, coverages or exclusions.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[#6366f1] text-white font-medium'
                    : 'bg-[#1e2235] text-[#e8eaf0] border border-[#2a2f45]'
                }`}>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{m.content}</p>
                  {m.sources?.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[#2a2f45]">
                      <p className="text-xs text-[#6b7280]">Sources:</p>
                      {m.sources.map((s, j) => (
                        <p key={j} className="text-xs text-[#2dd4bf] mt-0.5">{s.title} ({(s.score * 100).toFixed(0)}%)</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#1e2235] border border-[#2a2f45] rounded-xl px-4 py-3 text-sm text-[#6b7280]">
                  <div className="flex items-center gap-1.5 py-1">
                    {/* <span className="text-xs text-[#94a3b8] mr-1.5">Thinking</span> */}
                    <div className="h-2 w-2 rounded-full bg-[#6366f1] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="h-2 w-2 rounded-full bg-[#6366f1] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 rounded-full bg-[#6366f1] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <input 
              value={input} 
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder={placeholder}
              className="flex-1 bg-[#0f1117] border border-[#2a2f45] rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#6366f1] text-[#e8eaf0]" 
            />
            <Btn onClick={send} disabled={loading || !input.trim()}>Send</Btn>
          </div>
        </div>
      </Card>
    </div>
  )
}
