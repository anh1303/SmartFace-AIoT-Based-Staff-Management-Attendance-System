const defaultTestingHost = 'ep-round-breeze-b3p8jbri.c-4.ap-southeast-1.aws.neon.tech'

export function assertTestingNeonEndpoint(connection, forbiddenHosts) {
  try {
    const url = new URL(connection)
    if (url.protocol !== 'postgresql:' || !/^ep-[a-z0-9-]+(?:\.[a-z0-9-]+)+\.aws\.neon\.tech$/.test(url.hostname) ||
      /-pooler\./.test(url.hostname) || forbiddenHosts.some(host => host.replace(/-pooler(?=\.)/, '') === url.hostname) || url.pathname !== '/neondb' ||
      url.searchParams.get('sslmode') !== 'require' || url.searchParams.get('channel_binding') !== 'require') throw new Error()
    return url.hostname
  } catch { throw new Error('The configured Neon test branch is invalid or matches an application database endpoint') }
}

export function assertIsolatedNeonTestDatabase(databaseUrl, directUrl, expectedHost = process.env.SMARTFACE_TEST_NEON_HOST || defaultTestingHost) {
  try {
    const urls = [new URL(databaseUrl), new URL(directUrl)]
    if (urls.some(url => url.protocol !== 'postgresql:' || url.hostname !== expectedHost ||
      !/^\/smartface_test_[a-f0-9]{16}$/.test(url.pathname) || url.searchParams.get('sslmode') !== 'require' ||
      url.searchParams.get('channel_binding') !== 'require') || urls[0].pathname !== urls[1].pathname) throw new Error()
  } catch {
    throw new Error('Integration tests require the isolated temporary Neon testing database')
  }
}
