// Shims for Next.js modules when bundling app components for jsdom tests.
export function useRouter() {
  return { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };
}
export function usePathname() { return "/"; }
export function useSearchParams() { return new URLSearchParams(); }
export function redirect() {}
export function notFound() {}
export function useParams() { return {}; }
