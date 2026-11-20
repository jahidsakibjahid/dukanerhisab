const $ = s => document.querySelector(s);
const KEY = 'baki.v1';

function def() { return { customers: [], entries: [] }; }
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    return d && Array.isArray(d.customers) && Array.isArray(d.entries) ? d : def();
  } catch { return def(); }
}
const save = () => localStorage.setItem(KEY, JSON.stringify(S));

let S = load(), q = '', onlyDue = false, openId = null;

/* ---------- helpers ---------- */
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const today = () => iso(new Date());
const tk = n => (n < 0 ? '-' : '') + '৳' + Math.abs(n).toLocaleString('bn-BD', { maximumFractionDigits: 2 });
const num = n => n.toLocaleString('bn-BD');
const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r2 = n => Math.round(n * 100) / 100;

function toast(m) {
  const t = $('#toast'); t.textContent = m; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}

function bal(c) {
  let baki = 0, jama = 0;
  S.entries.forEach(e => { if (e.cid === c.id) e.type === 'baki' ? baki += e.amount : jama += e.amount; });
  return { baki, jama, due: r2(baki - jama) };
}
const withBal = () => S.customers.map(c => ({ ...c, ...bal(c) }));

/* ---------- render ---------- */
function renderStats() {
  const l = withBal();
  const totalDue = l.reduce((a, c) => a + Math.max(c.due, 0), 0);
  const given = l.reduce((a, c) => a + c.baki, 0), got = l.reduce((a, c) => a + c.jama, 0);
  const owing = l.filter(c => c.due > 0).length;
  $('#stats').innerHTML = [
    ['hot', 'মোট বাকি (পাওনা)', tk(totalDue)],
    ['', 'বাকি আছে এমন কাস্টমার', num(owing) + ' জন'],
    ['good', 'মোট আদায় (জমা)', tk(got)],
    ['', 'মোট দেওয়া বাকি', tk(given)]
  ].map(([c, l, v]) => `<div class="card stat ${c}"><small>${l}</small><b>${v}</b></div>`).join('');
}

function renderTable() {
  const k = q.toLowerCase();
  const l = withBal()
    .filter(c => (!k || (c.name + ' ' + (c.phone || '')).toLowerCase().includes(k)) && (!onlyDue || c.due > 0))
    .sort((a, b) => b.due - a.due || a.name.localeCompare(b.name));
  $('#ccount').textContent = `(${num(l.length)})`;
  $('#tbody').innerHTML = l.length ? l.map(c => `<tr>
    <td class="nm"><b>${esc(c.name)}</b>${c.phone ? `<small>${esc(c.phone)}</small>` : ''}</td>
    <td class="r">${tk(c.baki)}</td><td class="r">${tk(c.jama)}</td>
    <td class="r due ${c.due <= 0 ? 'zero' : ''}">${c.due > 0 ? tk(c.due) : c.due < 0 ? 'অগ্রিম ' + tk(-c.due) : 'পরিশোধ'}</td>
    <td class="r"><button class="btn ghost sm" data-open="${c.id}">দেখুন</button></td></tr>`).join('')
    : `<tr><td colspan="5" class="empty">${S.customers.length ? 'কোনো কাস্টমার পাওয়া যায়নি' : 'এখনো কোনো কাস্টমার নেই। ডানের ফর্ম থেকে প্রথম বাকি যোগ করুন।'}</td></tr>`;
}

function renderLists() {
  $('#clist').innerHTML = S.customers.map(c => `<option value="${esc(c.name)}">`).join('');
  const owing = withBal().filter(c => c.due > 0).sort((a, b) => a.name.localeCompare(b.name));
  const cur = $('#jcust').value;
  $('#jcust').innerHTML = owing.length
    ? owing.map(c => `<option value="${c.id}" ${c.id === cur ? 'selected' : ''}>${esc(c.name)}</option>`).join('')
    : '<option value="">কারো বাকি নেই</option>';
  jhint();
}

