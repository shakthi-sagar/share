import { config } from "zod";

// Parse without compiling validators through `Function`. Browsers running this app forbid eval
// through their Content Security Policy, and so do Cloudflare Workers. zod decides this when a
// schema is constructed, so this module must be imported before any module that defines one.
config({ jitless: true });
