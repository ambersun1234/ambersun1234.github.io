function header(GITHUB_TOKEN: string) {
  const ghHeaders: Record<string, string> = {
    "User-Agent": "Cloudflare-Worker",
    ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
  };

  return ghHeaders;
}

export { header };
