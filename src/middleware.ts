import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for
  // - /api routes
  // - /_next (Next.js internals)
  // - /_vercel (Vercel internals)
  // - Static files with common extensions
  matcher: [
    // Match all paths except API, Next.js internals, and static files
    // Use specific file extensions instead of generic .* pattern
    // to avoid matching view state params like @75,5.9h,-1.0p
    "/((?!api|_next|_vercel|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|css|js|woff|woff2|ttf|eot|json|xml|txt|pdf|mp4|webm|mp3|wav)).*)",
    "/",
  ],
};
