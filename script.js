<script>
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_KEY = 'YOUR_ANON_KEY';
const supabase = supabaseClient.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentTab = 'invoice', currentUser = null, currentInvoiceId = null, viewingSharedInvoice = false, paymentStatus = 'Pending', currentTemplate = 'modern';
const PROFESSIONS = ['Plumber','Electrician','Cleaner','Mechanic','Carpenter','Painter','HVAC Technician','Landscaper','General Contractor','IT Support','Web Developer','Graphic Designer','Photographer','Consultant','Other'];
const CURRENCY_SYMBOLS = { USD:'$', EUR:'\u20AC', GBP:'\u00A3', PKR:'Rs', INR:'\u20B9', AED:'\u062F.\u0625' };

document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    populateDropdowns();
    generateInvoiceNumber();
    document.getElementById('invoice_date').valueAsDate = new Date();
    const { data:{session} } = await supabase.auth.getSession();
    if (session?.user) { currentUser = session.user; updateAccountUI(); }
    supabase.auth.onAuthStateChange((e, s) => { currentUser = s?.user || null; updateAccountUI(); });
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) await loadSharedInvoice(id);
});

function showToast(m) { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500); }
function openModal(i) { document.getElementById(i).classList.remove('hidden'); lucide.createIcons(); }
function closeModal(i) { document.getElementById(i).classList.add('hidden'); }
function scrollToApp() { document.getElementById('app-interface').scrollIntoView({ behavior:'smooth' }); }
function toggleDarkMode() { document.documentElement.classList.toggle('dark'); }

function populateDropdowns() {
    const o = PROFESSIONS.map(p => '<option value="' + p + '">' + p + '</option>').join('');
    ['c_service','q_profession','w_profession'].forEach(id => { const e = document.getElementById(id); if (e) e.innerHTML = '<option value="">Select...</option>' + o; });
}
function generateInvoiceNumber() { const d = new Date(), y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), da = String(d.getDate()).padStart(2,'0'), r = Math.floor(Math.random()*9000)+1000; document.getElementById('invoice_num').value = 'INV-' + y + m + da + '-' + r; }

function switchTab(t) {
    currentTab = t; currentInvoiceId = null; viewingSharedInvoice = false;
    ['invoice','quote','request'].forEach(x => {
        const b = document.getElementById('tab-' + x);
        if (x === t) { b.classList.add('tab-active'); b.classList.remove('text-slate-400'); }
        else { b.classList.remove('tab-active'); b.classList.add('text-slate-400'); }
    });
    document.getElementById('request-fields').classList.toggle('hidden', t !== 'request');
    document.getElementById('quote-fields').classList.toggle('hidden', t !== 'quote');
    document.getElementById('worker-fields').classList.toggle('hidden', t !== 'invoice');
    document.getElementById('amount-section').classList.toggle('hidden', t === 'request');
    document.getElementById('payment-status-section').classList.toggle('hidden', t !== 'invoice');
    document.getElementById('doc-num-label').textContent = t === 'request' ? 'Request ID' : t === 'quote' ? 'Quote Number' : 'Invoice Number';
    document.querySelectorAll('#form-content input, #form-content select, #form-content textarea').forEach(el => el.removeAttribute('disabled'));
    const a = document.querySelector('.flex.gap-4.pt-6'); if (a) a.classList.remove('hidden');
    const b = document.querySelector('#form-content > .bg-emerald-50'); if (b) b.remove();
    generateInvoiceNumber(); updatePreview();
}

