SGC STUDIO - ISOLATED FOLDER INSTALL

Upload the entire sgc-studio folder into the ROOT of your existing GitHub Pages repository.
Open https://sgcnetwork.co.za/sgc-studio/

This is an additive update. It does not replace your existing admin.html, kits.html, academy, shop, dashboard, checkout or homepage.

To link it from your existing admin dashboard, add a link to /sgc-studio/ in the admin navigation later. You can also open the URL directly while signed in as admin.

WORKING WITH YOUR EXISTING SUPABASE FUNCTIONS:
- Admin-only access via sgc_studio_is_admin RPC
- Business Kits draft load via sgc_website_studio_pages
- Save draft via sgc_studio_save_draft
- Publish via sgc_studio_publish
- Add, duplicate, delete, reorder sections; edit text, image URL, background, button links; undo/redo and device previews.

IMPORTANT LIMITATIONS:
- Shopify-style sidebar includes planned modules. Products, orders, collections, global themes, menus and SEO are NOT yet connected.
- Existing pages are listed as live links, but they are NOT fully editable through Studio until their renderers are integrated.
- New section types such as featured collections and product grids can be drafted, but require a compatible public renderer and product linkage before they appear correctly on the live site.
- Image upload to Supabase Storage is not implemented; images currently use URL fields.
- This update has not been tested against live Supabase or deployed GitHub Pages.
- Do not publish unsupported new section types until the public kits.html renderer supports them.
