// Talks to the Google Wallet REST API and signs "Save to Google Wallet" links.
// No key file: the function's own service account signs through Google's IAM API,
// so there is no secret to store anywhere.
import { GoogleAuth } from 'google-auth-library';

const API = 'https://walletobjects.googleapis.com/walletobjects/v1';
const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';

const b64url = (s) => Buffer.from(s).toString('base64url');
const statusOf = (e) => e?.response?.status || e?.status || e?.code;

export function createGoogle({ auth = new GoogleAuth({ scopes: [SCOPE] }) } = {}) {
  let clientP = null;
  const client = () => (clientP ||= auth.getClient());
  async function call(method, path, data) {
    const c = await client();
    try {
      const r = await c.request({ url: API + path, method, data });
      return r.data;
    } catch (e) {
      if (statusOf(e) === 404) return null;
      const msg = e?.response?.data?.error?.message || e.message;
      const err = new Error(`Google Wallet ${method} ${path}: ${msg}`); err.status = statusOf(e); throw err;
    }
  }
  const enc = encodeURIComponent;

  const G = {
    async getClass(id) { return call('GET', `/loyaltyClass/${enc(id)}`); },
    async upsertClass(cls) {
      const cur = await G.getClass(cls.id);
      return cur ? call('PATCH', `/loyaltyClass/${enc(cls.id)}`, cls) : call('POST', '/loyaltyClass', cls);
    },
    async getObject(id) { return call('GET', `/loyaltyObject/${enc(id)}`); },
    async upsertObject(obj) {
      const cur = await G.getObject(obj.id);
      return cur ? call('PUT', `/loyaltyObject/${enc(obj.id)}`, obj) : call('POST', '/loyaltyObject', obj);
    },
    // Updates a pass only if the customer has already saved it (never creates one).
    async updateObjectIfExists(obj) {
      const cur = await G.getObject(obj.id);
      if (!cur) return false;
      await call('PUT', `/loyaltyObject/${enc(obj.id)}`, obj);
      return true;
    },
    async serviceEmail() {
      const c = await auth.getCredentials();
      if (!c?.client_email) throw new Error('Cannot find the service account email');
      return c.client_email;
    },
    // RS256 JWT signed by the service account (IAM signBlob when there is no key file).
    async signJwt(claims) {
      const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
      const body = b64url(JSON.stringify(claims));
      const sig = await auth.sign(`${head}.${body}`);
      return `${head}.${body}.${Buffer.from(sig, 'base64').toString('base64url')}`;
    },
  };
  return G;
}

export const saveUrl = (jwt) => `https://pay.google.com/gp/v/save/${jwt}`;
