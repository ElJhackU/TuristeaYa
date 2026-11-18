// One refresh in flight per session; late responses cannot restore a signed-out account.
export function createSessionManager({ initial = null, refresh, onChange = () => {} }) {
  let session = initial;
  let generation = 0;
  let pending;
  const tokens = new Set(initial?.access_token ? [initial.access_token] : []);
  function set(value) {
    generation += 1;
    pending = undefined;
    tokens.clear();
    if (value?.access_token) tokens.add(value.access_token);
    session = value;
    onChange(value);
  }
  return {
    get: () => session,
    set,
    resolve: (token) => tokens.has(token) ? session?.access_token : token,
    async renew(token) {
      if (!tokens.has(token) || !session?.refresh_token) return null;
      if (token !== session.access_token) return session.access_token;
      if (pending) return pending;
      const version = generation;
      const current = session;
      pending = (async () => {
        try {
          const next = await refresh(current.refresh_token);
          if (version !== generation) return null;
          if (!next?.access_token || !next?.refresh_token || next.user?.id !== current.user.id) {
            set(null);
            return null;
          }
          session = next;
          tokens.add(next.access_token);
          onChange(next);
          return next.access_token;
        } catch (error) {
          if (version === generation && [400, 401, 403].includes(error.status)) set(null);
          throw error;
        } finally {
          if (version === generation) pending = undefined;
        }
      })();
      return pending;
    },
  };
}