function jhint() {
  const c = S.customers.find(x => x.id === $('#jcust').value);
  if (!c) { $('#jhint').textContent = 'জমা নেওয়ার মতো কোনো বাকি নেই'; $('#jamt').removeAttribute('max'); return; }
  const d = bal(c).due;
  $('#jhint').textContent = `${c.name}-এর এখন বাকি: ${tk(d)}`;
  $('#jamt').max = d;
}

function renderDialog() {
  const c = S.customers.find(x => x.id === openId), dlg = $('#dlg');
  if (!c) { if (dlg.open) dlg.close(); return; }
  const b = bal(c);
  const l = S.entries.filter(e => e.cid === c.id).sort((a, z) => z.date.localeCompare(a.date) || z.id.localeCompare(a.id));
  dlg.innerHTML = `<div class="dh"><div><h3>${esc(c.name)}</h3><small>${esc(c.phone || 'ফোন নেই')}</small></div><button class="btn ghost sm" id="dclose">বন্ধ করুন</button></div>
    <div class="big">${b.due > 0 ? 'এখন বাকি: ' + tk(b.due) : b.due < 0 ? 'অগ্রিম: ' + tk(-b.due) : 'সব পরিশোধ ✓'}</div>
    <ul class="led">${l.length ? l.map(e => `<li><div class="t"><b>${e.type === 'baki' ? 'বাকি' : 'জমা'}</b><small>${fmt(e.date)}${e.note ? ' • ' + esc(e.note) : ''}</small></div>
      <span class="a ${e.type}">${e.type === 'baki' ? '+' : '−'}${tk(e.amount)}</span><button class="x" data-del="${e.id}" aria-label="মুছুন">✕</button></li>`).join('') : '<li class="empty">কোনো হিসাব নেই</li>'}</ul>
    <div class="acts">${b.due > 0 ? `<button class="btn" id="dpay">টাকা জমা নিন</button>` : ''}<button class="btn danger" id="ddel">কাস্টমার মুছুন</button></div>`;
  if (!dlg.open) dlg.showModal();
}

function render() { renderStats(); renderTable(); renderLists(); if (openId) renderDialog(); }

/* ---------- tabs ---------- */
function setTab(t) {
  document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  $('#fbaki').hidden = t !== 'baki'; $('#fjama').hidden = t !== 'jama';
}
document.querySelectorAll('.seg button').forEach(b => b.onclick = () => setTab(b.dataset.t));

/* ---------- add baki ---------- */
$('#fbaki').onsubmit = e => {
  e.preventDefault();
  const name = $('#bname').value.trim().replace(/\s+/g, ' '), amount = parseFloat($('#bamt').value), phone = $('#bphone').value.trim();
  if (!name) return toast('কাস্টমারের নাম লিখুন');
  if (!(amount > 0)) return toast('বাকির পরিমাণ ০ এর বেশি হতে হবে');
  let c = S.customers.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!c) { c = { id: uid(), name, phone }; S.customers.push(c); }
  else if (phone && !c.phone) c.phone = phone;
  S.entries.push({ id: uid(), cid: c.id, type: 'baki', amount, date: $('#bdate').value, note: $('#bnote').value.trim() });
  save(); e.target.reset(); $('#bdate').value = today(); render();
  toast(`${c.name}-এর বাকি যোগ হয়েছে`);
};

/* ---------- add payment ---------- */
$('#jcust').onchange = jhint;
$('#fjama').onsubmit = e => {
  e.preventDefault();
  const c = S.customers.find(x => x.id === $('#jcust').value), amount = parseFloat($('#jamt').value);
  if (!c) return toast('কাস্টমার বেছে নিন');
  if (!(amount > 0)) return toast('জমার পরিমাণ ০ এর বেশি হতে হবে');
  const due = bal(c).due;
  if (amount > due + 0.001) return toast(`বাকির চেয়ে বেশি জমা নেওয়া যাবে না (বাকি ${tk(due)})`);
  S.entries.push({ id: uid(), cid: c.id, type: 'jama', amount, date: $('#jdate').value, note: $('#jnote').value.trim() });
  save(); $('#jamt').value = ''; $('#jnote').value = ''; $('#jdate').value = today(); render();
  const left = bal(c).due;
  toast(left > 0 ? `জমা হয়েছে। ${c.name}-এর বাকি ${tk(left)}` : `${c.name}-এর সব বাকি পরিশোধ ✓`);
};

