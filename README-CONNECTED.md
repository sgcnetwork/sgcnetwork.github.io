# SGC Network — Supabase Connected Package

This package is connected to the SGC Network Supabase project using the project's public publishable key.

## Important
- The publishable key is safe for browser code when Row Level Security is correctly configured.
- NEVER add a Supabase `sb_secret_...` key or legacy `service_role` key to this folder.
- The database schema and RLS policies must already be installed in Supabase.

## Current connection
- Supabase project URL: configured in `js/config.js`
- Authentication: Supabase Auth
- Session persistence: enabled

## Next step
Upload this package to the GitHub Pages repository after we test the login flow. Do not change the Supabase key file manually unless you are rotating the public key.
