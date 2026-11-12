import React, { useState, useRef, useEffect } from 'react';
import { Ic } from './icons.jsx';
import { nodeOf, outsOf } from './data.js';

const cls = (...a) => a.filter(Boolean).join(' ');
export const ROLES = { owner: 'Propriétaire', edit: 'Éditeur', comment: 'Commentateur', view: 'Lecteur' };
export const PEOPLE0 = [
  { id: 'me', name: 'Vous', mail: 'cyril.renault@zenika.com', role: 'owner', tone: 'var(--accent)' },
  { id: 'marie', name: 'Marie Dupont', mail: 'marie.dupont@client.com', role: 'comment', tone: 'var(--ba)', client: true, online: true },
];
export const COMMENTS0 = {
  'stock_in:nsku': [{ id: 'c1', who: 'marie', text: 'On peut garder 1 par défaut, mais masquer ce champ pour les produits simples ?', at: '09:42', done: false }],
  'stock_in:loc': [{ id: 'c2', who: 'marie', text: 'L’emplacement doit rester facultatif (option « Ignorer »).', at: '09:47', done: true }],
};
export const REVIEW_LABEL = { draft: 'Brouillon', review: 'En relecture client', approved: 'Validé par le client' };

export const Avatar = ({ p, s = 26 }) => <span className="av" style={{ '--t': p.tone, width: s, height: s }} title={`${p.name} · ${ROLES[p.role]}`}>{p.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}{p.online && <i />}</span>;
const Tog = ({ l, v, set, sub }) => <label className="tog cl-tog"><input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} /><i /><span><b>{l}</b>{sub && <small>{sub}</small>}</span></label>;

/* ---- popover in the top bar ---- */
export function CollabPop({ collab, setCollab, people, setPeople, review, setReview, say }) {
  const [mail, setMail] = useState(''); const [role, setRole] = useState('comment');
  const invite = () => {
    if (!/^\S+@\S+\.\S+$/.test(mail)) { say('Adresse e-mail invalide'); return; }
    setPeople([...people, { id: mail, name: mail.split('@')[0].replace(/[._]/g, ' '), mail, role, tone: 'var(--bb)', client: !mail.endsWith('@zenika.com') }]); setMail(''); say('Invitation prête (démo : aucun e-mail envoyé)');
  };
  return <div className="pop collab-pop" onClick={(e) => e.stopPropagation()}>
    <Tog l="Collaboration" v={collab.on} set={(v) => setCollab({ ...collab, on: v, bot: v ? collab.bot : collab.bot })} sub="Invitez le client, commentez les étapes, faites valider." />
    {collab.on && <>
      <Tog l="Afficher les commentaires" v={collab.show} set={(v) => setCollab({ ...collab, show: v })} sub="Pastilles rouges sur les étapes commentées." />
      <div className="pg">Personnes</div>
      <div className="ppl">{people.map((p) => <div key={p.id} className="pp"><Avatar p={p} /><span><b>{p.name}</b><small>{p.client ? 'Client · ' : ''}{p.mail}</small></span>
        {p.role === 'owner' ? <em>{ROLES.owner}</em> : <select className="in sm" value={p.role} onChange={(e) => setPeople(people.map((x) => (x.id === p.id ? { ...x, role: e.target.value } : x)))}>{['edit', 'comment', 'view'].map((r) => <option key={r} value={r}>{ROLES[r]}</option>)}</select>}</div>)}</div>
      <div className="inv"><input className="in" placeholder="Inviter par e-mail…" value={mail} onChange={(e) => setMail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && invite()} />
        <select className="in sm" value={role} onChange={(e) => setRole(e.target.value)}>{['edit', 'comment', 'view'].map((r) => <option key={r} value={r}>{ROLES[r]}</option>)}</select><button className="btn" onClick={invite}>Inviter</button></div>
      <div className="pg">Validation client</div>
      <div className={cls('rv', review)}><Ic n={review === 'approved' ? 'check' : 'flag'} s={14} /><b>{REVIEW_LABEL[review]}</b></div>
      <div className="rv-b">
        {review === 'draft' && <button className="btn pri" onClick={() => { setReview('review'); say('Envoyé en relecture au client'); }}>Demander la validation</button>}
        {review === 'review' && <><button className="btn" onClick={() => setReview('draft')}>Annuler</button><button className="btn pri" onClick={() => { setReview('approved'); say('Validé (simulation côté client)'); }}>Simuler « Valider »</button></>}
        {review === 'approved' && <button className="btn" onClick={() => setReview('draft')}>Rouvrir</button>}
      </div>
    </>}
    <div className="sepl" />
    <Tog l="Assistant workflow (bot)" v={collab.bot} set={(v) => setCollab({ ...collab, bot: v })} sub="Vérifie le flux, propose et ajoute des étapes. Désactivable à tout moment." />
    {!collab.on && <p className="ph">Collaboration désactivée : le flux reste privé, sans commentaires ni invités.</p>}
  </div>;
}