function setStatus(s) { paymentStatus = s; document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active')); document.getElementById('status-' + s.toLowerCase()).classList.add('active'); updatePreview(); }

function setTemplate(t) {
    currentTemplate = t;
    document.getElementById('tpl-modern').className = 'px-3 py-1 rounded-full text-xs font-bold ' + (t === 'modern' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400');
    document.getElementById('tpl-minimal').className = 'px-3 py-1 rounded-full text-xs font-bold ' + (t === 'minimal' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400');
    const c = document.getElementById('invoice-card');
    if (t === 'minimal') { c.style.border = '2px solid #111'; c.style.boxShadow = 'none'; }
    else { c.style.border = 'none'; c.style.boxShadow = '0 20px 50px rgba(0,0,0,0.1)'; }
}

function updatePreview() {
    const d = getFormData(), sym = getCurrencySymbol(d.currency);
    document.getElementById('prev-type').textContent = currentTab === 'request' ? 'SERVICE REQUEST' : currentTab === 'quote' ? 'QUOTE' : 'INVOICE';
    document.getElementById('prev-num').textContent = d.invoiceNum;
    document.getElementById('prev-date').textContent = fmtDate(d.date);
    const due = document.getElementById('prev-due');
    if (d.dueDate && currentTab === 'invoice') { due.textContent = 'Due: ' + fmtDate(d.dueDate); due.classList.remove('hidden'); }
    else due.classList.add('hidden');
    document.getElementById('prev-biz').textContent = d.wBizName || 'Your Business Name';
    document.getElementById('prev-worker').textContent = d.wProf || 'Professional Service';
    document.getElementById('prev-cust').textContent = d.cName || 'Customer Name';
    const ph = document.getElementById('prev-cust-phone'); if (d.cPhone) { ph.textContent = d.cPhone; ph.classList.remove('hidden'); } else ph.classList.add('hidden');
    const em = document.getElementById('prev-cust-email'); if (d.cEmail) { em.textContent = d.cEmail; em.classList.remove('hidden'); } else em.classList.add('hidden');
    document.getElementById('prev-desc').textContent = d.desc || 'No description provided yet...';
    const re = document.getElementById('prev-request-extras');
    if (currentTab === 'request') { re.classList.remove('hidden'); document.getElementById('prev-service').textContent = d.cService || '-'; document.getElementById('prev-pref-date').textContent = d.preferredDate ? fmtDate(d.preferredDate) : '-'; document.getElementById('prev-budget').textContent = d.budget ? sym + parseFloat(d.budget).toFixed(2) : '-'; }
    else re.classList.add('hidden');
    const qe = document.getElementById('prev-quote-extras');
    if (currentTab === 'quote') { qe.classList.remove('hidden'); document.getElementById('prev-valid').textContent = d.validUntil ? fmtDate(d.validUntil) : '-'; document.getElementById('prev-terms').textContent = d.terms || '-'; }
    else qe.classList.add('hidden');
    const tot = document.getElementById('prev-totals');
    if (currentTab !== 'request') {
        tot.classList.remove('hidden');
        const sub = parseFloat(d.amount) || 0, tax = (sub * (parseFloat(d.taxRate) || 0)) / 100, disc = (sub * (parseFloat(d.discRate) || 0)) / 100, total = sub + tax - disc;
        document.getElementById('prev-subtotal').textContent = sym + sub.toFixed(2);
        document.getElementById('prev-tax').textContent = sym + tax.toFixed(2);
        document.getElementById('prev-discount').textContent = '-' + sym + disc.toFixed(2);
        document.getElementById('prev-total').textContent = sym + total.toFixed(2);
    } else tot.classList.add('hidden');
    const pm = document.getElementById('prev-payment-method');
    if (currentTab === 'invoice' && d.paymentMethod) { pm.classList.remove('hidden'); document.getElementById('prev-pay-method').textContent = d.paymentMethod; }
    else pm.classList.add('hidden');
    const sb = document.getElementById('signature-block');
    if (currentTab === 'invoice' && d.signature) { sb.classList.remove('hidden'); document.getElementById('prev-signature').textContent = d.signature; }
    else sb.classList.add('hidden');
    const st = document.getElementById('prev-status');
    st.textContent = paymentStatus;
    st.className = 'inline-block px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider ' + (paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' : paymentStatus === 'Overdue' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700');
    generateQR();
}

function fmtDate(s) { if (!s) return '-'; const d = new Date(s); return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }); }
function getCurrencySymbol(c) { return CURRENCY_SYMBOLS[c] || '$'; }
function getFormData() {
    const b = { invoiceNum: document.getElementById('invoice_num').value, date: document.getElementById('invoice_date').value, desc: document.getElementById('work_desc').value, amount: document.getElementById('amount').value, taxRate: document.getElementById('tax_rate').value, discRate: document.getElementById('discount_rate').value, currency: 'USD' };
    if (currentTab === 'request') return { ...b, cName: document.getElementById('c_name').value, cPhone: document.getElementById('c_phone').value, cEmail: document.getElementById('c_email').value, cService: document.getElementById('c_service').value, preferredDate: document.getElementById('req_preferred_date').value, budget: document.getElementById('req_budget').value, desc: document.getElementById('req_description').value, notes: document.getElementById('req_notes').value, currency: 'USD' };
    if (currentTab === 'quote') return { ...b, cName: document.getElementById('q_cust_name').value, wProf: document.getElementById('q_profession').value, currency: document.getElementById('q_currency').value, validUntil: document.getElementById('q_valid_until').value, terms: document.getElementById('q_terms').value };
    return { ...b, cName: document.getElementById('inv_cust_name').value, cPhone: document.getElementById('inv_cust_phone').value, cEmail: document.getElementById('inv_cust_email').value, dueDate: document.getElementById('inv_due_date').value, currency: document.getElementById('w_currency').value, wBizName: document.getElementById('w_biz_name').value, wProf: document.getElementById('w_profession').value, signature: document.getElementById('w_signature').value, paymentMethod: document.getElementById('payment_method').value };
}

function generateQR() {
    const c = document.getElementById('qrcode-container'); c.innerHTML = '';
    const d = getFormData(); let t;
    if (currentInvoiceId) t = window.location.origin + window.location.pathname + '?id=' + currentInvoiceId;
    else { const l = currentTab === 'request' ? 'Service Request' : currentTab === 'quote' ? 'Quote' : 'Invoice'; t = l + ' ' + d.invoiceNum + '\nCustomer: ' + (d.cName || '') + '\nAmount: ' + getCurrencySymbol(d.currency) + (d.amount || d.budget || 0) + '\nDate: ' + d.date; }
    new QRCode(c, { text: t, width: 60, height: 60, colorDark: '#075e54', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
}

async function exportImage() { const e = document.getElementById('invoice-card'), c = await html2canvas(e, { scale: 3, useCORS: true }), l = document.createElement('a'); l.download = document.getElementById('invoice_num').value + '.jpg'; l.href = c.toDataURL('image/jpeg', 0.95); l.click(); showToast('JPG downloaded!'); }
async function exportPDF() { const e = document.getElementById('invoice-card'), c = await html2canvas(e, { scale: 3, useCORS: true }), i = c.toDataURL('image/png'), { jsPDF } = window.jspdf, p = new jsPDF('p', 'mm', 'a4'), w = p.internal.pageSize.getWidth(), h = (c.height * w) / c.width; p.addImage(i, 'PNG', 0, 0, w, h); p.save(document.getElementById('invoice_num').value + '.pdf'); showToast('PDF downloaded!'); }

async function saveInvoiceToDB() {
    const d = getFormData(), sub = parseFloat(d.amount) || 0, tax = (sub * (parseFloat(d.taxRate) || 0)) / 100, disc = (sub * (parseFloat(d.discRate) || 0)) / 100, total = sub + tax - disc;
    let r = { invoice_type: currentTab, invoice_number: d.invoiceNum, invoice_date: d.date, description: d.desc, tax_rate: d.taxRate, discount_rate: d.discRate, currency: d.currency };
    if (currentTab === 'request') r = { ...r, customer_name: d.cName, customer_phone: d.cPhone, customer_email: d.cEmail, service: d.cService, preferred_date: d.preferredDate || null, budget: parseFloat(d.budget) || 0, notes: d.notes, amount: parseFloat(d.budget) || 0 };
    else if (currentTab === 'quote') r = { ...r, customer_name: d.cName, profession: d.wProf, amount: total, valid_until: d.validUntil || null, terms: d.terms };
    else r = { ...r, business_name: d.wBizName, worker_name: document.getElementById('w_name').value, profession: d.wProf, customer_name: d.cName, customer_phone: d.cPhone, customer_email: d.cEmail, due_date: d.dueDate || null, amount: total, status: paymentStatus, payment_method: d.paymentMethod, signature: d.signature };
    if (currentUser) r.user_id = currentUser.id;
    let res;
    if (currentInvoiceId && !viewingSharedInvoice) res = await supabase.from('invoices').update(r).eq('id', currentInvoiceId).select().single();
    else res = await supabase.from('invoices').insert(r).select().single();
    if (res.error) { showToast('Could not save: ' + res.error.message); return null; }
    currentInvoiceId = res.data.id; return res.data;
}

async function saveAndShare() {
    const b = event.target.closest('button'), o = b.innerHTML; b.innerHTML = 'Saving...'; b.disabled = true;
    const s = await saveInvoiceToDB(); b.innerHTML = o; b.disabled = false; lucide.createIcons();
    if (!s) return;
    const link = window.location.origin + window.location.pathname + '?id=' + s.id;
    document.getElementById('share-link-input').value = link; openModal('share-modal'); showToast('Invoice saved & link ready!');
}
function copyShareLink() { navigator.clipboard.writeText(document.getElementById('share-link-input').value).then(() => showToast('Link copied!')); }
async function shareWA() { const d = getFormData(), sym = getCurrencySymbol(d.currency), link = await ensureSavedLink(); if (!link) return; const l = currentTab === 'request' ? 'SERVICE REQUEST' : currentTab === 'quote' ? 'QUOTE' : 'SERVICE BILL'; const m = '*' + l + '*\n\n*Reference:* ' + d.invoiceNum + '\n*Amount:* ' + sym + d.amount + '\n*Details:* ' + d.desc + '\n\nView: ' + link; window.open('https://wa.me/?text=' + encodeURIComponent(m), '_blank'); }
async function shareTG() { const d = getFormData(), link = await ensureSavedLink(); if (!link) return; const m = 'Service Invoice: ' + d.invoiceNum + '\nAmount: ' + d.amount + '\nDetails: ' + d.desc; window.open('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(m), '_blank'); }
async function ensureSavedLink() { if (currentInvoiceId) return window.location.origin + window.location.pathname + '?id=' + currentInvoiceId; const s = await saveInvoiceToDB(); if (!s) return null; return window.location.origin + window.location.pathname + '?id=' + s.id; }

async function loadSharedInvoice(id) {
    viewingSharedInvoice = true; currentInvoiceId = id;
    const { data, error } = await supabase.from('invoices').select('*').eq('id', id).single();
    if (error || !data) { showToast('This invoice link is invalid or was removed.'); viewingSharedInvoice = false; generateInvoiceNumber(); updatePreview(); return; }
    const inv = data; currentTab = inv.invoice_type || 'invoice'; paymentStatus = inv.status || 'Pending';
    populateDropdowns();
    document.getElementById('invoice_num').value = inv.invoice_number || ''; document.getElementById('invoice_date').value = inv.invoice_date || ''; document.getElementById('work_desc').value = inv.description || ''; document.getElementById('tax_rate').value = inv.tax_rate || 0; document.getElementById('discount_rate').value = inv.discount_rate || 0;
    if (currentTab === 'request') { document.getElementById('c_name').value = inv.customer_name || ''; document.getElementById('c_phone').value = inv.customer_phone || ''; document.getElementById('c_email').value = inv.customer_email || ''; document.getElementById('c_service').value = inv.service || 'Other'; document.getElementById('req_preferred_date').value = inv.preferred_date || ''; document.getElementById('req_budget').value = inv.budget || inv.amount || 0; document.getElementById('req_description').value = inv.description || ''; document.getElementById('req_notes').value = inv.notes || ''; }
    else if (currentTab === 'quote') { document.getElementById('q_cust_name').value = inv.customer_name || ''; document.getElementById('q_profession').value = inv.profession || 'Other'; document.getElementById('q_currency').value = inv.currency || 'USD'; document.getElementById('q_valid_until').value = inv.valid_until || ''; document.getElementById('q_terms').value = inv.terms || ''; document.getElementById('amount').value = inv.amount || 0; }
    else { document.getElementById('inv_cust_name').value = inv.customer_name || ''; document.getElementById('inv_cust_phone').value = inv.customer_phone || ''; document.getElementById('inv_cust_email').value = inv.customer_email || ''; document.getElementById('inv_due_date').value = inv.due_date || ''; document.getElementById('w_biz_name').value = inv.business_name || ''; document.getElementById('w_name').value = inv.worker_name || ''; document.getElementById('w_profession').value = inv.profession || 'Other'; document.getElementById('w_currency').value = inv.currency || 'USD'; document.getElementById('w_signature').value = inv.signature || ''; document.getElementById('payment_method').value = inv.payment_method || 'Cash'; document.getElementById('amount').value = inv.amount || 0; }
    document.getElementById('request-fields').classList.toggle('hidden', currentTab !== 'request');
    document.getElementById('quote-fields').classList.toggle('hidden', currentTab !== 'quote');
    document.getElementById('worker-fields').classList.toggle('hidden', currentTab !== 'invoice');
    document.getElementById('amount-section').classList.toggle('hidden', currentTab === 'request');
    document.getElementById('payment-status-section').classList.toggle('hidden', currentTab !== 'invoice');
    ['invoice','quote','request'].forEach(t => { const b = document.getElementById('tab-' + t); if (t === currentTab) { b.classList.add('tab-active'); b.classList.remove('text-slate-400'); } else { b.classList.remove('tab-active'); b.classList.add('text-slate-400'); } });
    document.querySelectorAll('#form-content input, #form-content select, #form-content textarea').forEach(el => el.setAttribute('disabled', 'true'));
    const a = document.querySelector('.flex.gap-4.pt-6'); if (a) a.classList.add('hidden');
    const bn = document.querySelector('#form-content > .bg-emerald-50'); if (!bn) { const banner = document.createElement('div'); banner.className = 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-xs text-emerald-700 dark:text-emerald-400 font-bold mb-4'; banner.innerText = "You're viewing a shared invoice."; document.getElementById('form-content').prepend(banner); }
    setStatus(paymentStatus); updatePreview(); showToast('Shared invoice loaded');
}

let authMode = 'signin';
function handleAccountClick() { if (currentUser) { openModal('invoices-modal'); loadMyInvoices(); } else openModal('auth-modal'); }
function toggleAuthMode() { authMode = authMode === 'signin' ? 'signup' : 'signin'; document.getElementById('auth-title').textContent = authMode === 'signin' ? 'Sign In' : 'Sign Up'; document.getElementById('auth-subtitle').textContent = authMode === 'signin' ? 'Access your invoice history from any device.' : 'Create an account to save your invoices.'; document.getElementById('auth-submit-btn').textContent = authMode === 'signin' ? 'Sign In' : 'Sign Up'; document.getElementById('auth-toggle-text').textContent = authMode === 'signin' ? "Don't have an account?" : 'Already have an account?'; document.getElementById('auth-toggle-btn').
