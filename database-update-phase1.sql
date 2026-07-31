-- ============================================
-- QuickQuote Pro - Phase 1 Update
-- Run this in Supabase SQL Editor (adds new columns for Quote & Service Request)
-- ============================================

alter table public.invoices add column if not exists customer_email text;
alter table public.invoices add column if not exists due_date date;
alter table public.invoices add column if not exists valid_until date;
alter table public.invoices add column if not exists terms text;
alter table public.invoices add column if not exists preferred_date date;
alter table public.invoices add column if not exists budget numeric;
alter table public.invoices add column if not exists notes text;

-- Done! You should see "Success. No rows returned" after running this.
