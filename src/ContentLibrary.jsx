import { useState } from 'react';
import {
  PlusIcon as Plus,
  MagnifyingGlassIcon as Search,
  MagicWandIcon as Sparkles,
  ArrowUpRightIcon as ArrowUpRight,
  LightbulbFilamentIcon as Lightbulb,
  PencilSimpleLineIcon as PenLine
} from "@phosphor-icons/react";

export default function ContentLibrary({ items, onEdit, onAdd, onStudio, onSave }) {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('All topics');
  const [channel, setChannel] = useState('All channels');
  const [status, setStatus] = useState('All content');
  const [thought, setThought] = useState('');
  const topics = [...new Set(items.map(i => i.topic || 'Unsorted'))].sort();
  const visible = items.filter(i => (topic === 'All topics' || (i.topic || 'Unsorted') === topic) && (channel === 'All channels' || i.platform === channel) && (status === 'All content' || (i.status || 'Idea') === status) && `${i.title} ${i.content} ${i.hook} ${i.topic} ${i.draft}`.toLowerCase().includes(query.toLowerCase()));
  function saveThought() {
    if (!thought.trim()) return;
    onSave({ id: crypto.randomUUID(), zone: 'inspiration', type: 'note', title: thought.trim().split('\n')[0].slice(0, 90), content: thought.trim(), status: 'Idea', topic: 'Unsorted', createdAt: Date.now(), updatedAt: Date.now() });
    setThought('');
  }
  return <section className="workflow-page library-page">
    <header className="page-header"><div><span className="eyebrow">YOUR CREATIVE WORKSPACE</span><h1>A home for every idea.</h1><p>Collect your thoughts. Find your angle. Create something worth sharing.</p></div><button className="button primary" onClick={onAdd}><Plus size={17}/>New idea</button></header>
    <div className="thought-panel"><div><h2>What’s on your mind?</h2><p>A conversation, a small win, an opinion you can’t shake.<br/>Your next post starts here.</p></div><div className="thought-input"><textarea aria-label="Your rough thought" value={thought} onChange={e => setThought(e.target.value)} placeholder="Today I noticed that…" rows={3}/><footer><button className="text-button" disabled={!thought.trim()} onClick={saveThought}><Plus size={14}/>Save thought</button><button className="button primary" disabled={!thought.trim()} onClick={() => onStudio('ideas', `Turn this thought into 3 distinct content ideas, grounded in my voice and past results. For each include a topic, channel, hook and short description. My thought: ${thought}`)}><Sparkles size={14}/>Find the angles</button></footer></div></div>
    <div className="library-heading"><div><h2>Your content library <span>{items.length}</span></h2><p>Everything you want to say, all in one place.</p></div><button className="text-button" onClick={() => onStudio('ideas', 'Use my saved thoughts and past posts to suggest 3 specific new ideas. Explain which thought or result inspired each. Include topic, channel, description and hook.')}><Sparkles size={15}/>Suggest ideas for me</button></div>
    <div className="library-tabs">{['All content', 'Idea', 'Draft', 'Ready'].map(s => <button key={s} className={status === s ? 'active' : ''} onClick={() => setStatus(s)}>{s === 'Idea' ? 'Ideas' : s === 'Draft' ? 'Drafts' : s}<span>{s === 'All content' ? items.length : items.filter(i => (i.status || 'Idea') === s).length}</span></button>)}</div>
    <div className="library-filters"><label><Search size={16}/><input aria-label="Search content library" placeholder="Find an idea, hook or phrase…" value={query} onChange={e => setQuery(e.target.value)}/></label><select aria-label="Filter by topic" value={topic} onChange={e => setTopic(e.target.value)}><option>All topics</option>{topics.map(t => <option key={t}>{t}</option>)}</select><select aria-label="Filter by channel" value={channel} onChange={e => setChannel(e.target.value)}>{['All channels', 'LinkedIn', 'Instagram', 'Newsletter', 'TikTok', 'Other'].map(c => <option key={c}>{c}</option>)}</select></div>
    <div className="library-table-wrap"><table className="library-table"><thead><tr><th>Idea & description</th><th>Topic</th><th>Channel</th><th>Hook</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr></thead><tbody>{visible.map(item => <tr key={item.id}><td><button className="idea-title" onClick={() => onEdit(item)}>{item.title}</button><p>{item.content || 'Add a description…'}</p></td><td><span className="topic-tag">{item.topic || 'Unsorted'}</span></td><td>{item.platform || 'Not chosen'}</td><td><p className="hook-cell">{item.hook || 'Find your opening line…'}</p></td><td><span className={`status-tag status-${item.status || 'Idea'}`}>{item.status || 'Idea'}</span></td><td><button className="icon-button" aria-label={`Develop ${item.title}`} onClick={() => onStudio('create', `Develop or rewrite this idea in my voice. Keep its channel and topic. Here is the complete idea: ${JSON.stringify(item)}`)}><ArrowUpRight size={17}/></button></td></tr>)}</tbody></table></div>
    {!visible.length && <div className="library-empty"><span><Lightbulb size={25}/></span><h3>{items.length ? 'No ideas match these filters' : 'Big ideas start as small thoughts.'}</h3><p>{items.length ? 'Try another topic, channel or search.' : 'Save a thought above or add your first idea. The details can come later.'}</p>{!items.length && <button className="button secondary" onClick={onAdd}><PenLine size={15}/>Capture your first idea</button>}</div>}
    <p className="library-footnote">A little structure, more room to create. Open any idea to edit its details and copy.</p>
  </section>;
}

export function PerformanceSummary({ items }) {
  const [metric, setMetric] = useState('saves');
  const measured = items.filter(i => i.metrics?.[metric] !== '' && i.metrics?.[metric] != null && Number.isFinite(Number(i.metrics[metric])));
  const ranked = [...measured].sort((a,b) => Number(b.metrics[metric]) - Number(a.metrics[metric])).slice(0,3);
  return <section className="performance-summary"><div><span className="eyebrow">LEARN FROM YOUR CONTENT</span><h2>What’s working best?</h2><p>Based on your manually recorded metrics. Missing values are excluded; compare posts at a similar age.</p></div><label>Compare by <select value={metric} onChange={e => setMetric(e.target.value)}>{['saves','reach','comments','shares','enquiries'].map(m => <option key={m} value={m}>{m}</option>)}</select></label><div className="ranking">{ranked.map((i,index) => <div key={i.id}><span>0{index+1}</span><strong>{i.title}<small>{i.platform} · {i.pillar}</small></strong><b>{Number(i.metrics[metric]).toLocaleString()}<small>{metric}</small></b></div>)}{!ranked.length && <p>Add {metric} to a published post to see your strongest content here.</p>}</div></section>;
}
