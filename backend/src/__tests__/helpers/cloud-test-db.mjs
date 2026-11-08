const testingHost = 'ep-round-breeze-b3p8jbri.c-4.ap-southeast-1.aws.neon.tech'

export function assertIsolatedNeonTestDatabase(databaseUrl, directUrl) {
  try {
    const urls = [new URL(databaseUrl), new URL(directUrl)]
    if (urls.some(url => url.protocol !== 'postgresql:' || url.hostname !== testingHost ||
      !/^\/smartface_test_[a-f0-9]{16}$/.test(url.pathname) || url.searchParams.get('sslmode') !== 'require' ||
      url.searchParams.get('channel_binding') !== 'require') || urls[0].pathname !== urls[1].pathname) throw new Error()
  } catch {
    throw new Error('Integration tests require the isolated temporary Neon testing database')
  }
}
