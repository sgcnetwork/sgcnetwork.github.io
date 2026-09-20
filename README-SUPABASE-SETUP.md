# SGC Network + Supabase

This package is the Supabase-ready SGC Network frontend. It keeps GitHub Pages as the website and uses Supabase for authentication/database.

## 1. Create your Supabase project
Create a project at https://supabase.com/.

## 2. Run the database setup
Open Supabase Dashboard → SQL Editor → New query.
Paste all of `supabase/schema.sql` and run it.

## 3. Add your public connection details
Open `js/config.js` and replace:
- `PASTE_SUPABASE_PROJECT_URL` with your project URL
- `PASTE_SUPABASE_PUBLISHABLE_KEY` with the **publishable** key

Never put a Supabase secret/service-role key in this repository. Supabase documents publishable keys as safe for browser code when Row Level Security is correctly configured; secret keys bypass RLS and must stay server-side.

## 4. Auth URL settings
In Supabase Authentication → URL Configuration, add:
- Site URL: https://sgcnetwork.co.za
- Redirect URLs: https://sgcnetwork.co.za/**

## 5. Upload to GitHub Pages
Upload the contents of this folder to your `sgcnetwork/sgcnetwork.github.io` repository.

The member routes are:
- `/signup.html`
- `/login.html`
- `/dashboard.html`
- `/academy.html`
- `/payments.html`
- `/community.html`

This is the foundation. Paystack webhooks, admin authorization, automatic kit unlocking, full course management and production community features should be connected through secure server-side/Edge Function logic next.
