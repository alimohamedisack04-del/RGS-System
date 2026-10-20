/** Links for units */
export const unitPath = (type, id) => `/${type === 'room' ? 'rooms' : type === 'apartment' ? 'apartments' : 'lands'}/${id}`;
export const payPath = (key, y, m) => `/payments/new?unit=${encodeURIComponent(key)}${m ? `&month=${m}&year=${y}` : ''}`;