/* ---------- list, search, dialog ---------- */
$('#search').oninput = e => { q = e.target.value.trim(); renderTable(); };
$('#onlydue').onchange = e => { onlyDue = e.target.checked; renderTable(); };
$('#tbody').onclick = e => {
  const b = e.target.closest('[data-open]'); if (!b) return;
  openId = b.dataset.open; renderDialog();
};
$('#dlg').onclick = e => {
  const t = e.target;
  if (t.id === 'dclose' || t === $('#dlg')) { openId = null; $('#dlg').close(); return; }
  if (t.dataset.del) {
    if (!confirm('এই হিসাবটি মুছবেন?')) return;
    S.entries = S.entries.filter(x => x.id !== t.dataset.del); save(); render(); toast('মুছে ফেলা হয়েছে');
  }
  if (t.id === 'dpay') {
    const id = openId; openId = null; $('#dlg').close(); setTab('jama');
    $('#jcust').value = id; jhint(); $('#jamt').focus(); $('#fjama').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (t.id === 'ddel') {
    const c = S.customers.find(x => x.id === openId);
    if (!confirm(`${c.name} এবং তার সব হিসাব মুছে যাবে। নিশ্চিত?`)) return;
    S.customers = S.customers.filter(x => x.id !== c.id); S.entries = S.entries.filter(x => x.cid !== c.id);
    save(); openId = null; $('#dlg').close(); render(); toast('কাস্টমার মুছে ফেলা হয়েছে');
  }
};
$('#dlg').onclose = () => { openId = null; };

/* ---------- backup ---------- */
$('#export').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
  a.download = `baki-backup-${today()}.json`; a.click(); URL.revokeObjectURL(a.href);
};
$('#import').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!Array.isArray(d.customers) || !Array.isArray(d.entries)) throw 0;
      if (S.customers.length && !confirm('বর্তমান তথ্য মুছে ব্যাকআপের তথ্য বসবে। চালিয়ে যাবেন?')) return;
      S = { customers: d.customers, entries: d.entries }; save(); render(); toast('ব্যাকআপ ফেরত এসেছে');
    } catch { toast('এটি সঠিক ব্যাকআপ ফাইল নয়'); }
  };
  r.readAsText(f); e.target.value = '';
};
$('#sample').onclick = () => {
  if (S.customers.length && !confirm('নমুনা তথ্য আপনার বর্তমান তথ্যের সাথে যোগ হবে। চালিয়ে যাবেন?')) return;
  const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
  [['রহিম ভাই', '01711000000', [[12, 'baki', 2500, 'চাল-ডাল'], [5, 'jama', 1000, '']]],
   ['করিম স্টোর', '', [[20, 'baki', 8000, 'মালামাল'], [8, 'jama', 3000, 'বিকাশ']]],
   ['সুমি আপা', '01822000000', [[3, 'baki', 650, 'তেল']]]]
    .forEach(([name, phone, es]) => {
      const c = { id: uid(), name, phone }; S.customers.push(c);
      es.forEach(([d, type, amount, note]) => S.entries.push({ id: uid(), cid: c.id, type, amount, date: day(d), note }));
    });
  save(); render(); toast('নমুনা তথ্য যোগ হয়েছে');
};
$('#reset').onclick = () => {
  if (!confirm('সব কাস্টমার ও হিসাব মুছে যাবে। আর ফেরানো যাবে না। নিশ্চিত?')) return;
  S = def(); save(); render(); toast('সব তথ্য মুছে ফেলা হয়েছে');
};

/* ---------- init ---------- */
$('#bdate').value = today(); $('#jdate').value = today();
render();
