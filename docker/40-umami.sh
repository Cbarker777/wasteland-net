#!/bin/sh
# Runs at container start (nginx image runs /docker-entrypoint.d/*.sh) and
# writes analytics.js for the page to load.
#
#   UMAMI_SCRIPT_URL  e.g. https://umami.example.org/script.js   (required to enable)
#   UMAMI_WEBSITE_ID  the website's ID from Umami                 (required to enable)
#   UMAMI_DOMAINS     optional: only track on these hostnames, comma-separated
#
# With either required variable unset, analytics.js is a no-op and the page
# makes no analytics requests at all.
set -eu

OUT="${ANALYTICS_OUT:-/usr/share/nginx/html/analytics.js}"
URL="${UMAMI_SCRIPT_URL:-}"
ID="${UMAMI_WEBSITE_ID:-}"
DOMAINS="${UMAMI_DOMAINS:-}"

off() {
  echo "// Analytics off. Set UMAMI_SCRIPT_URL and UMAMI_WEBSITE_ID on the container to enable." > "$OUT"
  echo "wasteland-net: analytics off${1:+ ($1)}"
}

if [ -z "$URL" ] || [ -z "$ID" ]; then
  off
  exit 0
fi

# These values are pasted into JavaScript, so only accept what they should look like.
case "$URL" in
  http://*|https://*) ;;
  *) off "UMAMI_SCRIPT_URL must start with http:// or https://"; exit 0 ;;
esac
if printf '%s%s%s' "$URL" "$ID" "$DOMAINS" | grep -q "[\"'\\<> ]"; then
  off "UMAMI_* values must not contain quotes, spaces, backslashes, or angle brackets"
  exit 0
fi

{
  echo "(function () {"
  echo "  var s = document.createElement('script');"
  echo "  s.defer = true;"
  echo "  s.src = '$URL';"
  echo "  s.setAttribute('data-website-id', '$ID');"
  echo "  // Screens aren't URLs, so the app sends its own pageviews (src/analytics.ts)."
  echo "  s.setAttribute('data-auto-track', 'false');"
  echo "  s.setAttribute('data-do-not-track', 'true');"
  if [ -n "$DOMAINS" ]; then echo "  s.setAttribute('data-domains', '$DOMAINS');"; fi
  echo "  s.onload = function () { window.dispatchEvent(new Event('umami:ready')); };"
  echo "  document.head.appendChild(s);"
  echo "})();"
} > "$OUT"
echo "wasteland-net: analytics on (Umami at $URL)"
