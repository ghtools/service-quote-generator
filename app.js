
        // --- Supabase Setup ---
        const SUPABASE_URL = 'https://iudufhafmhwuqwheloix.sb.co';
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

        // --- Initialization ---
        window.onload = async () => {
            lucide.createIcons();
            populateDropdowns();
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
                'c_name', 'c_phone', 'c_email', 'c_service', 'req_preferred_date', 'req_budget', 'req_description', 'req_notes',
                'q_cust_name', 'q_profession', 'q_currency', 'q_valid_until', 'q_terms',
                'inv_cust_name', 'inv_cust_phone', 'inv_cust_email', 'inv_due_date',
                'w_biz_name', 'w_name', 'w_profession', 'w_currency', 'w_signature', 'payment_method',
                'work_desc', 'amount', 'tax_rate', 'discount_rate', 'invoice_date'
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

            // Update Preview Text
            document.getElementById('prev-invoice-num').innerText = data.invoiceNum;
            document.getElementById('prev-to-date').innerText = data.date ? new Date(data.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
            document.getElementById('prev-desc').innerText = data.desc || 'No description provided...';

            if (currentTab === 'request') {
                document.getElementById('prev-from-name').innerText = 'QuickQuote User';
                document.getElementById('prev-from-prof').innerText = 'Service Request';
                document.getElementById('prev-to-name').innerText = data.cService || 'Any Professional';
                document.getElementById('prev-invoice-type').innerText = 'SERVICE REQUEST';
            } else if (currentTab === 'quote') {
                document.getElementById('prev-from-name').innerText = data.wProf || 'Professional Service';
                document.getElementById('prev-from-prof').innerText = 'Quote';
                document.getElementById('prev-to-name').innerText = data.cName || 'Valued Customer';
                document.getElementById('prev-invoice-type').innerText = 'QUOTE';
            } else {
                document.getElementById('prev-from-name').innerText = data.wBizName || 'Your Business Name';
                document.getElementById('prev-from-prof').innerText = data.wProf || 'Professional Service';
                document.getElementById('prev-to-name').innerText = data.cName || 'Valued Customer';
                document.getElementById('prev-invoice-type').innerText = 'OFFICIAL BILL';
            }

            // Logo
            const logoPreview = document.getElementById('biz-logo-preview');
            if (logoBase64) {
                logoPreview.innerHTML = `<img src="${logoBase64}" class="w-full h-full object-cover">`;
            } else {
                logoPreview.innerHTML = `<i data-lucide="image" class="w-8 h-8 text-slate-300"></i>`;
                lucide.createIcons();
            }

            const symbol = getCurrencySymbol(data.currency);

            if (currentTab === 'request') {
                // Show Budget instead of pricing breakdown
                document.getElementById('prev-pricing-block').classList.add('hidden');
                document.getElementById('prev-budget-block').classList.remove('hidden');
                document.getElementById('prev-budget').innerText = `${symbol}${(parseFloat(data.budget) || 0).toFixed(2)}`;
                document.getElementById('prev-status').classList.add('hidden');
                document.getElementById('prev-pay-method').innerText = '';
            } else {
                document.getElementById('prev-pricing-block').classList.remove('hidden');
                document.getElementById('prev-budget-block').classList.add('hidden');

                const subtotal = parseFloat(data.amount) || 0;
                const tax = (subtotal * (parseFloat(data.taxRate) || 0)) / 100;
                const discount = (subtotal * (parseFloat(data.discRate) || 0)) / 100;
                const total = subtotal + tax - discount;

                document.getElementById('prev-subtotal').innerText = `${symbol}${subtotal.toFixed(2)}`;
                document.getElementById('prev-tax-rate').innerText = data.taxRate;
                document.getElementById('prev-tax-val').innerText = `${symbol}${tax.toFixed(2)}`;
                document.getElementById('prev-disc-rate').innerText = data.discRate;
                document.getElementById('prev-disc-val').innerText = `-${symbol}${discount.toFixed(2)}`;
                document.getElementById('prev-total-label').innerText = currentTab === 'quote' ? 'Estimated Total' : 'Grand Total';
                document.getElementById('prev-total').innerText = `${symbol}${total.toFixed(2)}`;

                if (currentTab === 'invoice') {
                    document.getElementById('prev-status').classList.remove('hidden');
                    const statusEl = document.getElementById('prev-status');
                    statusEl.innerText = paymentStatus;
                    statusEl.className = `inline-block px-4 py-1 rounded-full text-[10px] font-black uppercase mb-2`;
                    if (paymentStatus === 'Paid') statusEl.classList.add('bg-emerald-100', 'text-emerald-700');
                    else if (paymentStatus === 'Pending') statusEl.classList.add('bg-amber-100', 'text-amber-700');
                    else statusEl.classList.add('bg-blue-100', 'text-blue-700');
                    document.getElementById('prev-pay-method').innerText = data.paymentMethod ? 'via ' + data.paymentMethod : '';
                } else {
                    document.getElementById('prev-status').classList.add('hidden');
                    document.getElementById('prev-pay-method').innerText = data.validUntil ? 'Valid until ' + new Date(data.validUntil).toLocaleDateString() : '';
                }
            }

            // Signature (invoice only)
            const sigBlock = document.getElementById('signature-block');
            if (currentTab === 'invoice' && data.signature) {
                sigBlock.classList.remove('hidden');
                document.getElementById('prev-signature').innerText = data.signature;
            } else {
                sigBlock.classList.add('hidden');
            }

            // QR Code — encode the actual document link/data
            generateQR();
        }

        function getFormData() {
            const base = {
                invoiceNum: document.getElementById('invoice_num').value,
                date: document.getElementById('invoice_date').value,
                desc: document.getElementById('work_desc').value,
                amount: document.getElementById('amount').value,
                taxRate: document.getElementById('tax_rate').value,
                discRate: document.getElementById('discount_rate').value
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
                    terms: document.getElementById('q_terms').value
                };
            }

            // invoice
            return {
                ...base,
                cName: document.getElementById('inv_cust_name').value,
                cPhone: document.getElementById('inv_cust_phone').value,
                cEmail: document.getElementById('inv_cust_email').value,
                dueDate: document.getElementById('inv_due_date').value,
                currency: document.getElementById('w_currency').value,
                wBizName: document.getElementById('w_biz_name').value,
                wProf: document.getElementById('w_profession').value,
                signature: document.getElementById('w_signature').value,
                paymentMethod: document.getElementById('payment_method').value
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

        async function exportPDF() {
            const element = document.getElementById('invoice-card');
            const canvas = await html2canvas(element, { scale: 3, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
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
                'c_name', 'c_phone', 'c_email', 'req_preferred_date', 'req_budget', 'req_description', 'req_notes',
                'q_cust_name', 'q_valid_until', 'q_terms',
                'inv_cust_name', 'inv_cust_phone', 'inv_cust_email', 'inv_due_date',
                'work_desc', 'amount', 'tax_rate', 'discount_rate', 'w_biz_name', 'w_name', 'w_signature'
            ];
            inputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = (id.includes('rate') || id === 'amount' || id === 'req_budget') ? '0' : '';
            });
            logoBase64 = null;
            const logoInput = document.getElementById('w_logo');
            if (logoInput) logoInput.value = '';
            paymentStatus = 'Pending';
            generateInvoiceNumber();
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
                    amount: parseFloat(data.budget) || 0
                };
            } else if (currentTab === 'quote') {
                record = {
                    ...record,
                    customer_name: data.cName,
                    profession: data.wProf,
                    amount: total,
                    valid_until: data.validUntil || null,
                    terms: data.terms
                };
            } else {
                record = {
                    ...record,
                    business_name: data.wBizName,
                    worker_name: document.getElementById('w_name').value,
                    profession: data.wProf,
                    customer_name: data.cName,
                    customer_phone: data.cPhone,
                    customer_email: data.cEmail,
                    due_date: data.dueDate || null,
                    amount: total,
                    status: paymentStatus,
                    payment_method: data.paymentMethod,
                    signature: data.signature
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

            populateDropdowns();

            // Populate hidden form fields so getFormData()/updatePreview() work as-is
            document.getElementById('invoice_num').value = inv.invoice_number || '';
            document.getElementById('invoice_date').value = inv.invoice_date || '';
            document.getElementById('work_desc').value = inv.description || '';
            document.getElementById('tax_rate').value = inv.tax_rate || 0;
            document.getElementById('discount_rate').value = inv.discount_rate || 0;

            if (currentTab === 'request') {
                document.getElementById('c_name').value = inv.customer_name || '';
                document.getElementById('c_phone').value = inv.customer_phone || '';
                document.getElementById('c_email').value = inv.customer_email || '';
                document.getElementById('c_service').value = inv.service || 'Other';
                document.getElementById('req_preferred_date').value = inv.preferred_date || '';
                document.getElementById('req_budget').value = inv.budget || inv.amount || 0;
                document.getElementById('req_description').value = inv.description || '';
                document.getElementById('req_notes').value = inv.notes || '';
            } else if (currentTab === 'quote') {
                document.getElementById('q_cust_name').value = inv.customer_name || '';
                document.getElementById('q_profession').value = inv.profession || 'Other';
                document.getElementById('q_currency').value = inv.currency || 'USD';
                document.getElementById('q_valid_until').value = inv.valid_until || '';
                document.getElementById('q_terms').value = inv.terms || '';
                document.getElementById('amount').value = inv.amount || 0;
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
            }

            // Switch tab visuals without re-triggering a fresh invoice number (defensive: elements may not exist on dedicated pages)
            const safeToggle = (id, cls, cond) => { const el = document.getElementById(id); if (el) el.classList.toggle(cls, cond); };
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
            document.getElementById('app-interface').scrollIntoView({ behavior: 'smooth' });
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
    