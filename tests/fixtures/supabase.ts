export function supabase() {
  return {
    auth: {
      resetPasswordForEmail: async () => ({ error: null }),
      signOut: async () => ({ error: null }),
    },
  };
}
