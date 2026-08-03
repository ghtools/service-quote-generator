
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
                <input type="text" value="${escapeHtml(item.desc)}" placeholder="Item description" oninput="updateItemField('${item.id}','desc',this.value)" class="col-span-5 px-2 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none">
                <input type="number" value="${item.qty}" min="0" oninput="updateItemField('${item.id}','qty',this.value)" class="col-span-2 px-2 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-center">
                <input type="number" value="${item.price}" min="0" step="0.01" oninput="updateItemField('${item.id}','price',this.value)" class="col-span-2 px-2 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-right">
                <span id="row-amt-${item.id}" class="col-span-2 text-sm font-bold text-right pr-1">${(item.qty * item.price).toFixed(2)}</span>
                <button type="button" onclick="removeItemRow('${item.id}')" class="col-span-1 text-red-400 hover:text-red-600 flex justify-center"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
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

        // --- Initialization ---
        window.onload = async () => {
            lucide.createIcons();
            populateDropdowns();
            renderItemsForm();
            recalcItemsTotal();
            document.getElementById('invoice_date').valueAsDate = new Date();
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

        function generateInvoiceNumber() {
            const date = new Date();
            const dateStr = date.getFullYear() + String(date.getMonth() + 1).padStart(2, '0') + String(date.getDate()).padStart(2, '0');
            const random = Math.floor(1000 + Math.random() * 9000);
            const prefix = currentTab === 'quote' ? 'QUO' : currentTab === 'request' ? 'REQ' : 'INV';
            document.getElementById('invoice_num').value = `${prefix}-${dateStr}-${random}`;
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
   
