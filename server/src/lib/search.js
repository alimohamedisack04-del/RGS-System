/** Room search: room number, room type, tenant name, tenant phone (phone matches with or without spaces / + / -). */
function roomMatches(room, tenant, q) {
  q = String(q || '').trim().toLowerCase();
  if (!q) return true;
  const hay = `${room.roomNumber} ${room.roomType || ''} ${tenant ? tenant.fullName + ' ' + (tenant.phone || '') : ''}`.toLowerCase();
  if (hay.includes(q)) return true;
  const d = q.replace(/\D+/g, '');
  return d.length >= 4 && !!tenant && String(tenant.phone || '').replace(/\D+/g, '').includes(d);
}
/**
 * Room to open straight away: exactly one exact room number / phone match, or the only match.
 * `rooms` items: {id, roomNumber, tenantPhone}
 */
function pickRoom(rooms, q) {
  q = String(q || '').trim();
  if (!q || !rooms.length) return null;
  const qd = q.replace(/\D+/g, '');
  const exact = rooms.filter((r) => {
    if (String(r.roomNumber).toLowerCase() === q.toLowerCase()) return true;
    const pd = String(r.tenantPhone || '').replace(/\D+/g, '');
    return qd.length >= 6 && pd !== '' && pd.endsWith(qd);
  });
  if (exact.length === 1) return exact[0].id;
  return rooms.length === 1 ? rooms[0].id : null;
}
module.exports = { roomMatches, pickRoom };
