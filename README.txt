SGC Studio Foundation - additive deployment

1. Back up your existing sgc-website-studio.html.
2. Upload the four HTML/CSS/JS files to the ROOT of your GitHub Pages repository.
3. Do not replace sgc-academy-extra/admin.html, kits.html, shop.html, or any Supabase SQL.
4. Log in to sgc-academy-extra/admin.html and click Open Website Studio.
5. Verify sections load; edit a heading; Save Draft; Publish; refresh kits.html.

Uses existing Supabase RPC functions: sgc_studio_is_admin, sgc_studio_save_draft, sgc_studio_publish.
Only the kits page is connected. Additional pages, themes, rollback, and product management are NOT implemented in this foundation.
Note: The public kits.html renderer currently supports hero/text/image/button/cards with specific field mappings. Verify image and button rendering before publishing.
