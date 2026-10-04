// Dates are entered in Vilnius, independently of the browser's own time zone.
const zoneFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Vilnius', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
const timeCache = new Map();
export function vilniusCandidates(date, time) {
  const key = `${date}/${time}`;
  if (timeCache.has(key)) return timeCache.get(key).slice();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return [];
  const [y,m,d] = date.split('-').map(Number), [h,min] = time.split(':').map(Number);
  const guess = Date.UTC(y,m-1,d,h,min);
  if (new Date(guess).toISOString().slice(0,16) !== `${date}T${time}`) return [];
  const matches = [];
  for (let offset = -14*60; offset <= 14*60; offset += 15) {
    const candidate = new Date(guess - offset*60000);
    const parts = Object.fromEntries(zoneFormatter.formatToParts(candidate).map(p => [p.type,p.value]));
    if (`${parts.year}-${parts.month}-${parts.day}` === date && `${parts.hour}:${parts.minute}` === time) matches.push(candidate.toISOString());
  }
  const result = [...new Set(matches)].sort();
  if (timeCache.size > 1000) timeCache.clear();
  timeCache.set(key,result);
  return result.slice();
}
export function vilniusInstant(date, time, fold = '') {
  const candidates = vilniusCandidates(date,time);
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 2 && ['first','second'].includes(fold)) return candidates[fold === 'first' ? 0 : 1];
  return null;
}
export function moneyCents(value, allowZero = true) {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction=''] = text.split('.');
  const cents = Number(whole)*100 + Number(fraction.padEnd(2,'0'));
  return Number.isSafeInteger(cents) && cents <= 2147483647 && (allowZero ? cents >= 0 : cents > 0) ? cents : null;
}
export function installTimeChoices(root) {
  root.querySelectorAll('form').forEach(form => {
    if (!form.elements.date && !form.elements.holdUntilDate) return;
    if (form.querySelector('[data-dst-choice]')) return;
    const label = document.createElement('label'); label.dataset.dstChoice = '';
    label.innerHTML = 'When clocks go back<span class="admin-select-wrap"><select name="dstFold"><option value="">Choose if a time repeats</option><option value="first">First occurrence (summer time)</option><option value="second">Second occurrence (winter time)</option></select></span><small>Required only for a repeated Vilnius time. Times skipped by the spring clock change are unavailable.</small>';
    const error = form.querySelector('[data-action-error]');
    form.insertBefore(label,error || null);
    const update = () => {
      const date = form.elements.date?.value || form.elements.holdUntilDate?.value;
      const times = [form.elements.startTime?.value,form.elements.endTime?.value,form.elements.holdUntilTime?.value].filter(Boolean);
      const weeks = form.elements.repeatWeekly?.checked ? Number(form.elements.repeatWeeks?.value || 1) : 1;
      let ambiguous = false;
      for (let i=0;i<Math.min(52,weeks);i++) {
        const day = new Date(`${date}T12:00:00Z`); if (!Number.isFinite(day.getTime())) continue;
        day.setUTCDate(day.getUTCDate()+i*7);
        ambiguous ||= times.some(time => vilniusCandidates(day.toISOString().slice(0,10),time).length === 2);
      }
      label.hidden = !ambiguous; form.elements.dstFold.required = ambiguous;
      if (!ambiguous) form.elements.dstFold.value = '';
    };
    form.addEventListener('change',update); form.addEventListener('input',update); update();
  });
}

// Persist only a hash and random identifier. Form contents never enter storage.
export function createOperationStore(storage, scope, now = () => Date.now(), uuid = () => crypto.randomUUID()) {
  const key = `checkauto-operation/${scope}`;
  let memory = {};
  function read() { try { memory = JSON.parse(storage.getItem(key) || '{}'); } catch {} return memory; }
  function write(records) { memory=records; try { storage.setItem(key,JSON.stringify(records)); } catch {} }
  return {
    async attach(payload) {
      if (payload.idempotencyKey) return payload;
      const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)));
      const fingerprint = Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
      const records = read();
      Object.keys(records).forEach(id => { if (now()-records[id].at > 30*86400000) delete records[id]; });
      records[fingerprint] ||= {id:uuid(),at:now()}; write(records);
      return {...payload,idempotencyKey:records[fingerprint].id};
    },
    complete(id) { const records=read(); Object.keys(records).forEach(k=>{if(records[k].id===id)delete records[k];});write(records); },
    clear() { memory={};try {storage.removeItem(key);}catch{} }
  };
}

export async function withSharedSessionLock(sessionId, task, locks = globalThis.navigator?.locks) {
  if (locks?.request) return locks.request(`checkauto-session/${sessionId}`,{mode:'exclusive'},task);
  let storage;
  try { storage=globalThis.localStorage; } catch { return task(); }
  if (!storage) return task();
  const key=`checkauto-refresh-lock/${sessionId}`, owner=crypto.randomUUID(), deadline=Date.now()+20000;
  while(Date.now()<deadline) {
    let lease;try{lease=JSON.parse(storage.getItem(key)||'null');}catch{return task();}
    if(!lease || lease.until<Date.now()) {
      storage.setItem(key,JSON.stringify({owner,until:Date.now()+15000}));
      await new Promise(resolve=>setTimeout(resolve,75));
      if(JSON.parse(storage.getItem(key)||'null')?.owner===owner) {
        try{return await task();}finally{if(JSON.parse(storage.getItem(key)||'null')?.owner===owner)storage.removeItem(key);}
      }
    }
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('Another tab is refreshing this session. Try again shortly.');
}
