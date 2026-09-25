# Rapsometeddy Anime Studio

AI-assisted workspace for turning original stories and songs into anime/motion-manga episodes.

## Pipeline
Story → episode blueprint → character prompts → scene prompts → image generation → motion → voices/subtitles → original song → edit → approval → YouTube.

## Implemented
- Mobile-first purple Rapsometeddy dashboard
- Episode creator
- Server-side episode generation
- Demo mode without an AI key
- Provider-neutral artwork prompts
- Image-generation endpoint using Pollinations
- Preview URL mode when no Pollinations key is configured

## Image generation
Set `POLLINATIONS_API_KEY` in Vercel for authenticated requests. The API supports image generation through `/image/{prompt}`; model availability can change, so the app keeps the model configurable.

Free availability is not treated as unlimited: current provider documentation says authenticated generation requires an API key and pricing/credits can change. citeturn0search0

Never commit API keys.