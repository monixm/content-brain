import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  CalendarClock,
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  History,
  Image as ImageIcon,
  Link2,
  LoaderCircle,
  LockKeyhole,
  MessageCircleMore,
  MessageSquarePlus,
  Mic,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Sparkles,
  Square,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { starterItems, zones } from "./data";

const localKey = "content-brain-items-v1";
const accessKey = "content-brain-access-key";
const conversationKey = "content-brain-conversations-v1";
const inspirationOptions = ["Hook", "Caption", "Content idea", "Structure", "Visual", "CTA", "Tone"];
const welcomeMessage = { role: "assistant", content: "I’m ready to turn your connected sources into content. What do you want to create?" };

const typeIcons = {
  note: FileText,
  link: Link2,
  image: ImageIcon,
};

function readLocalItems() {
  try {
    const stored = JSON.parse(localStorage.getItem(localKey) || "null");
    if (!Array.isArray(stored)) return starterItems;
    const latestStarters = new Map(starterItems.map((item) => [item.id, item]));
    return stored.map((item) => item.starter && latestStarters.has(item.id) ? latestStarters.get(item.id) : item);
  } catch {
    return starterItems;
  }
}

function conversationTitle(messages) {
  const firstPrompt = messages.find((message) => message.role === "user")?.content?.trim();
  if (!firstPrompt) return "New conversation";
  return firstPrompt.length > 52 ? `${firstPrompt.slice(0, 52).trim()}…` : firstPrompt;
}

function createConversation(messages = [welcomeMessage]) {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: conversationTitle(messages),
    messages,
    createdAt: now,
    updatedAt: now,
  };
}

function readLocalConversations() {
  try {
    const stored = JSON.parse(localStorage.getItem(conversationKey) || "null");
    if (Array.isArray(stored) && stored.length) return stored;
  } catch {
    // Try to recover the previous temporary chat below.
  }

  try {
    const previousSession = JSON.parse(sessionStorage.getItem("content-brain-chat") || "null");
    if (Array.isArray(previousSession) && previousSession.length) return [createConversation(previousSession)];
  } catch {
    // Start a fresh conversation if no previous session is available.
  }

  return [createConversation()];
}

async function compressImage(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const preview = new Image();
    preview.onload = () => resolve(preview);
    preview.onerror = reject;
    preview.src = dataUrl;
  });

  const maxDimension = 1400;
  const scale = Math.min(1, maxDimension / image.width, maxDimension / image.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/webp", 0.78);
}

