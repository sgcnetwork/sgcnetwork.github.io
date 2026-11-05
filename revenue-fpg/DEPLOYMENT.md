# Revenue FPG hosting

The application is deployed through SGC Network GitHub Pages at https://sgcnetwork.co.za/revenue-fpg/ with the existing SGC Supabase project. No company data or service-role secret is included in this public repository. Finance access and store scope are enforced by Supabase.

The revenuesystem.sgcnetwork.co.za route is prepared in cloudflare/website-router.js and still needs deployment to the existing sgc-customer-websites Cloudflare Worker. Its former ChatGPT Sites custom-domain attachment was removed, and the old Sites copy is owner-private. Cloudflare GitHub sign-in returned "Unable to sign in" on 5 November 2026, preventing Worker deployment through the browser.

The parent-domain deployment uses relative asset URLs and customer links, and the deployed fpg-operations Edge Function accepts https://sgcnetwork.co.za and https://revenuesystem.sgcnetwork.co.za origins. Source connections, staff assignments and email configuration remain required as described in the application.
