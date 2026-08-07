
        // --- Supabase Setup ---
        const SUPABASE_URL = 'https://iudufhafmhwuqwheloix.supabase.co';
        const SUPABASE_KEY = 'sb_publishable_Kxmbzt_uAvB2qISOodYSRg_DSatvfMK';
        let sb = null;
        let supabaseReady = false;
        try {
            if (window.supabase && window.supabase.createClient) {
                sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                supabaseReady = true;
            } else {
                console.error('Supabase library failed to load from CDN. Cloud save/login disabled, but the invoice tool will still work.');
            }
        } catch (e) {
            console.error('Supabase init failed:', e);
        }

        // --- Shared Data Lists ---
        const PROFESSIONS = [
            'Plumber','Electrician','House Cleaner','Office Cleaner','Deep Cleaner','Cleaner',
            'Taxi Driver','Truck Driver','Bus Driver','Delivery Driver','Delivery Rider','Courier','Driver',
            'Car Mechanic','Bike Mechanic','Diesel Mechanic','Mechanic','Welder','Painter','Carpenter','Mason','Construction Worker','Handyman',
            'AC Technician','HVAC Technician','Refrigerator Technician','CCTV Installer','Solar Technician',
            'Computer Technician','Laptop Repair','Mobile Repair Technician','Printer Technician','Network Technician','IT Support',
            'Gardener','Pest Control','Locksmith','Roofer','Tile Flooring','Glass Installer','Pool Cleaner','Appliance Repair',
            'Security Guard','Tailor','Laundry Service','Cook','Chef','Caterer','Babysitter','Caregiver','Tutor',
            'Photographer','Videographer','DJ Musician','Event Planner','Graphic Designer','Web Designer','Web Developer',
            'Digital Marketer','Consultant','Architect','Interior Designer','Civil Engineer','Real Estate Agent',
            'Moving Service','House Shifting','Cleaning Company','Barber','Beautician','Massage Therapist','Fitness Trainer',
            'Farmer','Accountant','Freelancer','Business Owner','Business Services','Other'
        ];

        const CURRENCIES = [
            ['USD','US Dollar'], ['EUR','Euro'], ['GBP','British Pound'], ['CAD','Canadian Dollar'], ['AUD','Australian Dollar'],
            ['NZD','New Zealand Dollar'], ['CHF','Swiss Franc'], ['JPY','Japanese Yen'], ['CNY','Chinese Yuan'], ['HKD','Hong Kong Dollar'], ['SGD','Singapore Dollar'],
            ['INR','Indian Rupee'], ['PKR','Pakistani Rupee'], ['BDT','Bangladeshi Taka'], ['NPR','Nepali Rupee'], ['LKR','Sri Lankan Rupee'],
            ['AED','UAE Dirham'], ['SAR','Saudi Riyal'], ['QAR','Qatari Riyal'], ['KWD','Kuwaiti Dinar'], ['OMR','Omani Rial'], ['BHD','Bahraini Dinar'], ['JOD','Jordanian Dinar'],
            ['EGP','Egyptian Pound'], ['MAD','Moroccan Dirham'], ['ZAR','South African Rand'], ['NGN','Nigerian Naira'], ['KES','Kenyan Shilling'],
            ['TZS','Tanzanian Shilling'], ['UGX','Ugandan Shilling'], ['GHS','Ghanaian Cedi'],
            ['TRY','Turkish Lira'], ['RUB','Russian Ruble'], ['BRL','Brazilian Real'], ['MXN','Mexican Peso'], ['PHP','Philippine Peso'], ['THB','Thai Baht'], ['IDR','Indonesian Rupiah'], ['MYR','Malaysian Ringgit']
        ];

        const CURRENCY_SYMBOLS = {
            USD:'$', EUR:'€', GBP:'£', CAD:'$', AUD:'$', NZD:'$', CHF:'Fr', JPY:'¥', CNY:'¥', HKD:'HK$', SGD:'S$',
            INR:'₹', PKR:'Rs', BDT:'৳', NPR:'Rs', LKR:'Rs',
            AED:'dh', SAR:'SR', QAR:'QR', KWD:'KD', OMR:'OR', BHD:'BD', JOD:'JD',
            EGP:'E£', MAD:'DH', ZAR:'R', NGN:'₦', KES:'KSh', TZS:'TSh', UGX:'USh', GHS:'GH₵',
            TRY:'₺', RUB:'₽', BRL:'R$', MXN:'Mex$', PHP:'₱', THB:'฿', IDR:'Rp', MYR:'RM'
        };

        function populateDropdowns() {
            const professionSelects = ['w_profession', 'q_profession', 'c_service'];
            professionSelects.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                el.innerHTML = PROFESSIONS.map(p => `<option value="${p}">${p}</option>`).join('');
            });

            const currencySelects = ['w_currency', 'q_currency'];
            currencySelects.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                el.innerHTML = CURRENCIES.map(([code, name]) => `<option value="${code}">${code} - ${name}</option>`).join('');
            });
        }

        // --- State Management ---
        let currentTab = (typeof PAGE_TYPE !== 'undefined') ? PAGE_TYPE : 'invoice';
        let paymentStatus = 'Pending';
        let currentTemplate = 'modern';
        let logoBase64 = null;
        let currentUser = null;
        let currentInvoiceId = null;
        let isAuthSignup = false;
        let viewingSharedInvoice = false;
        let showQR = true;
        let lineItems = [{ id: 'item_1', desc: '', qty: 1, price: 0 }];

        function escapeHtml(str) {
            if (str === null || str === undefined) return '';
            return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }

        function uid() { return 'item_' + Math.random().toString(36).slice(2, 9); }

        function addItemRow() {
            lineItems.push({ id: uid(), desc: '', qty: 1, price: 0 });
            renderItemsForm();
            recalcItemsTotal();
            updatePreview();
        }

        function removeItemRow(id) {
            if (lineItems.length <= 1) return;
            lineItems = lineItems.filter((i) => i.id !== id);
            renderItemsForm();
            recalcItemsTotal();
            updatePreview();
        }

        function duplicateItemRow(id) {
            const item = lineItems.find((i) => i.id === id);
            if (!item) return;
            const idx = lineItems.findIndex((i) => i.id === id);
            lineItems.splice(idx + 1, 0, { id: uid(), desc: item.desc, qty: item.qty, price: item.price });
            renderItemsForm();
            recalcItemsTotal();
            updatePreview();
        }

        function updateItemField(id, field, value) {
            const item = lineItems.find((i) => i.id === id);
            if (!item) return;
            item[field] = (field === 'qty' || field === 'price') ? (parseFloat(value) || 0) : value;
            recalcItemsTotal();
            const rowAmt = document.getElementById('row-amt-' + id);
            if (rowAmt) rowAmt.innerText = (item.qty * item.price).toFixed(2);
            updatePreview();
        }

        function recalcItemsTotal() {
            const subtotal = lineItems.reduce((s, i) => s + (i.qty * i.price), 0);
            const amtEl = document.getElementById('amount');
            if (amtEl) amtEl.value = subtotal.toFixed(2);
        }

        function itemRowHTML(item) {
            return `<div class="grid grid-cols-12 gap-2 items-center" data-item-row="${item.id}">
                <input type="text" value="${escapeHtml(item.desc)}" placeholder="Item description" oninput="updateItemField('${item.id}','desc',this.value)" class="col-span-4 px-2 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none">
                <input type="number" value="${item.qty}" min="0" oninput="updateItemField('${item.id}','qty',this.value)" class="col-span-2 px-2 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-center">
                <input type="number" value="${item.price}" min="0" step="0.01" oninput="updateItemField('${item.id}','price',this.value)" class="col-span-2 px-2 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-right">
                <span id="row-amt-${item.id}" class="col-span-2 text-sm font-bold text-right pr-1">${(item.qty * item.price).toFixed(2)}</span>
                <button type="button" onclick="duplicateItemRow('${item.id}')" title="Duplicate" class="col-span-1 text-slate-400 hover:text-emerald-600 flex justify-center"><i data-lucide="copy" class="w-4 h-4"></i></button>
                <button type="button" onclick="removeItemRow('${item.id}')" title="Delete" class="col-span-1 text-red-400 hover:text-red-600 flex justify-center"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>`;
        }

        function renderItemsForm() {
            const container = document.getElementById('items-form-container');
            if (!container) return;
            container.innerHTML = lineItems.map(itemRowHTML).join('');
            if (window.lucide) lucide.createIcons();
        }

        function toggleQR() {
            showQR = document.getElementById('show_qr_toggle').checked;
            updatePreview();
        }

        // --- Scroll-reveal animations (fade/slide in as sections enter viewport) ---
        function initScrollReveal() {
            const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const targets = document.querySelectorAll('.reveal-up, .reveal-left, .reveal-right, .reveal-scale, .reveal-stagger');
            if (prefersReduced || !('IntersectionObserver' in window)) {
                targets.forEach((el) => el.classList.add('in-view'));
                return;
            }
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('in-view');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
            targets.forEach((el) => observer.observe(el));
        }

        let accentColor = '#059669';
        const ACCENT_PRESETS = { green: '#059669', blue: '#2563eb', orange: '#ea580c', black: '#1e293b', red: '#dc2626' };

        function setAccentColor(name) {
            accentColor = ACCENT_PRESETS[name] || name;
            const card = document.getElementById('invoice-card');
            if (card) card.style.setProperty('--doc-accent', accentColor);
            document.querySelectorAll('.accent-swatch').forEach((el) => {
                el.classList.toggle('ring-2', el.dataset.accent === name);
                el.classList.toggle('ring-offset-2', el.dataset.accent === name);
                el.classList.toggle('ring-slate-400', el.dataset.accent === name);
            });
        }

        // --- Initialization ---
        window.onload = async () => {
            initScrollReveal();
            lucide.createIcons();
            populateDropdowns();
            renderItemsForm();
            recalcItemsTotal();
            setAccentColor('green');
            const dateEl = document.getElementById('invoice_date');
            if (dateEl && dateEl.type === 'date') dateEl.valueAsDate = new Date();
            setupEventListeners();

            // Check Dark Mode
            if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
            }

            // Check auth session
            if (supabaseReady) {
                try {
                    const { data: { session } } = await sb.auth.getSession();
                    currentUser = session ? session.user : null;
                    updateAccountUI();
                    sb.auth.onAuthStateChange((event, session) => {
                        currentUser = session ? session.user : null;
                        updateAccountUI();
                    });
                } catch (e) {
                    console.error('Auth session check failed:', e);
                }
            }

            // Check if opening a shared invoice link
            const params = new URLSearchParams(window.location.search);
            const sharedId = params.get('id');
            if (sharedId && supabaseReady) {
                await loadSharedInvoice(sharedId);
            } else {
                generateInvoiceNumber();
                updatePreview();
                applyConvertedDraftIfAny();
            }
        };

        // --- Auth Functions ---
        function openLoginModal() {
            isAuthSignup = false;
            document.getElementById('auth-title').innerText = 'Sign In';
            document.getElementById('auth-submit-btn').innerText = 'Sign In';
            document.getElementById('auth-toggle-text').innerText = "Don't have an account?";
            document.getElementById('auth-toggle-btn').innerText = 'Sign Up';
            openModal('auth-modal');
        }

        function openSignupModal() {
            isAuthSignup = true;
            document.getElementById('auth-title').innerText = 'Sign Up';
            document.getElementById('auth-submit-btn').innerText = 'Create Account';
            document.getElementById('auth-toggle-text').innerText = 'Already have an account?';
            document.getElementById('auth-toggle-btn').innerText = 'Sign In';
            openModal('auth-modal');
        }

        function navGoTo(tab) {
            switchTab(tab);
            document.getElementById('app-interface').scrollIntoView({ behavior: 'smooth' });
        }

        function updateAccountUI() {
            const guestButtons = document.getElementById('auth-buttons-guest');
            const loggedInBtn = document.getElementById('account-btn-loggedin');
            if (currentUser) {
                guestButtons.classList.add('hidden');
                loggedInBtn.classList.remove('hidden');
                loggedInBtn.classList.add('flex');
                document.getElementById('accountBtnText').innerText = currentUser.email.split('@')[0];
            } else {
                guestButtons.classList.remove('hidden');
                loggedInBtn.classList.add('hidden');
                loggedInBtn.classList.remove('flex');
            }
        }

        function toggleAuthMode() {
            isAuthSignup = !isAuthSignup;
            document.getElementById('auth-title').innerText = isAuthSignup ? 'Sign Up' : 'Sign In';
            document.getElementById('auth-submit-btn').innerText = isAuthSignup ? 'Create Account' : 'Sign In';
            document.getElementById('auth-toggle-text').innerText = isAuthSignup ? 'Already have an account?' : "Don't have an account?";
            document.getElementById('auth-toggle-btn').innerText = isAuthSignup ? 'Sign In' : 'Sign Up';
        }

        async function submitAuth() {
            const errorEl = document.getElementById('auth-error');
            errorEl.classList.add('hidden');

            if (!supabaseReady) {
                errorEl.innerText = 'Login is temporarily unavailable. You can still create and download invoices without an account.';
                errorEl.classList.remove('hidden');
                return;
            }

            const email = document.getElementById('auth-email').value.trim();
            const password = document.getElementById('auth-password').value;

            if (!email || !password) {
                errorEl.innerText = 'Please enter email and password.';
                errorEl.classList.remove('hidden');
                return;
            }

            const { data, error } = isAuthSignup
                ? await sb.auth.signUp({ email, password })
                : await sb.auth.signInWithPassword({ email, password });

            if (error) {
                errorEl.innerText = error.message;
                errorEl.classList.remove('hidden');
                return;
            }

            if (isAuthSignup && data.user && !data.session) {
                errorEl.classList.remove('hidden');
                errorEl.classList.remove('text-red-500');
                errorEl.classList.add('text-emerald-600');
                errorEl.innerText = 'Account created! Check your email to confirm, then sign in.';
                return;
            }

            currentUser = data.user;
            updateAccountUI();
            closeModal('auth-modal');
        }

        async function logout() {
            if (supabaseReady) await sb.auth.signOut();
            currentUser = null;
            updateAccountUI();
            closeModal('invoices-modal');
        }

        function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
        function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

        // --- My Invoices Dashboard ---
        async function openMyInvoices() {
            if (!supabaseReady) {
                alert('Cloud features are temporarily unavailable, but you can still create and download invoices.');
                return;
            }
            openModal('invoices-modal');
            const listEl = document.getElementById('invoices-list');
            listEl.innerHTML = '<p class="text-sm text-slate-400">Loading...</p>';

            const { data, error } = await sb
                .from('invoices')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                listEl.innerHTML = `<p class="text-sm text-red-500">${error.message}</p>`;
                return;
            }

            if (!data || data.length === 0) {
                listEl.innerHTML = '<p class="text-sm text-slate-400">No saved invoices yet. Create one and hit "Save & Share".</p>';
                return;
            }

            listEl.innerHTML = data.map(inv => {
                const typeLabel = inv.invoice_type === 'quote' ? 'Quote' : inv.invoice_type === 'request' ? 'Request' : 'Invoice';
                const amt = inv.invoice_type === 'request' ? (inv.budget || 0) : (inv.amount || 0);
                const subtitle = inv.invoice_type === 'request' ? (inv.customer_name || 'No name') : `${inv.customer_name || 'No name'}${inv.status ? ' • ' + inv.status : ''}`;
                return `
                <button onclick="window.location.href = window.location.pathname + '?id=${inv.id}'" class="w-full text-left p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 flex justify-between items-center">
                    <div>
                        <p class="font-bold text-sm dark:text-white">${inv.invoice_number || typeLabel} <span class="text-[10px] font-normal text-slate-400 uppercase">${typeLabel}</span></p>
                        <p class="text-xs text-slate-500">${subtitle}</p>
                    </div>
                    <span class="text-xs font-bold text-emerald-600">${getCurrencySymbol(inv.currency)}${parseFloat(amt).toFixed(2)}</span>
                </button>
            `;
            }).join('');
        }

        function setupEventListeners() {
            const inputs = [
                'c_name', 'c_phone', 'c_email', 'c_service', 'req_preferred_date', 'req_budget', 'req_description', 'req_notes', 'req_priority',
                'q_cust_name', 'q_profession', 'q_currency', 'q_valid_until', 'q_terms', 'notes',
                'inv_cust_name', 'inv_cust_phone', 'inv_cust_email', 'inv_cust_address', 'inv_due_date', 'inv_terms',
                'w_biz_name', 'w_name', 'w_biz_address', 'w_biz_phone', 'w_biz_email', 'w_biz_website', 'w_tax_number',
                'w_profession', 'w_currency', 'w_signature', 'cust_signature', 'payment_method',
                'bank_account_holder', 'bank_name', 'bank_iban', 'bank_account_number', 'bank_swift',
                'work_desc', 'amount', 'tax_rate', 'discount_rate', 'shipping', 'invoice_date'
            ];
            inputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', updatePreview);
            });

            const logoInput = document.getElementById('w_logo');
            if (logoInput) {
                logoInput.addEventListener('change', function(e) {
                    const file = e.target.files[0];
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        logoBase64 = reader.result;
                        updatePreview();
                    };
                    if (file) reader.readAsDataURL(file);
                });
            }
        }

        // --- Logic Functions ---
        function toggleDarkMode() {
            document.documentElement.classList.toggle('dark');
            localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        }

        function generateInvoiceNumber(forceNew) {
            const config = {
                invoice: { prefix: 'INV', storageKey: 'qq_seq_invoice', start: 500 },
                quote: { prefix: 'QT', storageKey: 'qq_seq_quote', start: 1000 },
                request: { prefix: 'REQ', storageKey: 'qq_seq_request', start: 200 }
            };
            const cfg = config[currentTab] || config.invoice;
            const sessionKey = 'qq_current_num_' + currentTab;

            if (!forceNew) {
                try {
                    const existing = sessionStorage.getItem(sessionKey);
                    if (existing) {
                        document.getElementById('invoice_num').value = existing;
                        return;
                    }
                } catch (e) { /* fall through to generate a new one */ }
            }

            let next;
            try {
                const stored = localStorage.getItem(cfg.storageKey);
                next = stored ? parseInt(stored, 10) + 1 : cfg.start;
                localStorage.setItem(cfg.storageKey, String(next));
            } catch (e) {
                next = cfg.start;
            }
            const num = `${cfg.prefix}-${next}`;
            document.getElementById('invoice_num').value = num;
            try { sessionStorage.setItem(sessionKey, num); } catch (e) { /* ignore */ }
        }

        function switchTemplate(tpl) {
            currentTemplate = tpl;
            document.querySelectorAll('[onclick^="switchTemplate"]').forEach(btn => {
                const isActive = btn.getAttribute('onclick').includes(`'${tpl}'`);
                btn.classList.toggle('bg-emerald-600', isActive);
                btn.classList.toggle('text-white', isActive);
                btn.classList.toggle('bg-slate-200', !isActive);
                btn.classList.toggle('dark:bg-slate-800', !isActive);
                btn.classList.toggle('text-slate-600', !isActive);
                btn.classList.toggle('dark:text-slate-400', !isActive);
            });
            document.getElementById('invoice-card').classList.toggle('minimal-template', tpl === 'minimal');
        }

        function switchTab(tab) {
            currentTab = tab;
            if (!viewingSharedInvoice) currentInvoiceId = null;
            ['invoice', 'quote', 'request'].forEach(t => {
                const btn = document.getElementById('tab-' + t);
                btn.classList.toggle('tab-active', tab === t);
                btn.classList.toggle('text-slate-400', tab !== t);
            });

            document.getElementById('request-fields').classList.toggle('hidden', tab !== 'request');
            document.getElementById('quote-fields').classList.toggle('hidden', tab !== 'quote');
            document.getElementById('worker-fields').classList.toggle('hidden', tab !== 'invoice');

            // Amount/description section: shown for invoice + quote, hidden for request (request has its own budget/description)
            document.getElementById('amount-section').classList.toggle('hidden', tab === 'request');
            // Payment status: only for invoice
            document.getElementById('payment-status-section').classList.toggle('hidden', tab !== 'invoice');
            document.getElementById('convert-quote-section').classList.toggle('hidden', tab !== 'quote');

            document.getElementById('doc-num-label').innerText = tab === 'quote' ? 'Quote Number' : tab === 'request' ? 'Request Number' : 'Invoice Number';
            document.getElementById('desc-label').innerText = tab === 'quote' ? 'Description' : 'Work Details / Description';
            document.getElementById('amount-label').innerText = tab === 'quote' ? 'Estimated Amount' : 'Amount';
            document.getElementById('main-generate-btn').innerText = tab === 'request' ? 'Send Request' : 'Download & Share';

            document.getElementById('prev-invoice-type').innerText = tab === 'quote' ? 'QUOTE' : tab === 'request' ? 'SERVICE REQUEST' : 'INVOICE';

            generateInvoiceNumber();
            updatePreview();
        }

        function handleStatusClick(status) {
            if (viewingSharedInvoice && currentInvoiceId) {
                updateSharedStatus(status);
            } else {
                setStatus(status);
            }
        }

        function setStatus(status) {
            paymentStatus = status;
            document.querySelectorAll('.status-btn').forEach(btn => {
                btn.classList.remove('bg-emerald-600', 'text-white', 'border-emerald-600');
                if (btn.innerText === status) {
                    btn.classList.add('bg-emerald-600', 'text-white', 'border-emerald-600');
                }
            });
            updatePreview();
        }

        function updatePreview() {
            const data = getFormData();
            const el = (id) => document.getElementById(id);
            const setText = (id, val) => { const e = el(id); if (e) e.innerText = val; };
            const showIf = (blockId, cond) => {
                const e = el(blockId);
                if (!e) return;
                e.classList.remove('hidden');
                e.style.display = cond ? '' : 'none';
            };

            // Update Preview Text
            setText('prev-invoice-num', data.invoiceNum);
            setText('prev-to-date', data.date ? new Date(data.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '');
            if (currentTab === 'invoice') {
                showIf('prev-due-date-row', !!data.dueDate);
                setText('prev-due-date', data.dueDate ? new Date(data.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '');
            }

            if (currentTab === 'request') {
                setText('prev-from-name', 'QuickQuote User');
                setText('prev-from-prof', 'Service Request');
                setText('prev-to-name', data.cService || 'Any Professional');
                setText('prev-invoice-type', 'SERVICE REQUEST');
                setText('prev-desc', data.desc || 'No description provided...');
            } else if (currentTab === 'quote') {
                setText('prev-from-name', data.wProf || 'Professional Service');
                setText('prev-from-prof', 'Quote');
                setText('prev-to-name', data.cName || 'Valued Customer');
                setText('prev-invoice-type', 'QUOTE');
            } else {
                setText('prev-from-name', data.wBizName || 'Your Business Name');
                setText('prev-from-prof', data.wProf || 'Professional Service');
                setText('prev-to-name', data.cName || 'Valued Customer');
                setText('prev-invoice-type', 'INVOICE');
            }

            // Smart-hide business contact block (invoice only)
            if (currentTab === 'invoice') {
                showIf('prev-biz-address-row', !!data.bizAddress);
                setText('prev-biz-address', data.bizAddress || '');
                const contactParts = [data.bizPhone, data.bizEmail, data.bizWebsite].filter(Boolean);
                showIf('prev-biz-contact-row', contactParts.length > 0);
                setText('prev-biz-contact', contactParts.join(' · '));
                showIf('prev-tax-number-row', !!data.taxNumber);
                setText('prev-tax-number', data.taxNumber ? 'Tax No: ' + data.taxNumber : '');

                showIf('prev-cust-address-row', !!data.custAddress);
                setText('prev-cust-address', data.custAddress || '');
                const custContactParts = [data.cPhone, data.cEmail].filter(Boolean);
                showIf('prev-cust-contact-row', custContactParts.length > 0);
                setText('prev-cust-contact', custContactParts.join(' · '));
            }

            // Notes & Terms (smart-hide when empty)
            showIf('prev-notes-block', !!data.notes);
            setText('prev-notes', data.notes || '');
            showIf('prev-terms-block', !!data.terms);
            setText('prev-terms', data.terms || '');

            // Logo (auto-hide the box entirely when no logo, per smart-field rules)
            const logoBox = el('biz-logo-preview');
            if (logoBox) {
                if (logoBase64) {
                    logoBox.classList.remove('hidden');
                    logoBox.innerHTML = `<img src="${logoBase64}" class="w-full h-full object-cover">`;
                } else {
                    logoBox.classList.add('hidden');
                }
            }

            const symbol = getCurrencySymbol(data.currency);

            if (currentTab === 'request') {
                showIf('prev-pricing-block', false);
                showIf('prev-budget-block', true);
                setText('prev-budget', `${symbol}${(parseFloat(data.budget) || 0).toFixed(2)}`);
                showIf('prev-status', false);
                setText('prev-pay-method', '');
                showIf('prev-payment-section', false);
            } else {
                showIf('prev-pricing-block', true);
                showIf('prev-budget-block', false);

                // Render itemized table
                const itemsEl = el('prev-items-container');
                if (itemsEl) {
                    const rows = lineItems.map((i) => `
                        <tr>
                            <td>${escapeHtml(i.desc) || '—'}</td>
                            <td style="text-align:center">${i.qty}</td>
                            <td style="text-align:right">${symbol}${i.price.toFixed(2)}</td>
                            <td style="text-align:right; font-weight:700">${symbol}${(i.qty * i.price).toFixed(2)}</td>
                        </tr>`).join('');
                    itemsEl.innerHTML = `<table class="items-table"><thead><tr><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Amount</th></tr></thead><tbody>${rows}</tbody></table>`;
                }

                const subtotal = parseFloat(data.amount) || 0;
                const tax = (subtotal * (parseFloat(data.taxRate) || 0)) / 100;
                const discount = (subtotal * (parseFloat(data.discRate) || 0)) / 100;
                const shipping = parseFloat(data.shipping) || 0;
                const total = subtotal + tax - discount + shipping;

                setText('prev-subtotal', `${symbol}${subtotal.toFixed(2)}`);
                setText('prev-tax-rate', data.taxRate);
                setText('prev-tax-val', `${symbol}${tax.toFixed(2)}`);
                setText('prev-disc-rate', data.discRate);
                setText('prev-disc-val', `-${symbol}${discount.toFixed(2)}`);
                showIf('prev-shipping-row', shipping > 0);
                setText('prev-shipping-val', `${symbol}${shipping.toFixed(2)}`);
                setText('prev-total-label', currentTab === 'quote' ? 'Estimated Total' : 'Grand Total');
                setText('prev-total', `${symbol}${total.toFixed(2)}`);

                if (currentTab === 'invoice') {
                    const amountPaid = parseFloat(data.amountPaid) || 0;
                    const balanceDue = Math.max(total - amountPaid, 0);
                    showIf('prev-paid-row', amountPaid > 0);
                    setText('prev-amount-paid', `${symbol}${amountPaid.toFixed(2)}`);
                    showIf('prev-balance-row', amountPaid > 0);
                    setText('prev-balance-due', `${symbol}${balanceDue.toFixed(2)}`);
                }

                if (currentTab === 'invoice') {
                    const hasPaymentMethod = !!data.paymentMethod;
                    showIf('prev-payment-section', hasPaymentMethod);
                    showIf('prev-status', true);
                    const isBankMethod = data.paymentMethod === 'Bank Transfer' || data.paymentMethod === 'IBAN';
                    showIf('bank-details-form', isBankMethod);
                    const statusEl = el('prev-status');
                    if (statusEl) {
                        statusEl.innerText = paymentStatus === 'Partial' ? 'Partially Paid' : paymentStatus;
                        statusEl.className = 'doc-status-badge';
                        if (paymentStatus === 'Paid') statusEl.classList.add('doc-status-paid');
                        else if (paymentStatus === 'Pending') statusEl.classList.add('doc-status-pending');
                        else if (paymentStatus === 'Overdue') statusEl.classList.add('doc-status-overdue');
                        else statusEl.classList.add('doc-status-partial');
                    }
                    setText('prev-pay-method', data.paymentMethod ? 'via ' + data.paymentMethod : '');

                    // Bank details sub-block: only for Bank Transfer / IBAN
                    const isBank = data.paymentMethod === 'Bank Transfer' || data.paymentMethod === 'IBAN';
                    showIf('prev-bank-block', isBank && hasPaymentMethod);
                    if (isBank) {
                        setText('prev-bank-holder', data.accountHolder || '');
                        setText('prev-bank-name', data.bankName || '');
                        setText('prev-bank-iban', data.iban || '');
                        setText('prev-bank-account', data.accountNumber || '');
                        setText('prev-bank-swift', data.swiftCode || '');
                        showIf('prev-bank-holder-row', !!data.accountHolder);
                        showIf('prev-bank-name-row', !!data.bankName);
                        showIf('prev-bank-iban-row', !!data.iban);
                        showIf('prev-bank-account-row', !!data.accountNumber);
                        showIf('prev-bank-swift-row', !!data.swiftCode);
                    }
                } else {
                    showIf('prev-payment-section', false);
                    showIf('prev-status', false);
                    setText('prev-pay-method', data.validUntil ? 'Valid until ' + new Date(data.validUntil).toLocaleDateString() : '');
                }
            }

            // Signature (invoice + quote, smart-hide when empty)
            showIf('signature-block', (currentTab === 'invoice' || currentTab === 'quote') && !!data.signature);
            setText('prev-signature', data.signature || '');
            showIf('cust-signature-block', currentTab === 'invoice' && !!data.customerSignature);
            setText('prev-cust-signature', data.customerSignature || '');

            // Priority badge (request only)
            if (currentTab === 'request') {
                const prio = data.priority || 'Medium';
                showIf('prev-priority-badge', true);
                setText('prev-priority-badge', prio.toUpperCase() + ' PRIORITY');
                const prioEl = el('prev-priority-badge');
                if (prioEl) {
                    prioEl.className = 'inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase mb-2';
                    const prioColors = { Low: ['bg-slate-100', 'text-slate-600'], Medium: ['bg-amber-100', 'text-amber-700'], High: ['bg-orange-100', 'text-orange-700'], Urgent: ['bg-red-100', 'text-red-700'] };
                    (prioColors[prio] || prioColors.Medium).forEach((c) => prioEl.classList.add(c));
                }
            }

            // QR Code — encode the actual document link/data, respect on/off toggle
            const qrContainer = el('qrcode-container');
            if (qrContainer) qrContainer.classList.toggle('hidden', !showQR);
            showIf('qr-box', showQR);
            if (showQR) generateQR();
        }

        function val(id) {
            const e = document.getElementById(id);
            return e ? e.value : '';
        }

        function getFormData() {
            const base = {
                invoiceNum: document.getElementById('invoice_num').value,
                date: document.getElementById('invoice_date').value,
                desc: document.getElementById('work_desc').value,
                amount: document.getElementById('amount').value,
                taxRate: document.getElementById('tax_rate').value,
                discRate: document.getElementById('discount_rate').value,
                notes: val('notes'),
                shipping: val('shipping')
            };

            if (currentTab === 'request') {
                return {
                    ...base,
                    cName: document.getElementById('c_name').value,
                    cPhone: document.getElementById('c_phone').value,
                    cEmail: document.getElementById('c_email').value,
                    cService: document.getElementById('c_service').value,
                    preferredDate: document.getElementById('req_preferred_date').value,
                    budget: document.getElementById('req_budget').value,
                    desc: document.getElementById('req_description').value,
                    notes: document.getElementById('req_notes').value,
                    priority: val('req_priority') || 'Medium',
                    currency: 'USD'
                };
            }

            if (currentTab === 'quote') {
                return {
                    ...base,
                    cName: document.getElementById('q_cust_name').value,
                    wProf: document.getElementById('q_profession').value,
                    currency: document.getElementById('q_currency').value,
                    validUntil: document.getElementById('q_valid_until').value,
                    terms: document.getElementById('q_terms').value,
                    signature: val('q_signature')
                };
            }

            // invoice
            return {
                ...base,
                cName: document.getElementById('inv_cust_name').value,
                cPhone: document.getElementById('inv_cust_phone').value,
                cEmail: document.getElementById('inv_cust_email').value,
                custAddress: val('inv_cust_address'),
                dueDate: document.getElementById('inv_due_date').value,
                currency: document.getElementById('w_currency').value,
                wBizName: document.getElementById('w_biz_name').value,
                wProf: document.getElementById('w_profession').value,
                bizAddress: val('w_biz_address'),
                bizPhone: val('w_biz_phone'),
                bizEmail: val('w_biz_email'),
                bizWebsite: val('w_biz_website'),
                taxNumber: val('w_tax_number'),
                signature: document.getElementById('w_signature').value,
                customerSignature: val('cust_signature'),
                terms: val('inv_terms'),
                paymentMethod: document.getElementById('payment_method').value,
                accountHolder: val('bank_account_holder'),
                bankName: val('bank_name'),
                iban: val('bank_iban'),
                accountNumber: val('bank_account_number'),
                swiftCode: val('bank_swift'),
                amountPaid: val('amount_paid')
            };
        }

        function getCurrencySymbol(curr) {
            return CURRENCY_SYMBOLS[curr] || '$';
        }

        function convertQuoteToInvoice() {
            const data = getFormData();
            const draft = {
                custName: data.cName,
                prof: data.wProf,
                currency: data.currency,
                desc: data.desc,
                amount: data.amount,
                taxRate: data.taxRate,
                discRate: data.discRate
            };
            try {
                localStorage.setItem('qq_convert_draft', JSON.stringify(draft));
            } catch (e) { console.error('Could not store draft:', e); }
            window.location.href = 'invoice.html?fromQuote=1';
        }

        function applyConvertedDraftIfAny() {
            const params = new URLSearchParams(window.location.search);
            if (params.get('fromQuote') !== '1') return;
            let draft = null;
            try { draft = JSON.parse(localStorage.getItem('qq_convert_draft') || 'null'); } catch (e) {}
            if (!draft) return;
            const setIf = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
            setIf('inv_cust_name', draft.custName);
            setIf('w_profession', draft.prof);
            setIf('w_currency', draft.currency);
            setIf('work_desc', draft.desc);
            setIf('amount', draft.amount);
            setIf('tax_rate', draft.taxRate);
            setIf('discount_rate', draft.discRate);
            localStorage.removeItem('qq_convert_draft');
            updatePreview();
        }

        function generateQR() {
            const container = document.getElementById('qrcode-container');
            if (!container) return;
            container.innerHTML = '';
            const data = getFormData();
            let qrText;
            if (currentInvoiceId) {
                qrText = `${window.location.origin}${window.location.pathname}?id=${currentInvoiceId}`;
            } else {
                const label = currentTab === 'request' ? 'Service Request' : currentTab === 'quote' ? 'Quote' : 'Invoice';
                qrText = `${label} ${data.invoiceNum}\nCustomer: ${data.cName || ''}\nAmount: ${getCurrencySymbol(data.currency)}${data.amount || data.budget || 0}\nDate: ${data.date}`;
            }
            new QRCode(container, {
                text: qrText,
                width: 60,
                height: 60,
                colorDark : "#075e54",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        }

        // --- Export Functions ---
        async function exportImage() {
            const element = document.getElementById('invoice-card');
            const canvas = await html2canvas(element, { scale: 3, useCORS: true });
            const link = document.createElement('a');
            link.download = `${document.getElementById('invoice_num').value}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.95);
            link.click();
            resetAfterExport();
        }

        async function exportPNG() {
            const element = document.getElementById('invoice-card');
            const canvas = await html2canvas(element, { scale: 3, useCORS: true });
            const link = document.createElement('a');
            link.download = `${document.getElementById('invoice_num').value}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            resetAfterExport();
        }

        async function exportPDF() {
            const element = document.getElementById('invoice-card');
            const canvas = await html2canvas(element, { scale: 3, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfPageHeight = pdf.internal.pageSize.getHeight();
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;

            if (imgHeight <= pdfPageHeight) {
                // Fits on a single page
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
            } else {
                // Content is taller than one A4 page: slice across multiple pages, nothing gets cut off
                let heightLeft = imgHeight;
                let position = 0;
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfPageHeight;
                while (heightLeft > 0) {
                    position -= pdfPageHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                    heightLeft -= pdfPageHeight;
                }
            }

            pdf.save(`${document.getElementById('invoice_num').value}.pdf`);
            resetAfterExport();
        }

        function resetAfterExport() {
            setTimeout(() => {
                if(confirm("Invoice downloaded! Would you like to clear the form for a new invoice?")) {
                    resetForm();
                }
            }, 500);
        }

        function resetForm() {
            const inputs = [
                'c_name', 'c_phone', 'c_email', 'req_preferred_date', 'req_budget', 'req_description', 'req_notes', 'req_priority',
                'q_cust_name', 'q_valid_until', 'q_terms', 'notes',
                'inv_cust_name', 'inv_cust_phone', 'inv_cust_email', 'inv_cust_address', 'inv_due_date', 'inv_terms',
                'work_desc', 'amount', 'tax_rate', 'discount_rate', 'shipping',
                'w_biz_name', 'w_name', 'w_biz_address', 'w_biz_phone', 'w_biz_email', 'w_biz_website', 'w_tax_number',
                'w_signature', 'cust_signature',
                'bank_account_holder', 'bank_name', 'bank_iban', 'bank_account_number', 'bank_swift'
            ];
            inputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = (id.includes('rate') || id === 'amount' || id === 'req_budget' || id === 'shipping') ? '0' : '';
            });
            logoBase64 = null;
            const logoInput = document.getElementById('w_logo');
            if (logoInput) logoInput.value = '';
            paymentStatus = 'Pending';
            showQR = true;
            const qrToggleEl = document.getElementById('show_qr_toggle');
            if (qrToggleEl) qrToggleEl.checked = true;
            lineItems = [{ id: 'item_1', desc: '', qty: 1, price: 0 }];
            renderItemsForm();
            try { sessionStorage.removeItem('qq_current_num_' + currentTab); } catch (e) {}
            generateInvoiceNumber(true);
            updatePreview();
        }

        async function ensureSavedLink() {
            if (currentInvoiceId && viewingSharedInvoice) {
                return `${window.location.origin}${window.location.pathname}?id=${currentInvoiceId}`;
            }
            const saved = await saveInvoiceToDB();
            if (!saved) return null;
            return `${window.location.origin}${window.location.pathname}?id=${saved.id}`;
        }

        async function shareWA() {
            const data = getFormData();
            const symbol = getCurrencySymbol(data.currency);
            const link = await ensureSavedLink();
            if (!link) return;
            const label = currentTab === 'request' ? 'SERVICE REQUEST' : currentTab === 'quote' ? 'QUOTE' : 'SERVICE BILL';
            const msg = `*${label}*\n\n*Reference:* ${data.invoiceNum}\n*Amount:* ${symbol}${data.amount}\n*Details:* ${data.desc}\n\nView: ${link}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        }

        async function shareTG() {
            const data = getFormData();
            const link = await ensureSavedLink();
            if (!link) return;
            const msg = `Service Invoice: ${data.invoiceNum}\nAmount: ${data.amount}\nDetails: ${data.desc}`;
            window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(msg)}`, '_blank');
        }

        async function shareFB() {
            const link = await ensureSavedLink();
            if (!link) return;
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, '_blank');
        }

        // --- Save & Share (Database) ---
        async function saveInvoiceToDB() {
            if (!supabaseReady) {
                alert('Cloud save is temporarily unavailable. You can still download this as PDF/Image.');
                return null;
            }
            const data = getFormData();
            const subtotal = parseFloat(data.amount) || 0;
            const tax = (subtotal * (parseFloat(data.taxRate) || 0)) / 100;
            const discount = (subtotal * (parseFloat(data.discRate) || 0)) / 100;
            const total = subtotal + tax - discount;

            let record = {
                invoice_type: currentTab,
                invoice_number: data.invoiceNum,
                invoice_date: data.date,
                description: data.desc,
                tax_rate: data.taxRate,
                discount_rate: data.discRate,
                currency: data.currency
            };

            if (currentTab === 'request') {
                record = {
                    ...record,
                    customer_name: data.cName,
                    customer_phone: data.cPhone,
                    customer_email: data.cEmail,
                    service: data.cService,
                    preferred_date: data.preferredDate || null,
                    budget: parseFloat(data.budget) || 0,
                    notes: data.notes,
                    amount: parseFloat(data.budget) || 0,
                    priority: data.priority,
                    show_qr: showQR
                };
            } else if (currentTab === 'quote') {
                record = {
                    ...record,
                    customer_name: data.cName,
                    profession: data.wProf,
                    amount: total,
                    valid_until: data.validUntil || null,
                    terms: data.terms,
                    notes: data.notes,
                    signature: data.signature,
                    items_json: JSON.stringify(lineItems),
                    show_qr: showQR
                };
            } else {
                record = {
                    ...record,
                    business_name: data.wBizName,
                    worker_name: document.getElementById('w_name').value,
                    profession: data.wProf,
                    business_address: data.bizAddress,
                    business_phone: data.bizPhone,
                    business_email: data.bizEmail,
                    business_website: data.bizWebsite,
                    tax_number: data.taxNumber,
                    customer_name: data.cName,
                    customer_phone: data.cPhone,
                    customer_email: data.cEmail,
                    customer_address: data.custAddress,
                    due_date: data.dueDate || null,
                    amount: total,
                    shipping: parseFloat(data.shipping) || 0,
                    status: paymentStatus,
                    payment_method: data.paymentMethod,
                    account_holder: data.accountHolder,
                    bank_name: data.bankName,
                    iban: data.iban,
                    account_number: data.accountNumber,
                    swift_code: data.swiftCode,
                    signature: data.signature,
                    customer_signature: data.customerSignature,
                    notes: data.notes,
                    terms: data.terms,
                    items_json: JSON.stringify(lineItems),
                    show_qr: showQR
                };
            }

            if (currentUser) record.user_id = currentUser.id;

            let result;
            if (currentInvoiceId) {
                result = await sb.from('invoices').update(record).eq('id', currentInvoiceId).select().single();
            } else {
                result = await sb.from('invoices').insert(record).select().single();
            }

            if (result.error) {
                alert('Could not save invoice: ' + result.error.message);
                return null;
            }
            currentInvoiceId = result.data.id;
            return result.data;
        }

        async function saveAndShare() {
            const btn = event.target.closest('button');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = 'Saving...';
            btn.disabled = true;

            const saved = await saveInvoiceToDB();

            btn.innerHTML = originalHTML;
            btn.disabled = false;
            lucide.createIcons();

            if (!saved) return;

            const link = `${window.location.origin}${window.location.pathname}?id=${saved.id}`;
            document.getElementById('share-link-input').value = link;
            openModal('share-modal');
        }

        function copyShareLink() {
            const input = document.getElementById('share-link-input');
            navigator.clipboard.writeText(input.value).then(() => alert('Link copied!'));
        }

        function copyLink() { saveAndShare(); }

        function shareNative() {
            if (navigator.share) {
                navigator.share({
                    title: 'QuickQuote Pro',
                    text: 'Generate professional invoices in seconds!',
                    url: 'https://service-quote-generator.vercel.app/'
                });
            } else {
                copyLink();
            }
        }

        // --- Shared Invoice View ---
        async function loadSharedInvoice(id) {
            viewingSharedInvoice = true;
            currentInvoiceId = id;

            const { data, error } = await sb.rpc('get_invoice', { invoice_id: id });
            if (error || !data || data.length === 0) {
                alert('This invoice link is invalid or was removed.');
                viewingSharedInvoice = false;
                generateInvoiceNumber();
                updatePreview();
                return;
            }

            const inv = data[0];
            const docType = inv.invoice_type || 'invoice';

            // Multi-page safety: if this link is for a different tool than the current page, send them to the right page
            if (typeof PAGE_TYPE !== 'undefined' && docType !== PAGE_TYPE) {
                const pageMap = { invoice: 'invoice.html', quote: 'quote.html', request: 'request.html' };
                window.location.href = `${pageMap[docType] || 'invoice.html'}?id=${id}`;
                return;
            }

            currentTab = docType;
            paymentStatus = inv.status || 'Pending';
            showQR = inv.show_qr !== false;

            const setVal = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };

            populateDropdowns();

            // Populate hidden form fields so getFormData()/updatePreview() work as-is
            document.getElementById('invoice_num').value = inv.invoice_number || '';
            document.getElementById('invoice_date').value = inv.invoice_date || '';
            document.getElementById('work_desc').value = inv.description || '';
            document.getElementById('tax_rate').value = inv.tax_rate || 0;
            document.getElementById('discount_rate').value = inv.discount_rate || 0;
            setVal('notes', inv.notes || '');
            setVal('shipping', inv.shipping || 0);
            const qrToggleEl = document.getElementById('show_qr_toggle');
            if (qrToggleEl) qrToggleEl.checked = showQR;

            // Restore line items (invoice/quote)
            if (inv.items_json) {
                try {
                    const parsed = JSON.parse(inv.items_json);
                    if (Array.isArray(parsed) && parsed.length > 0) lineItems = parsed;
                } catch (e) { /* keep default */ }
            }
            renderItemsForm();

            if (currentTab === 'request') {
                document.getElementById('c_name').value = inv.customer_name || '';
                document.getElementById('c_phone').value = inv.customer_phone || '';
                document.getElementById('c_email').value = inv.customer_email || '';
                document.getElementById('c_service').value = inv.service || 'Other';
                document.getElementById('req_preferred_date').value = inv.preferred_date || '';
                document.getElementById('req_budget').value = inv.budget || inv.amount || 0;
                document.getElementById('req_description').value = inv.description || '';
                document.getElementById('req_notes').value = inv.notes || '';
                setVal('req_priority', inv.priority || 'Medium');
            } else if (currentTab === 'quote') {
                document.getElementById('q_cust_name').value = inv.customer_name || '';
                document.getElementById('q_profession').value = inv.profession || 'Other';
                document.getElementById('q_currency').value = inv.currency || 'USD';
                document.getElementById('q_valid_until').value = inv.valid_until || '';
                document.getElementById('q_terms').value = inv.terms || '';
                document.getElementById('amount').value = inv.amount || 0;
                setVal('q_signature', inv.signature || '');
            } else {
                document.getElementById('inv_cust_name').value = inv.customer_name || '';
                document.getElementById('inv_cust_phone').value = inv.customer_phone || '';
                document.getElementById('inv_cust_email').value = inv.customer_email || '';
                document.getElementById('inv_due_date').value = inv.due_date || '';
                document.getElementById('w_biz_name').value = inv.business_name || '';
                document.getElementById('w_name').value = inv.worker_name || '';
                document.getElementById('w_profession').value = inv.profession || 'Other';
                document.getElementById('w_currency').value = inv.currency || 'USD';
                document.getElementById('w_signature').value = inv.signature || '';
                document.getElementById('payment_method').value = inv.payment_method || 'Cash';
                document.getElementById('amount').value = inv.amount || 0;
                setVal('w_biz_address', inv.business_address || '');
                setVal('w_biz_phone', inv.business_phone || '');
                setVal('w_biz_email', inv.business_email || '');
                setVal('w_biz_website', inv.business_website || '');
                setVal('w_tax_number', inv.tax_number || '');
                setVal('inv_cust_address', inv.customer_address || '');
                setVal('cust_signature', inv.customer_signature || '');
                setVal('inv_terms', inv.terms || '');
                setVal('bank_account_holder', inv.account_holder || '');
                setVal('bank_name', inv.bank_name || '');
                setVal('bank_iban', inv.iban || '');
                setVal('bank_account_number', inv.account_number || '');
                setVal('bank_swift', inv.swift_code || '');
            }

            // Switch tab visuals without re-triggering a fresh invoice number (defensive: elements may not exist on dedicated pages)
            const safeToggle = (id, cls, cond) => {
                const el = document.getElementById(id);
                if (!el) return;
                if (cls === 'hidden') {
                    el.classList.remove('hidden');
                    el.style.display = cond ? 'none' : '';
                } else {
                    el.classList.toggle(cls, cond);
                }
            };
            safeToggle('request-fields', 'hidden', currentTab !== 'request');
            safeToggle('quote-fields', 'hidden', currentTab !== 'quote');
            safeToggle('worker-fields', 'hidden', currentTab !== 'invoice');
            safeToggle('amount-section', 'hidden', currentTab === 'request');
            safeToggle('payment-status-section', 'hidden', currentTab !== 'invoice');
            ['invoice', 'quote', 'request'].forEach(t => {
                safeToggle('tab-' + t, 'tab-active', currentTab === t);
            });

            // Lock the form: this is a read-only shared view
            document.querySelectorAll('#form-content input, #form-content select, #form-content textarea').forEach(el => el.setAttribute('disabled', 'true'));
            const btnRow = document.querySelector('.flex.gap-4.pt-6');
            if (btnRow) btnRow.classList.add('hidden');

            // Show status buttons as active/clickable so recipient/sender can update it
            const banner = document.createElement('div');
            banner.className = 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-xs text-emerald-700 dark:text-emerald-400 font-bold mb-4';
            banner.innerText = "You're viewing a shared invoice. Use the buttons below the preview to update payment status.";
            document.getElementById('form-content').prepend(banner);

            updatePreview();
        }

        async function updateSharedStatus(status) {
            paymentStatus = status;
            if (!supabaseReady) { setStatus(status); return; }
            if (currentUser) {
                await sb.from('invoices').update({ status }).eq('id', currentInvoiceId);
            } else {
                await sb.rpc('update_guest_invoice', { invoice_id: currentInvoiceId, new_status: status, new_payment_method: null });
            }
            setStatus(status);
        }

        function scrollToApp() {
            const target = document.getElementById('app-interface');
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            } else {
                window.location.href = 'invoice.html';
            }
        }

        function generateAndScroll() {
            updatePreview();
            document.getElementById('invoice-preview-container').scrollIntoView({ behavior: 'smooth' });
            alert("Preview updated! Use the buttons below to Save or Share.");
        }

        // --- PWA Support ---
        let deferredPrompt;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            document.getElementById('installApp').classList.remove('hidden');
        });

        document.getElementById('installApp').addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') deferredPrompt = null;
            }
        });

        // Register Service Worker for Offline
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('data:application/javascript;base64,' + btoa(`
                    self.addEventListener('install', e => e.waitUntil(caches.open('qq-v1').then(c => c.addAll(['/']))));
                    self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
                `));
            });
        }
    