function SourceCard({ item, onEdit }) {
  const Icon = typeIcons[item.type] || FileText;
  return (
    <button className="source-card" type="button" onClick={() => onEdit(item)}>
      {item.image ? (
        <img className="source-image" src={item.image} alt="" />
      ) : (
        <div className={`source-visual source-visual-${item.type}`}>
          <Icon size={20} />
          <span>{item.type === "link" ? "Saved link" : "Text note"}</span>
        </div>
      )}
      <div className="source-copy">
        <div className="source-meta">
          <span>{item.type}</span>
          <MoreHorizontal size={15} />
        </div>
        <strong>{item.title}</strong>
        <p>{item.content || "No notes added yet."}</p>
        {item.tags?.length > 0 && (
          <div className="tag-row">
            {item.tags.slice(0, 2).map((tag) => <span key={tag}>#{tag}</span>)}
          </div>
        )}
        {item.takeaways?.length > 0 && <div className="takeaway-line">Liked: {item.takeaways.join(" · ")}</div>}
      </div>
    </button>
  );
}

function KnowledgeZone({ zone, items, connected, onToggle, onAdd, onEdit }) {
  return (
    <section className={`knowledge-zone zone-${zone.color}`}>
      <header className="zone-header">
        <div className="zone-number">{zone.step}</div>
        <div className="zone-title">
          <span>{zone.eyebrow}</span>
          <h2>{zone.title}</h2>
        </div>
        <button
          type="button"
          className={`connection-toggle ${connected ? "is-connected" : ""}`}
          onClick={onToggle}
          aria-pressed={connected}
        >
          <span>{connected ? <Check size={12} /> : null}</span>
          {connected ? "Connected" : "Connect"}
        </button>
      </header>
      <p className="zone-description">{zone.description}</p>
      <div className="source-grid">
        <button className="add-source-card" type="button" onClick={onAdd}>
          <span><Plus size={18} /></span>
          <strong>Add source</strong>
          <small>{zone.prompt}</small>
        </button>
        {items.slice(0, 4).map((item) => (
          <SourceCard key={item.id} item={item} onEdit={onEdit} />
        ))}
      </div>
      {items.length > 4 && <button className="zone-more" type="button">View all {items.length} sources <ArrowRight size={14} /></button>}
    </section>
  );
}

function SourceModal({ zone, item, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(item?.title || "");
  const [content, setContent] = useState(item?.content || "");
  const [url, setUrl] = useState(item?.url || "");
  const [tags, setTags] = useState(item?.tags?.join(", ") || "");
  const [type, setType] = useState(item?.type || "note");
  const [image, setImage] = useState(item?.image || "");
  const [takeaways, setTakeaways] = useState(item?.takeaways || []);
  const [processing, setProcessing] = useState(false);
  const [imageError, setImageError] = useState("");

  async function useImageFile(file, pasted = false) {
    if (!file) return;
    setProcessing(true);
    setImageError("");
    try {
      setImage(await compressImage(file));
      setType("image");
      if (!title) setTitle(pasted ? "Pasted screenshot" : file.name.replace(/\.[^.]+$/, ""));
    } catch {
      setImageError("That image could not be read. Try copying it again or upload a PNG, JPG, or WebP file.");
    } finally {
      setProcessing(false);
    }
  }

  function handleImage(event) {
    useImageFile(event.target.files?.[0]);
  }

  function handlePaste(event) {
    const imageFile = [...(event.clipboardData?.items || [])]
      .find((clipboardItem) => clipboardItem.type.startsWith("image/"))
      ?.getAsFile();
    if (!imageFile) return;
    event.preventDefault();
    useImageFile(imageFile, true);
  }

  function submit(event) {
    event.preventDefault();
    onSave({
      ...item,
      id: item?.id || crypto.randomUUID(),
      zone: zone.id,
      title: title.trim(),
      content: content.trim(),
      url: url.trim(),
      tags: tags.split(",").map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean),
      takeaways,
      type,
      image,
      starter: false,
      createdAt: item?.createdAt || Date.now(),
      updatedAt: Date.now(),
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="source-modal" onSubmit={submit} onPaste={handlePaste}>
        <header>
          <div>
            <span className="eyebrow">{item ? "Edit source" : `Add to ${zone.title}`}</span>
            <h2>{item ? item.title : "Capture something useful"}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={19} /></button>
        </header>

        <div className="type-tabs">
          {[{ id: "note", label: "Text", icon: FileText }, { id: "link", label: "Link", icon: Link2 }, { id: "image", label: "Screenshot", icon: ImageIcon }].map((option) => {
            const Icon = option.icon;
            return <button key={option.id} type="button" className={type === option.id ? "active" : ""} onClick={() => setType(option.id)}><Icon size={15} />{option.label}</button>;
          })}
        </div>

        {zone.id === "expert" && (
          <div className="paste-hint"><ImageIcon size={15} /><span>Copy a screenshot, then press <kbd>⌘V</kbd> or <kbd>Ctrl+V</kbd> anywhere in this window.</span></div>
        )}

        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What should you remember this as?" required autoFocus />
        </label>

        {zone.id === "inspiration" && (
          <fieldset className="takeaway-picker">
            <legend>What caught your attention?</legend>
            <div>
              {inspirationOptions.map((option) => {
                const selected = takeaways.includes(option);
                return <button key={option} type="button" className={selected ? "active" : ""} onClick={() => setTakeaways((current) => selected ? current.filter((value) => value !== option) : [...current, option])}>{selected && <Check size={12} />}{option}</button>;
              })}
            </div>
          </fieldset>
        )}

        {type === "link" && (
          <label className="field">
            <span>URL</span>
            <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" />
          </label>
        )}

        {type === "image" && (
          <label className={`image-drop ${image ? "has-image" : ""}`}>
            <input type="file" accept="image/*" onChange={handleImage} />
            {image ? <img src={image} alt="Screenshot preview" /> : <><Upload size={22} /><strong>{processing ? "Preparing image…" : "Upload or paste a screenshot"}</strong><span>JPG, PNG, WebP, or ⌘V / Ctrl+V</span></>}
          </label>
        )}

        {imageError && <p className="image-error" role="alert">{imageError}</p>}

        <label className="field">
          <span>{type === "image" ? "What do you like about it?" : "Notes or content"}</span>
          <textarea rows="6" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Paste the text, transcript, hook, idea, or the reason this is useful…" />
        </label>

        <label className="field">
          <span>Tags <em>optional, separated by commas</em></span>
          <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="hooks, LinkedIn, founder story" />
        </label>

        <footer>
          {item ? <button className="delete-button" type="button" onClick={() => onDelete(item.id)}><Trash2 size={15} />Delete</button> : <span />}
          <div>
            <button className="button secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button primary" type="submit">Save source</button>
          </div>
        </footer>
      </form>
    </div>
  );
}

function ChatStudio({ connectedZones, items, accessSecret, focus = false }) {
  const [conversations, setConversations] = useState(readLocalConversations);
  const [activeConversationId, setActiveConversationId] = useState(() => conversations[0].id);
  const [showHistory, setShowHistory] = useState(false);
  const [cloudHistoryReady, setCloudHistoryReady] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [chatImages, setChatImages] = useState([]);
  const [attachmentError, setAttachmentError] = useState("");
  const messagesRef = useRef(null);
  const cloudSaveTimer = useRef(null);
  const recognitionRef = useRef(null);
  const dictationStartRef = useRef("");
  const attachmentInputRef = useRef(null);
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0];
  const messages = activeConversation?.messages || [welcomeMessage];

  useEffect(() => {
    let ignore = false;
    async function loadConversationHistory() {
      try {
        const response = await fetch("/api/history", { headers: { "x-content-hub-key": accessSecret } });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (ignore || !Array.isArray(data.conversations)) return;
        setConversations((current) => {
          const merged = new Map(current.map((conversation) => [conversation.id, conversation]));
          data.conversations.forEach((conversation) => {
            const local = merged.get(conversation.id);
            if (!local || (conversation.updatedAt || 0) > (local.updatedAt || 0)) merged.set(conversation.id, conversation);
          });
          return [...merged.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        });
      } catch {
        // Local history remains available if cloud history cannot be reached.
      } finally {
        if (!ignore) setCloudHistoryReady(true);
      }
    }
    loadConversationHistory();
    return () => { ignore = true; };
  }, [accessSecret]);

  useEffect(() => {
    localStorage.setItem(conversationKey, JSON.stringify(conversations));
    sessionStorage.setItem("content-brain-chat", JSON.stringify(messages));
    if (!cloudHistoryReady || !activeConversation?.messages?.some((message) => message.role === "user")) return undefined;
    clearTimeout(cloudSaveTimer.current);
    cloudSaveTimer.current = setTimeout(() => {
      fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-content-hub-key": accessSecret },
        body: JSON.stringify(activeConversation),
      }).catch(() => {});
    }, 500);
    return () => clearTimeout(cloudSaveTimer.current);
  }, [conversations, activeConversation, accessSecret, cloudHistoryReady, messages]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  function stopDictation() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }

  function toggleDictation() {
    if (isListening) {
      stopDictation();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError("Dictation is not supported in this browser. Try Safari or Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    dictationStartRef.current = prompt.trimEnd();
    setSpeechError("");

    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      const separator = dictationStartRef.current && transcript ? " " : "";
      setPrompt(`${dictationStartRef.current}${separator}${transcript}`);
    };
    recognition.onerror = (event) => {
      const message = event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "Microphone access was blocked. Allow it in your browser settings and try again."
        : event.error === "no-speech"
          ? "I couldn’t hear anything. Tap the mic and try again."
          : "Dictation stopped unexpectedly. Please try again.";
      setSpeechError(message);
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    try {
      recognition.start();
    } catch {
      setIsListening(false);
      recognitionRef.current = null;
      setSpeechError("Dictation could not start. Please try again.");
    }
  }

  function updateConversationMessages(id, nextMessagesOrUpdater) {
    setConversations((current) => current.map((conversation) => {
      if (conversation.id !== id) return conversation;
      const nextMessages = typeof nextMessagesOrUpdater === "function"
        ? nextMessagesOrUpdater(conversation.messages)
        : nextMessagesOrUpdater;
      return {
        ...conversation,
        title: conversationTitle(nextMessages),
        messages: nextMessages,
        updatedAt: Date.now(),
      };
    }));
  }

  function startNewConversation() {
    const conversation = createConversation();
    setConversations((current) => [conversation, ...current]);
    setActiveConversationId(conversation.id);
    setPrompt("");
    setChatImages([]);
    setAttachmentError("");
    setShowHistory(false);
  }

  async function addChatImages(event) {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length) return;

    const availableSlots = Math.max(0, 3 - chatImages.length);
    if (!availableSlots) {
      setAttachmentError("You can attach up to 3 screenshots to one message.");
      return;
    }

    const selected = files.slice(0, availableSlots);
    setAttachmentError(files.length > availableSlots ? "Only the first 3 screenshots were added." : "");
    try {
      const images = await Promise.all(selected.map(async (file) => ({
        id: crypto.randomUUID(),
        name: file.name || "Screenshot",
        dataUrl: await compressImage(file),
      })));
      setChatImages((current) => [...current, ...images].slice(0, 3));
    } catch {
      setAttachmentError("One of those images could not be read. Try a PNG, JPG, or WebP screenshot.");
    }
  }

  async function sendPrompt(event) {
    event.preventDefault();
    const cleanPrompt = prompt.trim();
    if ((!cleanPrompt && !chatImages.length) || loading) return;
    if (isListening) stopDictation();
    const conversationId = activeConversationId;
    const attachedImages = chatImages;
    const userMessage = {
      role: "user",
      content: cleanPrompt || "Please look at the attached screenshot.",
      images: attachedImages,
    };
    const nextMessages = [...messages, userMessage];
    updateConversationMessages(conversationId, nextMessages);
    setPrompt("");
    setChatImages([]);
    setAttachmentError("");
    setLoading(true);

    try {
      const selectedItems = items.filter((item) => connectedZones[item.zone]);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-content-hub-key": accessSecret },
        body: JSON.stringify({
          prompt: cleanPrompt,
          history: messages.slice(-8).map(({ images: _images, ...message }) => message),
          sources: selectedItems.map(({ image, ...source }) => source),
          images: attachedImages,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not reach the writing assistant.");
      updateConversationMessages(conversationId, (current) => [...current, { role: "assistant", content: data.text }]);
    } catch (error) {
      updateConversationMessages(conversationId, (current) => [...current, { role: "assistant", content: error.message, error: true }]);
    } finally {
      setLoading(false);
    }
  }

  const connectedCount = Object.values(connectedZones).filter(Boolean).length;

  return (
    <aside className={`chat-studio ${focus ? "chat-studio-focus" : ""}`}>
      <header className="chat-header">
        <div className="assistant-avatar"><Sparkles size={17} /></div>
        <div>
          <span>Writing studio</span>
          <h2>Content Brain</h2>
        </div>
        <div className="chat-header-actions">
          <button type="button" onClick={() => setShowHistory((current) => !current)} aria-expanded={showHistory}><History size={16} /><span>History</span></button>
          <button type="button" onClick={startNewConversation} aria-label="New conversation"><MessageSquarePlus size={17} /></button>
        </div>
      </header>
      {showHistory && (
        <section className="conversation-history" aria-label="Conversation history">
          <header>
            <div><strong>Conversation history</strong><small>Saved automatically</small></div>
            <button type="button" onClick={startNewConversation}><Plus size={15} />New chat</button>
          </header>
          <div>
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={conversation.id === activeConversationId ? "active" : ""}
                onClick={() => { setActiveConversationId(conversation.id); setPrompt(""); setShowHistory(false); }}
              >
                <strong>{conversation.title}</strong>
                <span>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(conversation.updatedAt)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="context-strip">
        <BrainCircuit size={14} />
        <span>Reading {connectedCount} of 4 knowledge areas</span>
        <ChevronDown size={14} />
      </div>
      <div className="chat-messages" ref={messagesRef}>
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`message ${message.role} ${message.error ? "error" : ""}`}>
            {message.role === "assistant" && <div className="mini-avatar"><Bot size={13} /></div>}
            <div>
              {message.images?.length > 0 && (
                <div className="message-images">
                  {message.images.map((image) => <img key={image.id || image.dataUrl} src={image.dataUrl} alt={image.name || "Attached screenshot"} />)}
                </div>
              )}
              {message.content}
            </div>
          </div>
        ))}
        {loading && <div className="message assistant"><div className="mini-avatar"><Bot size={13} /></div><div className="thinking"><i /><i /><i /></div></div>}
      </div>
      <div className="quick-prompts">
        {["Give me 10 hooks", "Write a short video", "Match my voice"].map((suggestion) => (
          <button key={suggestion} type="button" onClick={() => setPrompt(suggestion)}>{suggestion}</button>
        ))}
      </div>
      <form className="chat-input" onSubmit={sendPrompt}>
        {chatImages.length > 0 && (
          <div className="chat-attachments" aria-label="Attached screenshots">
            {chatImages.map((image) => (
              <div key={image.id}>
                <img src={image.dataUrl} alt={image.name} />
                <button type="button" onClick={() => setChatImages((current) => current.filter((item) => item.id !== image.id))} aria-label={`Remove ${image.name}`}><X size={13} /></button>
              </div>
            ))}
          </div>
        )}
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask for a post, script, hooks…" rows="3" onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendPrompt(event); }
        }} />
        <div>
          <span className={speechError || attachmentError ? "dictation-error" : isListening ? "dictation-live" : ""} role="status" aria-live="polite">
            {attachmentError || speechError || (isListening ? "Listening… speak naturally" : connectedCount ? `${connectedCount} sources connected` : "Connect a source first")}
          </span>
          <div className="chat-input-actions">
            <input ref={attachmentInputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={addChatImages} />
            <button
              className="attachment-button"
              type="button"
              onClick={() => attachmentInputRef.current?.click()}
              aria-label="Attach screenshots"
              title="Attach screenshots"
            >
              <Paperclip size={17} />
            </button>
            <button
              className={`dictation-button ${isListening ? "is-listening" : ""}`}
              type="button"
              onClick={toggleDictation}
              aria-label={isListening ? "Stop dictation" : "Start dictation"}
              aria-pressed={isListening}
              title={isListening ? "Stop dictation" : "Dictate message"}
            >
              {isListening ? <Square size={14} fill="currentColor" /> : <Mic size={17} />}
            </button>
            <button className="send-button" type="submit" disabled={(!prompt.trim() && !chatImages.length) || loading || !connectedCount} aria-label="Send"><Send size={16} /></button>
          </div>
        </div>
      </form>
    </aside>
  );
}

function LockScreen({ onUnlock, error, checking }) {
  const [value, setValue] = useState("");
  const [showKey, setShowKey] = useState(false);
  return (
    <main className="lock-screen">
      <div className="lock-mark"><Sparkles size={22} /></div>
      <span className="eyebrow">Private creative workspace</span>
      <h1>Open your Content Brain</h1>
      <p>Your business context, voice, expertise, and inspiration—together in one place.</p>
      <form onSubmit={(event) => { event.preventDefault(); if (value.trim() && !checking) onUnlock(value.trim()); }}>
        <label className="lock-key-field">
          <LockKeyhole size={16} />
          <input
            type={showKey ? "text" : "password"}
            placeholder="Access key"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoComplete="current-password"
            aria-invalid={Boolean(error)}
            autoFocus
          />
          <button
            className="lock-visibility"
            type="button"
            onClick={() => setShowKey((current) => !current)}
            aria-label={showKey ? "Hide access key" : "Show access key"}
          >
            {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </label>
        {error && <p className="lock-error" role="alert">{error}</p>}
        <button className="button primary" type="submit" disabled={!value.trim() || checking}>
          {checking ? <><LoaderCircle className="spin" size={16} />Checking key…</> : <>Enter workspace <ArrowRight size={16} /></>}
        </button>
      </form>
    </main>
  );
}

export default function App() {
  const [accessSecret, setAccessSecret] = useState(() => sessionStorage.getItem(accessKey) || "");
  const [authStatus, setAuthStatus] = useState(() => sessionStorage.getItem(accessKey) ? "checking" : "locked");
  const [authError, setAuthError] = useState("");
  const [items, setItems] = useState(readLocalItems);
  const [connectedZones, setConnectedZones] = useState({ business: true, voice: true, expert: true, inspiration: true });
  const [activeModal, setActiveModal] = useState(null);
  const [search, setSearch] = useState("");
  const [syncState, setSyncState] = useState("local");
  const [view, setView] = useState("canvas");

  useEffect(() => {
    localStorage.setItem(localKey, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (!accessSecret || authStatus !== "checking") return;
    let ignore = false;
    async function loadRemote() {
      setSyncState("syncing");
      try {
        const response = await fetch("/api/content", { headers: { "x-content-hub-key": accessSecret } });
        if (response.status === 401) {
          throw new Error("invalid-key");
        }
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!ignore && data.items?.length) setItems(data.items);
        if (!ignore) {
          sessionStorage.setItem(accessKey, accessSecret);
          setSyncState("cloud");
          setAuthStatus("unlocked");
        }
      } catch (error) {
        if (!ignore) {
          sessionStorage.removeItem(accessKey);
          setAccessSecret("");
          setSyncState("local");
          setAuthStatus("locked");
          setAuthError(error.message === "invalid-key" ? "That access key is not correct. Please check it and try again." : "We couldn't verify the access key. Please try again.");
        }
      }
    }
    loadRemote();
    return () => { ignore = true; };
  }, [accessSecret, authStatus]);

  async function persistItem(item) {
    const nextItems = items.some((candidate) => candidate.id === item.id)
      ? items.map((candidate) => candidate.id === item.id ? item : candidate)
      : [item, ...items.filter((candidate) => !candidate.starter || candidate.zone !== item.zone)];
    setItems(nextItems);
    setActiveModal(null);
    try {
      setSyncState("syncing");
      const response = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-content-hub-key": accessSecret },
        body: JSON.stringify(item),
      });
      if (!response.ok) throw new Error();
      setSyncState("cloud");
    } catch {
      setSyncState("local");
    }
  }

  async function deleteItem(id) {
    setItems((current) => current.filter((item) => item.id !== id));
    setActiveModal(null);
    try {
      await fetch(`/api/content?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: { "x-content-hub-key": accessSecret } });
    } catch {
      setSyncState("local");
    }
  }

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => `${item.title} ${item.content} ${item.tags?.join(" ")}`.toLowerCase().includes(query));
  }, [items, search]);

  function unlock(secret) {
    setAuthError("");
    setAccessSecret(secret);
    setAuthStatus("checking");
  }

  if (authStatus !== "unlocked") return <LockScreen onUnlock={unlock} error={authError} checking={authStatus === "checking"} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span><Sparkles size={16} /></span><strong>Content Brain</strong></div>
        <div className="workspace-name"><span>Workspace</span><strong>My Content Studio</strong><ChevronDown size={14} /></div>
        <label className="global-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your brain…" /></label>
        <div className={`sync-state sync-${syncState}`}>
          {syncState === "syncing" ? <LoaderCircle className="spin" size={13} /> : <span />}
          {syncState === "cloud" ? "Saved to cloud" : syncState === "syncing" ? "Saving" : "Saved locally"}
        </div>
      </header>

      <nav className="side-rail" aria-label="Main navigation">
        <div className="rail-mark"><Sparkles size={17} /></div>
        <button className={view === "canvas" ? "active" : ""} type="button" aria-label="Knowledge canvas" onClick={() => setView("canvas")}><BrainCircuit size={19} /></button>
        <button className={view === "studio" ? "active" : ""} type="button" aria-label="Writing studio" onClick={() => setView("studio")}><MessageCircleMore size={19} /></button>
        <div className="rail-spacer" />
        <button className="profile-button" type="button" aria-label="Profile">MM</button>
      </nav>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button className={view === "canvas" ? "active" : ""} type="button" onClick={() => setView("canvas")}><BrainCircuit size={18} /><span>Canvas</span></button>
        <button className={view === "studio" ? "active" : ""} type="button" onClick={() => setView("studio")}><MessageCircleMore size={18} /><span>Studio</span></button>
        <button type="button" onClick={() => { setView("canvas"); setActiveModal({ zone: zones[3] }); }}><Plus size={18} /><span>Capture</span></button>
      </nav>

      {view === "canvas" ? <main className="canvas">
        <div className="canvas-intro">
          <div>
            <span className="eyebrow">Knowledge canvas</span>
            <h1>Teach your AI how you think.</h1>
            <p>Everything you connect becomes context for your writing studio.</p>
          </div>
          <div className="canvas-actions">
            <button className="button secondary" type="button" onClick={() => setActiveModal({ zone: zones[3] })}><Plus size={15} />Quick capture</button>
            <button className="button primary" type="button" onClick={() => setView("studio")}><MessageCircleMore size={15} />Open studio</button>
          </div>
        </div>

        <aside className="posting-rhythm" aria-label="Best posting times">
          <div className="posting-rhythm-heading">
            <span><CalendarClock size={18} /></span>
            <div>
              <strong>Best posting times</strong>
              <small>Switzerland time</small>
            </div>
          </div>
          <div className="posting-slot">
            <span>LinkedIn</span>
            <strong>Tuesday · 11:30</strong>
            <small>Best window: Tue–Thu, 11:00–17:00</small>
          </div>
          <div className="posting-slot">
            <span>Instagram</span>
            <strong>Wednesday · 18:00</strong>
            <small>Best window: Tue afternoon or Wed 12:00–21:00</small>
          </div>
          <p>One core idea, adapted for both platforms.</p>
        </aside>

        <div className="workspace-layout">
          <div className="knowledge-grid">
            {zones.map((zone) => (
              <KnowledgeZone
                key={zone.id}
                zone={zone}
                items={filteredItems.filter((item) => item.zone === zone.id)}
                connected={connectedZones[zone.id]}
                onToggle={() => setConnectedZones((current) => ({ ...current, [zone.id]: !current[zone.id] }))}
                onAdd={() => setActiveModal({ zone })}
                onEdit={(item) => setActiveModal({ zone, item })}
              />
            ))}
          </div>
        </div>
      </main> : <main className="studio-page">
        <div className="studio-intro">
          <div>
            <span className="eyebrow">Writing studio</span>
            <h1>Create with your whole brain.</h1>
            <p>Choose the knowledge areas that should shape this conversation.</p>
          </div>
          <button className="button secondary" type="button" onClick={() => setView("canvas")}><BrainCircuit size={15} />Back to canvas</button>
        </div>
        <div className="studio-layout">
          <aside className="studio-context">
            <div className="studio-context-heading">
              <span>Connected knowledge</span>
              <strong>{Object.values(connectedZones).filter(Boolean).length} of 4 active</strong>
            </div>
            {zones.map((zone) => {
              const zoneItems = items.filter((item) => item.zone === zone.id);
              return (
                <button
                  key={zone.id}
                  type="button"
                  className={`studio-context-card zone-${zone.color} ${connectedZones[zone.id] ? "active" : ""}`}
                  onClick={() => setConnectedZones((current) => ({ ...current, [zone.id]: !current[zone.id] }))}
                  aria-pressed={connectedZones[zone.id]}
                >
                  <span className="zone-number">{zone.step}</span>
                  <span><strong>{zone.title}</strong><small>{zoneItems.length} {zoneItems.length === 1 ? "source" : "sources"}</small></span>
                  <span className="context-check">{connectedZones[zone.id] ? <Check size={13} /> : null}</span>
                </button>
              );
            })}
            <button className="button secondary studio-add" type="button" onClick={() => { setView("canvas"); setActiveModal({ zone: zones[0] }); }}><Plus size={15} />Add knowledge</button>
          </aside>
          <ChatStudio focus connectedZones={connectedZones} items={items} accessSecret={accessSecret} />
        </div>
      </main>}

      {activeModal && (
        <SourceModal
          zone={activeModal.zone}
          item={activeModal.item}
          onClose={() => setActiveModal(null)}
          onSave={persistItem}
          onDelete={deleteItem}
        />
      )}
    </div>
  );
}
