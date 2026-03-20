<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/760e6625-d344-4b21-a27e-ffbef0bdf8e6

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Create a local environment file:
   `cp .env.example .env.local`
3. Set required values in `.env.local`:
   - `JWT_SECRET` (required): secret used by auth token code in `server.ts`.
   - `VITE_ENABLE_STUDIO` (recommended): set to `true` to enable `/studio`, or `false` to show the coming soon page.
4. Optional values:
   - `GEMINI_API_KEY`: only required when media generation APIs are enabled/implemented.
   - `APP_URL`: used in hosted environments for callback/self links.
5. Run the app:
   `npm run dev`
