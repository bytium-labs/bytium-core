/** Extracts the bare IP from a peer address, dropping the `:port` that the transport appends. */
export function clientIp(address: string): string {
  if (!address) return address;

  if (address[0] === "[") {
    const end = address.indexOf("]");

    return end > 0 ? address.slice(1, end) : address;
  }

  // An IPv4 address with a port ("a.b.c.d:port") has a single colon; a bare IPv6 address has several.
  return address.split(":").length === 2 ? address.split(":")[0] : address;
}