/* ---- comments tab ---- */
export function CommentsTab({ doc, sel, setSel, comments, setComments, people, can }) {
  const [txt, setTxt] = useState('');
  const key = (id) => `${doc.id}:${id}`; const who = (id) => people.find((p) => p.id === id) || people[0];
  const list = sel ? comments[key(sel)] || [] : [];
  const add = () => { if (!txt.trim() || !sel) return; setComments({ ...comments, [key(sel)]: [...list, { id: 'c' + Date.now(), who: 'me', text: txt.trim(), at: new Date().toTimeString().slice(0, 5), done: false }] }); setTxt(''); };
  const toggle = (id) => setComments({ ...comments, [key(sel)]: list.map((c) => (c.id === id ? { ...c, done: !c.done } : c)) });
  const all = doc.nodes.flatMap((n) => (comments[key(n.id)] || []).filter((c) => !c.done).map((c) => ({ n, c })));
  const node = sel && nodeOf(doc, sel);
  return <div className="cm">
    {node ? <><div className="cm-h"><Ic n="chat" s={15} /><b>{node.data.label || 'Étape'}</b></div>
      {list.length === 0 && <p className="hintp">Aucun commentaire sur cette étape.</p>}
      {list.map((c) => <div key={c.id} className={cls('cmt', c.done && 'done')}><Avatar p={who(c.who)} s={24} /><div><div className="cmt-m"><b>{who(c.who).name}</b><span>{c.at}</span></div><p>{c.text}</p>
        <button className="lnk" onClick={() => toggle(c.id)}>{c.done ? 'Rouvrir' : 'Marquer comme résolu'}</button></div></div>)}
      {can ? <div className="cm-new"><textarea className="in" rows={2} placeholder="Commenter cette étape…" value={txt} onChange={(e) => setTxt(e.target.value)} /><button className="btn pri" onClick={add} disabled={!txt.trim()}>Commenter</button></div> : <p className="hintp">Votre rôle ne permet pas de commenter.</p>}
    </> : <p className="hintp">Sélectionnez une étape pour la commenter.</p>}
    <div className="sh">À traiter ({all.length})</div>
    {all.length === 0 && <p className="hintp">Rien en attente.</p>}
    {all.map(({ n, c }) => <button key={c.id} className="cm-open" onClick={() => setSel(n.id)}><b>{n.data.label || n.type}</b><span>{who(c.who).name} : {c.text}</span></button>)}
  </div>;
}

/* ---- assistant (démo : règles locales, aucun appel externe) ---- */
const SUGG = ['Vérifier mon workflow', 'Résumer pour le client', 'Ajouter une signature', 'Ajouter une photo de preuve'];
export function AssistantTab({ doc, checks, addStep, say }) {
  const [msgs, setMsgs] = useState([{ b: true, text: 'Bonjour, je peux vérifier ce flux, le résumer pour le client ou ajouter des étapes. Je propose, vous validez.' }]);
  const [q, setQ] = useState(''); const end = useRef(null);
  useEffect(() => { end.current && end.current.scrollIntoView({ block: 'end' }); }, [msgs]);
  const steps = doc.nodes.filter((n) => n.type === 'step');
  const reply = (raw) => {
    const t = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (/verif|controle|valide/.test(t)) {
      const bad = checks.filter((c) => !c.ok); const tips = [];
      if (!steps.some((n) => n.data.kind === 'input' && !n.data.required)) tips.push('Aucune étape facultative : pensez à une option « Ignorer » pour les saisies non bloquantes.');
      steps.filter((n) => n.data.kind === 'input' && !n.data.help && n.data.input !== 'signature').slice(0, 2).forEach((n) => tips.push(`« ${n.data.label} » n’a pas d’aide affichée.`));
      return { text: bad.length ? `${bad.length} point(s) bloquant(s) : ${bad.map((c) => c.label).join(' ; ')}.` : 'Contrôles OK : le flux est valide.', tips };
    }
    if (/resum|client/.test(t)) return { text: `Ce flux « ${doc.title} » compte ${steps.length} écran(s) : ${steps.slice(0, 6).map((n) => n.data.label).join(', ')}${steps.length > 6 ? '…' : ''}. ${doc.nodes.some((n) => n.type === 'loop') ? 'Il répète une sous-routine par élément de liste.' : ''}${doc.nodes.some((n) => n.type === 'fork') ? ' Certaines étapes se font en parallèle.' : ''}` };
    const m = t.match(/ajout\w*\s+(.*)/);
    if (m || /signature|photo/.test(t)) { const label = (m ? raw.replace(/^.*?ajout\w*\s+(une?\s+|l[ae]\s+)?/i, '') : raw).trim() || raw; const nice = label.charAt(0).toUpperCase() + label.slice(1); return { text: `Je propose d’ajouter l’étape « ${nice} » avant la fin du flux.`, apply: nice }; }
    return { text: 'Je sais vérifier le flux, le résumer ou ajouter une étape (ex. « ajoute une photo du quai »).' };
  };
  const send = (raw) => { if (!raw.trim()) return; setMsgs((m) => [...m, { text: raw }, { b: true, ...reply(raw) }]); setQ(''); };
  return <div className="bot">
    <div className="bot-n"><Ic n="zap" s={13} />Assistant · démo, règles locales (pas encore relié à un modèle)</div>
    <div className="bot-l">{msgs.map((m, i) => <div key={i} className={cls("bmsg", m.b && "fb")}><p>{m.text}</p>{m.tips && m.tips.map((x, k) => <p key={k} className="tip">• {x}</p>)}
      {m.apply && !m.done && <button className="btn pri sm" onClick={() => { addStep(m.apply); setMsgs((all) => all.map((x, k) => (k === i ? { ...x, done: true } : x))); }}>Appliquer</button>}{m.done && <small className="mut">Ajoutée ✓</small>}</div>)}<div ref={end} /></div>
    <div className="bot-s">{SUGG.map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}</div>
    <div className="bot-i"><input className="in" placeholder="Demandez quelque chose…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send(q)} /><button className="btn pri" onClick={() => send(q)}>Envoyer</button></div>
  </div>;
}
