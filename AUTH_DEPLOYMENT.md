# Ohmie authentication website deployment

This checkout contains the production-facing files required before changing the iOS email callbacks:

- `auth/email/index.html`
- `auth/reset/index.html`
- `auth-callback.js`
- corrected `privacy.html`

## Deployment order

1. Merge and deploy these files to the GitHub Pages repository that serves `ohmie.io`.
2. Verify all three URLs return HTTP 200:
   - `https://ohmie.io/auth/email/`
   - `https://ohmie.io/auth/reset/`
   - `https://ohmie.io/privacy`
3. In Supabase **Authentication → URL Configuration**, add these exact redirect URLs:
   - `https://ohmie.io/auth/email/`
   - `https://ohmie.io/auth/reset/`
4. In the iOS project, change only the email URLs in `OhmieAuthentication.swift`:

   ```swift
   static let emailCallbackURL = URL(string: "https://ohmie.io/auth/email/")!
   static let passwordResetCallbackURL = URL(string: "https://ohmie.io/auth/reset/")!
   ```

   Keep the Google callback as `ohmie://auth/callback`.
5. Build a new TestFlight version and test confirmation and password reset on:
   - the same physical device and app installation where the link was requested;
   - another device without Ohmie installed (confirmation may succeed, but automatic PKCE sign-in/reset must direct the user back to request from the target device);
   - an expired/reused link.

The web pages preserve the Supabase query string and fragment, then create an explicit `ohmie://auth/email` or `ohmie://auth/reset` button. This gives users a valid HTTPS landing page instead of Safari's “address is invalid” error while retaining the app's existing deep-link parser.

## Production email

Before public signup, enable custom SMTP in **Authentication → Emails → SMTP Settings**, configure SPF/DKIM/DMARC for the sender domain, review email rate limits, and test delivery to an address that is not a member of the Supabase project team.
