import { useState, type FormEvent } from 'react';
import { auth, authMessage } from '../../lib/auth';

type Mode = 'login' | 'signup' | 'forgot' | 'reset' | 'verify';
const modes: Record<string, Mode> = {
  '/criar-conta': 'signup',
  '/recuperar-senha': 'forgot',
  '/redefinir-senha': 'reset',
  '/verificar-email': 'verify',
};
const titles: Record<Mode, string> = {
  login: 'Bom ter você de volta.',
  signup: 'Seu próximo treino começa aqui.',
  forgot: 'Vamos recuperar seu acesso.',
  reset: 'Uma nova senha. Um novo começo.',
  verify: 'Confirme seu email.',
};
const labels: Record<Mode, string> = {
  login: 'Entrar',
  signup: 'Criar conta',
  forgot: 'Enviar link de recuperação',
  reset: 'Salvar nova senha',
  verify: 'Reenviar confirmação',
};

export function AuthPage({ serviceError = false }: { serviceError?: boolean }) {
  const mode = modes[window.location.pathname] || 'login';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const token = new URLSearchParams(window.location.search).get('token');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    const values = new FormData(event.currentTarget);
    const email = String(values.get('email') || '').trim();
    const password = String(values.get('password') || '');
    try {
      if ((mode === 'reset' || mode === 'signup') && password !== values.get('confirm')) {
        setError('As senhas precisam ser iguais.');
        return;
      }
      if (mode === 'login') {
        const result = await auth.signIn.email({ email, password });
        if (result.error) {
          setError(authMessage(result.error.code));
          return;
        }
        window.location.assign('/app');
      } else if (mode === 'signup') {
        const result = await auth.signUp.email({
          email,
          password,
          name: String(values.get('name') || '').trim(),
          callbackURL: `${window.location.origin}/app`,
        });
        if (result.error) {
          setError(authMessage(result.error.code));
          return;
        }
        const session = await auth.getSession();
        if (session.data) window.location.assign('/app');
        else setNotice('Conta criada. Confira seu email para confirmar o cadastro e depois entre.');
      } else if (mode === 'forgot') {
        const result = await auth.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}/redefinir-senha`,
        });
        if (result.error) {
          setError('Não foi possível enviar o link. Tente novamente mais tarde.');
          return;
        }
        setNotice(
          'Se existir uma conta com esse email, você receberá um link para redefinir a senha.',
        );
      } else if (mode === 'verify') {
        const result = await auth.sendVerificationEmail({
          email,
          callbackURL: `${window.location.origin}/app`,
        });
        if (result.error) {
          setError('Não foi possível enviar a confirmação. Tente novamente mais tarde.');
          return;
        }
        setNotice('Se houver uma confirmação pendente, você receberá as instruções por email.');
      } else {
        if (!token) {
          setError('Abra o link recebido por email ou solicite um novo.');
          return;
        }
        const result = await auth.resetPassword({ token, newPassword: password });
        if (result.error) {
          setError(authMessage(result.error.code));
          return;
        }
        window.history.replaceState(null, '', '/redefinir-senha');
        setNotice('Senha atualizada. Você já pode entrar com sua nova senha.');
      }
    } catch {
      setError('Não foi possível conectar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  const showPassword = ['login', 'signup', 'reset'].includes(mode);
  return (
    <main className="auth-layout">
      <section className="auth-story" aria-label="GymLog">
        <a className="brand" href="/">
          GYM<span>LOG</span>
          <span className="brand-mark" aria-hidden="true">
            ▰
          </span>
        </a>
        <div className="story-content">
          <p className="eyebrow">SEU DIÁRIO DE TREINO</p>
          <h1>
            O esforço é seu.
            <br />
            <span>O registro fica.</span>
          </h1>
          <p>Treinos, cargas e evolução. Tudo no seu ritmo, em um só lugar.</p>
          <div className="training-lines" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <p className="story-footer">UM TREINO DE CADA VEZ.</p>
      </section>
      <section className="auth-panel" aria-labelledby="form-title">
        <div className="auth-form-wrap">
          <p className="eyebrow">{mode === 'login' ? 'SUA CONTA' : 'GYMLOG / ACESSO'}</p>
          <h2 id="form-title">{titles[mode]}</h2>
          <p className="form-intro">
            {mode === 'login'
              ? 'Entre para acessar seu espaço de treino.'
              : mode === 'signup'
                ? 'Crie sua conta para começar a organizar sua rotina.'
                : mode === 'reset'
                  ? 'Escolha uma senha com pelo menos 8 caracteres.'
                  : 'Informe o email usado no seu cadastro.'}
          </p>
          {serviceError && (
            <p className="message error" role="alert">
              Não foi possível consultar sua sessão. Tente novamente em instantes.
            </p>
          )}
          {notice ? (
            <div className="message success" role="status">
              <p>{notice}</p>
              <a href="/entrar">Ir para o login →</a>
            </div>
          ) : (
            <form onSubmit={submit} className="auth-form">
              {mode === 'signup' && (
                <label>
                  Como podemos te chamar?
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={120}
                    placeholder="Seu nome"
                  />
                </label>
              )}
              {mode !== 'reset' && (
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    placeholder="voce@exemplo.com"
                  />
                </label>
              )}
              {showPassword && (
                <label>
                  {mode === 'reset' ? 'Nova senha' : 'Senha'}
                  <input
                    name="password"
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={mode === 'login' ? undefined : 8}
                    maxLength={128}
                  />
                </label>
              )}
              {(mode === 'signup' || mode === 'reset') && (
                <label>
                  Confirme a senha
                  <input
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                  />
                </label>
              )}
              {mode === 'login' && (
                <a className="forgot-link" href="/recuperar-senha">
                  Esqueci minha senha
                </a>
              )}
              {error && (
                <p className="message error" role="alert">
                  {error}
                </p>
              )}
              {mode === 'reset' && !token && (
                <p className="message error" role="alert">
                  Link inválido ou expirado. <a href="/recuperar-senha">Solicitar outro link</a>
                </p>
              )}
              <button className="primary-button" disabled={busy || (mode === 'reset' && !token)}>
                {busy ? 'Aguarde…' : labels[mode]}
                <span aria-hidden="true">→</span>
              </button>
            </form>
          )}
          <nav className="auth-links" aria-label="Opções de acesso">
            {mode === 'login' ? (
              <>
                <p>
                  Ainda não tem conta? <a href="/criar-conta">Criar conta</a>
                </p>
                <a href="/verificar-email">Reenviar confirmação de email</a>
              </>
            ) : (
              <a href="/entrar">← Voltar para o login</a>
            )}
          </nav>
        </div>
      </section>
    </main>
  );
}
