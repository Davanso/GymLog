import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters';

// Same-origin proxy: no provider credentials or database URL in the browser.
export const auth = createAuthClient(`${window.location.origin}/api/auth`, {
  adapter: BetterAuthReactAdapter(),
});

export function authMessage(code?: string) {
  const messages: Record<string, string> = {
    INVALID_EMAIL_OR_PASSWORD: 'Email ou senha incorretos.',
    EMAIL_NOT_VERIFIED: 'Confirme seu email antes de entrar.',
    USER_ALREADY_EXISTS: 'Não foi possível criar a conta. Tente entrar ou recuperar sua senha.',
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
      'Não foi possível criar a conta. Tente entrar ou recuperar sua senha.',
    PASSWORD_TOO_SHORT: 'Use uma senha com pelo menos 8 caracteres.',
    INVALID_TOKEN: 'Este link é inválido ou expirou. Solicite um novo.',
    TOO_MANY_REQUESTS: 'Muitas tentativas. Aguarde um pouco e tente novamente.',
  };
  return messages[code || ''] || 'Não foi possível concluir. Confira os dados e tente novamente.';
}
