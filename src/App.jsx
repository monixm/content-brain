import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarRange,
  CalendarClock,
  Check,
  ChevronDown,
  Compass,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  History,
  Image as ImageIcon,
  Images,
  LayoutDashboard,
  Library,
  Lightbulb,
  Link2,
  LoaderCircle,
  LockKeyhole,
  MessageCircleMore,
  MessageSquarePlus,
  Mic,
  MoreHorizontal,
  Paperclip,
  PenLine,
  Plus,
  ScanSearch,
  Search,
  Send,
  Sparkles,
  Square,
  TrendingUp,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import { starterItems, zones } from "./data";

const localKey = "content-brain-items-v1";
const accessKey = "content-brain-access-key";
const conversationKey = "content-brain-conversations-v1";
const pageKey = "content-brain-active-page-v1";
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

function ResultModal({ item, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(item?.title || "");
  const [platform, setPlatform] = useState(item?.platform || "LinkedIn");
  const [url, setUrl] = useState(item?.url || "");
  const [pillar, setPillar] = useState(item?.pillar || "Practical automation");
  const [format, setFormat] = useState(item?.format || "Text post");
  const [reach, setReach] = useState(item?.metrics?.reach || "");
  const [comments, setComments] = useState(item?.metrics?.comments || "");
  const [saves, setSaves] = useState(item?.metrics?.saves || "");
  const [shares, setShares] = useState(item?.metrics?.shares || "");
  const [enquiries, setEnquiries] = useState(item?.metrics?.enquiries || "");
  const [notes, setNotes] = useState(item?.content || "");
  const [image, setImage] = useState(item?.image || "");
  const [processing, setProcessing] = useState(false);

  async function useImageFile(file) {
    if (!file) return;
    setProcessing(true);
    try {
      setImage(await compressImage(file));
    } finally {
      setProcessing(false);
    }
  }

  function handlePaste(event) {
    const imageFile = [...(event.clipboardData?.items || [])]
      .find((clipboardItem) => clipboardItem.type.startsWith("image/"))
      ?.getAsFile();
    if (!imageFile) return;
    event.preventDefault();
    useImageFile(imageFile);
  }

  function submit(event) {
    event.preventDefault();
    const now = Date.now();
    onSave({
      ...item,
      id: item?.id || crypto.randomUUID(),
      zone: "results",
      type: image ? "image" : "note",
      title: title.trim(),
      content: notes.trim(),
      url: url.trim(),
      platform,
      pillar,
      format,
      metrics: { reach, comments, saves, shares, enquiries },
      tags: [platform, pillar, format],
      image,
      starter: false,
      createdAt: item?.createdAt || now,
      updatedAt: now,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="source-modal result-modal" onSubmit={submit} onPaste={handlePaste}>
        <header>
          <div><span className="eyebrow">Results</span><h2>{item ? "Update published post" : "Add a published post"}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={19} /></button>
        </header>
        <div className="result-form-grid">
          <label className="field result-title-field"><span>Post title or hook</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What was the post about?" required autoFocus /></label>
          <label className="field"><span>Platform</span><select value={platform} onChange={(event) => setPlatform(event.target.value)}><option>LinkedIn</option><option>Instagram</option></select></label>
          <label className="field"><span>Format</span><select value={format} onChange={(event) => setFormat(event.target.value)}><option>Text post</option><option>Carousel</option><option>Reel / video</option><option>Image post</option><option>Story</option></select></label>
          <label className="field"><span>Content pillar</span><select value={pillar} onChange={(event) => setPillar(event.target.value)}><option>Practical automation</option><option>Building Moniré</option><option>Digital systems</option><option>Founder + mother</option></select></label>
          <label className="field"><span>Post URL <em>optional</em></span><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" /></label>
        </div>
        <fieldset className="metric-fields">
          <legend>Performance after about 7 days</legend>
          <label><span>Reach / views</span><input inputMode="numeric" value={reach} onChange={(event) => setReach(event.target.value)} placeholder="0" /></label>
          <label><span>Comments</span><input inputMode="numeric" value={comments} onChange={(event) => setComments(event.target.value)} placeholder="0" /></label>
          <label><span>Saves</span><input inputMode="numeric" value={saves} onChange={(event) => setSaves(event.target.value)} placeholder="0" /></label>
          <label><span>Shares / sends</span><input inputMode="numeric" value={shares} onChange={(event) => setShares(event.target.value)} placeholder="0" /></label>
          <label><span>Enquiries</span><input inputMode="numeric" value={enquiries} onChange={(event) => setEnquiries(event.target.value)} placeholder="0" /></label>
        </fieldset>
        <label className="field"><span>What did you notice?</span><textarea rows="4" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Who responded? What surprised you? Did it start a useful conversation?" /></label>
        <label className={`analytics-drop ${image ? "has-image" : ""}`}>
          <input type="file" accept="image/*" onChange={(event) => useImageFile(event.target.files?.[0])} />
          {image ? <img src={image} alt="Analytics screenshot" /> : <><ImageIcon size={20} /><strong>{processing ? "Preparing screenshot…" : "Paste or upload an analytics screenshot"}</strong><span>Keep the original numbers together with your notes</span></>}
        </label>
        <footer>
          {item ? <button className="delete-button" type="button" onClick={() => onDelete(item.id)}><Trash2 size={15} />Delete</button> : <span />}
          <div><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button primary" type="submit">Save result</button></div>
        </footer>
      </form>
    </div>
  );
}

function ChatStudio({ connectedZones, items, accessSecret, focus = false, initialPrompt = "", mode = "create" }) {
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

  useEffect(() => {
    if (initialPrompt) setPrompt(initialPrompt);
  }, [initialPrompt]);

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

  async function queueChatImages(files) {
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

  function addChatImages(event) {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    queueChatImages(files);
  }

  function pasteChatImages(event) {
    const files = [...(event.clipboardData?.items || [])]
      .filter((clipboardItem) => clipboardItem.type.startsWith("image/"))
      .map((clipboardItem) => clipboardItem.getAsFile())
      .filter(Boolean);
    if (!files.length) return;
    event.preventDefault();
    queueChatImages(files);
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
      let includedSourceImages = 0;
      const chatSources = selectedItems.map(({ image, ...source }) => {
        if (image && includedSourceImages < 8) {
          includedSourceImages += 1;
          return { ...source, image };
        }
        return source;
      });
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-content-hub-key": accessSecret },
        body: JSON.stringify({
          prompt: cleanPrompt,
          history: messages.slice(-8).map(({ images: _images, ...message }) => message),
          sources: chatSources,
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
        {(mode === "strategy"
          ? ["Clarify what I should be known for", "Review my content pillars", "Plan my next 2 weeks"]
          : mode === "ideas"
            ? ["Find ideas in my work", "Evaluate my latest idea", "Give me 10 useful angles"]
            : mode === "review"
              ? ["Analyze these results", "What should I repeat?", "Plan my next experiment"]
              : ["Give me 10 hooks", "Write a LinkedIn post", "Create an Instagram carousel"]
        ).map((suggestion) => (
          <button key={suggestion} type="button" onClick={() => setPrompt(suggestion)}>{suggestion}</button>
        ))}
      </div>
      <form className="chat-input" onSubmit={sendPrompt} onPaste={pasteChatImages}>
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
  const [accessSecret, setAccessSecret] = useState(() => import.meta.env.DEV ? "" : sessionStorage.getItem(accessKey) || "");
  const [authStatus, setAuthStatus] = useState(() => import.meta.env.DEV ? "unlocked" : sessionStorage.getItem(accessKey) ? "checking" : "locked");
  const [authError, setAuthError] = useState("");
  const [items, setItems] = useState(readLocalItems);
  const [connectedZones, setConnectedZones] = useState({ business: true, voice: true, expert: true, inspiration: true });
  const [activeModal, setActiveModal] = useState(null);
  const [search, setSearch] = useState("");
  const [syncState, setSyncState] = useState("local");
  const [view, setView] = useState(() => localStorage.getItem(pageKey) || "today");
  const [studioMode, setStudioMode] = useState("create");
  const [studioPrompt, setStudioPrompt] = useState("");

  useEffect(() => {
    localStorage.setItem(localKey, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(pageKey, view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view]);

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

  const navigation = [
    { id: "today", label: "Today", description: "Choose your next action", icon: LayoutDashboard },
    { id: "strategy", label: "Strategy", description: "Set your direction and goals", icon: Compass },
    { id: "ideas", label: "Ideas", description: "Capture and evaluate thoughts", icon: Lightbulb },
    { id: "create", label: "Create", description: "Turn an idea into a post", icon: PenLine },
    { id: "results", label: "Results", description: "See what worked and why", icon: BarChart3 },
    { id: "brain", label: "My Brain", description: "Store background knowledge", icon: Library },
  ];
  const results = filteredItems.filter((item) => item.zone === "results");
  const ideas = filteredItems.filter((item) => item.zone === "inspiration" && !item.starter);
  const businessItems = filteredItems.filter((item) => item.zone === "business" && !item.starter);

  function openStudio(mode, prompt = "") {
    setStudioMode(mode);
    setStudioPrompt(prompt ? `${prompt} ` : "");
    setView("create");
  }

  function renderPageHeader(eyebrow, title, description, action = null) {
    return (
      <header className="page-header">
        <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
        {action}
      </header>
    );
  }

  return (
    <div className="app-shell workflow-shell">
      <aside className="main-sidebar">
        <div className="sidebar-brand"><span><BrainCircuit size={19} /></span><strong>Content Brain</strong></div>
        <nav className="workflow-nav" aria-label="Main navigation">
          {navigation.map(({ id, label, description, icon: Icon }) => (
            <button key={id} className={view === id ? "active" : ""} type="button" onClick={() => setView(id)}>
              <Icon size={18} />
              <span><strong>{label}</strong><small>{description}</small></span>
              {id === "ideas" && ideas.length > 0 && <b>{ideas.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-focus"><Sparkles size={16} /><span><strong>Your focus</strong><small>Practical AI for growing businesses</small></span></div>
        <button className="sidebar-capture" type="button" onClick={() => setActiveModal({ zone: zones[3] })}><Plus size={17} />Quick capture</button>
      </aside>

      <header className="app-topbar">
        <div className="mobile-brand"><span><BrainCircuit size={17} /></span><strong>Content Brain</strong></div>
        <label className="global-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your brain…" /></label>
        <div className={`sync-state sync-${syncState}`}>
          {syncState === "syncing" ? <LoaderCircle className="spin" size={13} /> : <span />}
          {syncState === "cloud" ? "Saved to cloud" : syncState === "syncing" ? "Saving" : "Saved locally"}
        </div>
        <button className="mobile-brain-button" type="button" onClick={() => setView("brain")} aria-label="Open My Brain"><Library size={18} /></button>
      </header>

      <main className="workflow-main">
        {view === "today" && <section className="workflow-page">
          {renderPageHeader("Monika's content system", "What do you want to do today?", "Start with an outcome. Content Brain will bring in the right context for you.", <div className="page-actions"><button className="button secondary" type="button" onClick={() => setActiveModal({ zone: zones[3] })}><Plus size={16} />Capture something</button></div>)}
          <div className="action-grid">
            <button className="action-card featured" type="button" onClick={() => openStudio("strategy", "Help me plan a realistic two-week content plan for Instagram and LinkedIn based on my strategy and saved ideas.")}><span><CalendarRange size={21} /></span><div><strong>Plan my next 2 weeks</strong><small>Build a realistic mix for Instagram and LinkedIn.</small></div><ArrowRight size={16} /></button>
            <button className="action-card" type="button" onClick={() => openStudio("ideas", "Help me evaluate this content idea. Ask me for the idea first, then tell me whether to develop, change, or dismiss it.")}><span><ScanSearch size={21} /></span><div><strong>Evaluate an idea</strong><small>Decide whether it is worth posting, changing, or dropping.</small></div><ArrowRight size={16} /></button>
            <button className="action-card" type="button" onClick={() => openStudio("create", "Help me choose one saved idea and turn it into a finished social media post.")}><span><WandSparkles size={21} /></span><div><strong>Turn an idea into a post</strong><small>Develop it for LinkedIn, Instagram, or both.</small></div><ArrowRight size={16} /></button>
            <button className="action-card" type="button" onClick={() => setView("results")}><span><TrendingUp size={21} /></span><div><strong>Review what worked</strong><small>Learn from results and choose your next experiment.</small></div><ArrowRight size={16} /></button>
          </div>

          <div className="today-grid">
            <section className="surface pipeline-panel">
              <div className="surface-heading"><div><span className="section-kicker">This week</span><h2>Your content pipeline</h2><p>Move from a rough thought to a published post without losing the idea.</p></div><button className="text-button" type="button" onClick={() => setView("ideas")}>View all <ArrowRight size={14} /></button></div>
              <div className="pipeline-columns">
                <div className="pipeline-column"><header><span>Ideas to decide</span><b>{ideas.length}</b></header>{ideas.slice(0, 2).map((item) => <button className="pipeline-item" type="button" key={item.id} onClick={() => setActiveModal({ zone: zones[3], item })}><span className="platform-badge both">Idea</span><strong>{item.title}</strong><small>{item.content || "Open the idea to add your notes."}</small></button>)}{ideas.length === 0 && <button className="pipeline-empty" type="button" onClick={() => setActiveModal({ zone: zones[3] })}><Plus size={16} />Capture your first idea</button>}</div>
                <div className="pipeline-column"><header><span>Ready to create</span><b>—</b></header><button className="pipeline-empty" type="button" onClick={() => openStudio("create", "Help me choose a saved idea that is ready to turn into a post.")}><PenLine size={16} />Choose an idea with AI</button></div>
                <div className="pipeline-column"><header><span>Published</span><b>{results.length}</b></header>{results.slice(0, 2).map((item) => <button className="pipeline-item published" type="button" key={item.id} onClick={() => setActiveModal({ result: item })}><span className={`platform-badge ${item.platform?.toLowerCase()}`}>{item.platform || "Post"}</span><strong>{item.title}</strong><small>{item.metrics?.comments || 0} comments · {item.metrics?.saves || 0} saves</small></button>)}{results.length === 0 && <button className="pipeline-empty" type="button" onClick={() => setActiveModal({ result: null, kind: "result" })}><Plus size={16} />Log your first post</button>}</div>
              </div>
            </section>

            <aside className="surface strategy-summary">
              <div className="surface-heading"><div><span className="section-kicker">Your compass</span><h2>Current strategy</h2><p>The direction used to judge ideas and shape posts.</p></div><button className="icon-button" type="button" onClick={() => setView("strategy")} aria-label="Open strategy"><ArrowRight size={16} /></button></div>
              <div className="north-star"><span>North star</span><p>Show growing businesses how practical AI can remove repetitive work—and build trust in Moniré.</p></div>
              <div className="strategy-focus"><span>Current series</span><strong>Where businesses lose time</strong><div><i /></div><small>Start with one practical business example.</small></div>
              <div className="pillar-pills"><span>Practical automation</span><span>Building Moniré</span><span>Digital systems</span><span>Founder + mother</span></div>
              <button className="button soft" type="button" onClick={() => openStudio("strategy", "Help me refine my personal brand and content strategy based on what you know about me and Moniré.")}><MessageCircleMore size={16} />Refine my strategy</button>
            </aside>
          </div>

          <aside className="posting-rhythm compact-posting-rhythm" aria-label="Best posting times">
            <div className="posting-rhythm-heading"><span><CalendarClock size={18} /></span><div><strong>Posting rhythm</strong><small>Starting times to test · Switzerland</small></div></div>
            <div className="posting-slot"><span>LinkedIn</span><strong>Tuesday · 11:30</strong><small>Test Tue–Thu around lunchtime</small></div>
            <div className="posting-slot"><span>Instagram</span><strong>Wednesday · 18:00</strong><small>Test afternoon and early evening</small></div>
            <p>Your own results should replace generic “best times.”</p>
          </aside>
        </section>}

        {view === "strategy" && <section className="workflow-page">
          {renderPageHeader("Strategy", "Your brand compass", "Define what you want to be known for, who you want to reach, and the themes your content should return to.", <button className="button primary" type="button" onClick={() => openStudio("strategy", "Guide me through a strategy check-in. Ask one question at a time and save the useful conclusions.")}><MessageCircleMore size={16} />Start strategy session</button>)}
          <div className="strategy-grid">
            <section className="surface position-card"><span className="section-kicker">Positioning</span><h2>What you want to be known for</h2><p className="statement">Practical, flexible AI automations and digital systems that give growing businesses their time back.</p><button className="text-button" type="button" onClick={() => setActiveModal({ zone: zones[0] })}><Plus size={14} />Add or refine a business note</button></section>
            <section className="surface audience-card"><span className="section-kicker">Who you help</span><h2>Your ideal client</h2><p>Value-aware founders and decision-makers who want to remove repetitive work, trust expertise, and invest in solutions that genuinely improve how their business runs.</p></section>
            <section className="surface pillars-card"><div className="surface-heading"><div><span className="section-kicker">Content pillars</span><h2>Four reliable places to find ideas</h2><p>Use these as prompts—not rigid boxes.</p></div></div><div className="pillar-grid"><article><b>01</b><strong>Practical automation</strong><span>Spot manual work and show realistic improvements.</span></article><article><b>02</b><strong>Building Moniré</strong><span>Decisions, doubts, experiments, and progress.</span></article><article><b>03</b><strong>Digital systems</strong><span>Websites, dashboards, and better processes.</span></article><article><b>04</b><strong>Life behind the work</strong><span>Motherhood, ambition, balance, and building in Switzerland.</span></article></div></section>
            <section className="surface business-notes"><div className="surface-heading"><div><span className="section-kicker">Saved context</span><h2>Your business notes</h2><p>Facts and decisions the AI should remember.</p></div><button className="text-button" type="button" onClick={() => setActiveModal({ zone: zones[0] })}><Plus size={14} />Add note</button></div><div className="compact-source-grid">{businessItems.slice(0, 4).map((item) => <SourceCard key={item.id} item={item} onEdit={(selected) => setActiveModal({ zone: zones[0], item: selected })} />)}{businessItems.length === 0 && <button className="empty-state" type="button" onClick={() => setActiveModal({ zone: zones[0] })}><BriefcaseBusiness size={22} /><strong>Add your first business note</strong><span>Save your offer, audience, story, or positioning.</span></button>}</div></section>
          </div>
        </section>}

        {view === "ideas" && <section className="workflow-page">
          {renderPageHeader("Idea inbox", "Capture first. Decide later.", "Save rough thoughts, screenshots, hooks, captions, links, and voice notes—then decide what is worth developing.", <button className="button primary" type="button" onClick={() => setActiveModal({ zone: zones[3] })}><Plus size={16} />New idea</button>)}
          <button className="idea-capture" type="button" onClick={() => setActiveModal({ zone: zones[3] })}><span><ImageIcon size={23} /></span><div><strong>Paste, upload, dictate, or type anything</strong><small>Capture the thought now. You can organize and evaluate it later.</small></div><div className="capture-types"><span>Screenshot</span><span>Link</span><span>Text</span></div></button>
          <div className="idea-toolbar"><strong>{ideas.length} saved {ideas.length === 1 ? "idea" : "ideas"}</strong><button className="text-button" type="button" onClick={() => openStudio("ideas", "Review my saved ideas and help me decide which one is most strategically useful to develop next.")}><Sparkles size={14} />Evaluate with AI</button></div>
          <div className="idea-grid">{ideas.map((item) => <article className="idea-card" key={item.id}><div className="idea-card-top"><span>{item.type === "image" ? <ImageIcon size={14} /> : item.type === "link" ? <Link2 size={14} /> : <FileText size={14} />}{item.type}</span><button className="icon-button" type="button" onClick={() => setActiveModal({ zone: zones[3], item })} aria-label={`Edit ${item.title}`}><MoreHorizontal size={16} /></button></div>{item.image && <img src={item.image} alt="" />}<h2>{item.title}</h2><p>{item.content || "Open this idea to add what caught your attention."}</p>{item.takeaways?.length > 0 && <div className="pillar-pills">{item.takeaways.map((value) => <span key={value}>{value}</span>)}</div>}<footer><span>{item.tags?.[0] || "Unsorted idea"}</span><button type="button" onClick={() => openStudio("create", `Help me develop this saved idea into a post: ${item.title}.`)}>Develop <ArrowRight size={14} /></button></footer></article>)}{ideas.length === 0 && <button className="empty-state large" type="button" onClick={() => setActiveModal({ zone: zones[3] })}><Lightbulb size={28} /><strong>Your idea inbox is ready</strong><span>Add a rough thought, screenshot, hook, caption, or example you want to learn from.</span></button>}</div>
        </section>}

        {view === "create" && <section className="workflow-page create-page">
          {renderPageHeader("Guided studio", studioMode === "strategy" ? "Sharpen your content direction." : studioMode === "ideas" ? "Find and evaluate useful ideas." : studioMode === "review" ? "Work out what actually resonated." : "Turn one idea into a finished post.", "Use a guided conversation instead of staring at a blank page.")}
          <div className="studio-mode-tabs" role="tablist" aria-label="Studio mode">
            {[{ id: "strategy", label: "Strategize", icon: Compass }, { id: "ideas", label: "Get ideas", icon: Lightbulb }, { id: "create", label: "Create a post", icon: PenLine }, { id: "review", label: "Review results", icon: BarChart3 }].map(({ id, label, icon: Icon }) => <button key={id} className={studioMode === id ? "active" : ""} type="button" onClick={() => { setStudioMode(id); setStudioPrompt(""); }}><Icon size={16} />{label}</button>)}
          </div>
          <div className="studio-layout redesigned-studio-layout">
            <aside className="studio-context">
              <div className="studio-context-heading"><span>Use in this session</span><strong>{Object.values(connectedZones).filter(Boolean).length} active</strong></div>
              <p className="context-description">Choose which background knowledge the AI should use for this conversation.</p>
              {zones.map((zone) => {
                const zoneItems = items.filter((item) => item.zone === zone.id);
                return <button key={zone.id} type="button" className={`studio-context-card zone-${zone.color} ${connectedZones[zone.id] ? "active" : ""}`} onClick={() => setConnectedZones((current) => ({ ...current, [zone.id]: !current[zone.id] }))} aria-pressed={connectedZones[zone.id]}><span className="zone-number">{zone.step}</span><span><strong>{zone.title}</strong><small>{zone.description}</small><em>{zoneItems.length} {zoneItems.length === 1 ? "source" : "sources"}</em></span><span className="context-check">{connectedZones[zone.id] ? <Check size={13} /> : null}</span></button>;
              })}
              <button className="button secondary studio-add" type="button" onClick={() => { setView("brain"); setActiveModal({ zone: zones[0] }); }}><Plus size={15} />Add knowledge</button>
            </aside>
            <ChatStudio focus connectedZones={connectedZones} items={items} accessSecret={accessSecret} mode={studioMode} initialPrompt={studioPrompt} />
          </div>
        </section>}

        {view === "results" && <section className="workflow-page">
          {renderPageHeader("Results", "Learn what resonates—not just what gets likes.", "Log published posts, meaningful reactions, and business outcomes so Content Brain can spot useful patterns.", <button className="button primary" type="button" onClick={() => setActiveModal({ result: null, kind: "result" })}><Plus size={16} />Add published post</button>)}
          <div className="results-guide"><div><span>1</span><p><strong>Publish</strong><small>Post on LinkedIn or Instagram.</small></p></div><ArrowRight size={15} /><div><span>2</span><p><strong>Wait about 7 days</strong><small>Give the post time to travel.</small></p></div><ArrowRight size={15} /><div><span>3</span><p><strong>Add a screenshot</strong><small>Record metrics and what you noticed.</small></p></div><ArrowRight size={15} /><div><span>4</span><p><strong>Review the pattern</strong><small>Choose one thing to repeat or test.</small></p></div></div>
          {results.length > 0 ? <div className="results-layout"><section className="surface results-list"><div className="surface-heading"><div><span className="section-kicker">Performance log</span><h2>Your published posts</h2><p>Compare posts only after giving them a similar amount of time.</p></div></div>{results.map((item) => <button className="result-row" type="button" key={item.id} onClick={() => setActiveModal({ result: item })}><span className={`platform-badge ${item.platform?.toLowerCase()}`}>{item.platform || "Post"}</span><span className="result-title"><strong>{item.title}</strong><small>{item.format || "Post"} · {item.pillar || "Uncategorized"}</small></span><span><b>{item.metrics?.reach || "—"}</b><small>Reach</small></span><span><b>{item.metrics?.comments || "—"}</b><small>Comments</small></span><span><b>{item.metrics?.saves || "—"}</b><small>Saves</small></span><span><b>{item.metrics?.enquiries || "—"}</b><small>Enquiries</small></span><ArrowRight size={15} /></button>)}</section><aside className="surface learning-panel"><span className="section-kicker">Review with AI</span><h2>Find the signal behind the numbers</h2><p>Ask Content Brain to compare your hooks, topics, formats, and qualitative reactions—then suggest one sensible next experiment.</p><button className="button soft" type="button" onClick={() => openStudio("review", "Review my logged post results. Identify the strongest useful pattern, mention the sample size, and recommend one next experiment.")}><Sparkles size={16} />Analyze my results</button></aside></div> : <button className="empty-state results-empty" type="button" onClick={() => setActiveModal({ result: null, kind: "result" })}><BarChart3 size={30} /><strong>Add your first published post</strong><span>Paste the link, record its metrics after about seven days, and note any meaningful conversations or enquiries.</span><em>Add published post <ArrowRight size={14} /></em></button>}
        </section>}

        {view === "brain" && <section className="workflow-page">
          {renderPageHeader("My Brain", "Your background knowledge", "Store the facts, preferences, expertise, and inspiration that quietly support every strategy session and draft.", <button className="button primary" type="button" onClick={() => setActiveModal({ zone: zones[0] })}><Plus size={16} />Add knowledge</button>)}
          <div className="brain-intro"><BrainCircuit size={19} /><p><strong>You do not need to manage this every day.</strong><span>Update it when your business, voice, knowledge, or preferences change. Content Brain will use connected areas automatically in the studio.</span></p></div>
          <div className="knowledge-grid brain-grid">{zones.map((zone) => <KnowledgeZone key={zone.id} zone={zone} items={filteredItems.filter((item) => item.zone === zone.id)} connected={connectedZones[zone.id]} onToggle={() => setConnectedZones((current) => ({ ...current, [zone.id]: !current[zone.id] }))} onAdd={() => setActiveModal({ zone })} onEdit={(item) => setActiveModal({ zone, item })} />)}</div>
        </section>}
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {[navigation[0], navigation[1], navigation[2], navigation[3], navigation[4]].map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? "active" : ""} type="button" onClick={() => setView(id)}><Icon size={19} /><span>{label}</span></button>)}
      </nav>

      {activeModal?.zone && (
        <SourceModal
          zone={activeModal.zone}
          item={activeModal.item}
          onClose={() => setActiveModal(null)}
          onSave={persistItem}
          onDelete={deleteItem}
        />
      )}
      {activeModal && (activeModal.kind === "result" || Object.prototype.hasOwnProperty.call(activeModal, "result")) && <ResultModal item={activeModal.result} onClose={() => setActiveModal(null)} onSave={persistItem} onDelete={deleteItem} />}
    </div>
  );
}
