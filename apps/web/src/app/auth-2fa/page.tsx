'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTrace } from '@/context/TraceContext';

interface Generate2FAResponse {
  otpauthUrl: string;
}

interface TurnOn2FAResponse {
  message: string;
}

export default function TwoFactorAuthPage() {
  const { sendRequest, logs } = useTrace();

  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [turnOnMessage, setTurnOnMessage] = useState<string | null>(null);

  const lastAuthLog = logs.find((l) => l.endpoint.startsWith('/auth/2fa'));

  // 1. POST /auth/2fa/generate (без body, userId мокается на бэке как 'user-1')
  const handleGenerate = async () => {
    setTurnOnMessage(null);
    setCode('');

    const res = await sendRequest<Generate2FAResponse>('POST', '/auth/2fa/generate');
    if (res?.otpauthUrl) {
      setOtpauthUrl(res.otpauthUrl);
    }
  };

  // 2. POST /auth/2fa/turn-on (передаем строго { code })
  const handleTurnOn = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (code.length < 6) return;

    const res = await sendRequest<TurnOn2FAResponse>('POST', '/auth/2fa/turn-on', {
      code,
    });

    if (res?.message) {
      setTurnOnMessage(res.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-rose-400">
          Двухфакторная авторизация (2FA / TOTP)
        </h1>
        <p className="text-xs text-slate-400">
          Тестирование контроллера <code>TwoFactorAuthController</code> (пользователь по умолчанию: <code>user-1</code>).
        </p>
      </div>

      {/* Вывод ошибок (например, 400 BadRequestException или 401 UnauthorizedException) */}
      {lastAuthLog?.status === 'ERROR' && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-xs text-rose-300 font-mono">
          {lastAuthLog.errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Шаг 1: Генерация QR-кода */}
        <section className="border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-800">
            1. Генерация секрета (<code>POST /auth/2fa/generate</code>)
          </h2>
          <p className="text-xs text-slate-700">
            Создает секрет для <code>user-1</code> и возвращает <code>otpauthUrl</code>. Отсканируйте QR-код в Google Authenticator или Authy.
          </p>

          <button
            onClick={handleGenerate}
            className="bg-rose-600 hover:bg-rose-500 px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            Сгенерировать QR-код
          </button>

          {otpauthUrl && (
            <div className="pt-4 border-t border-slate-800 space-y-4">
              <div className="bg-white p-4 rounded-xl w-fit mx-auto shadow-lg">
                <QRCodeSVG value={otpauthUrl} size={180} level="M" />
              </div>

              <div className="text-[11px] p-2.5 rounded-lg border border-slate-800 break-all font-mono text-slate-700">
                {otpauthUrl}
              </div>
            </div>
          )}
        </section>

        {/* Шаг 2: Подтверждение и включение 2FA */}
        <section className="border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-800">
            2. Активация 2FA (<code>POST /auth/2fa/turn-on</code>)
          </h2>
          <p className="text-xs text-slate-700">
            Введите 6-значный код из приложения. Бэкенд проверит его через <code>verifyCode</code> и активирует 2FA.
          </p>

          <form onSubmit={handleTurnOn} className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-36 border border-slate-700 rounded-lg px-3 py-2 text-center text-lg font-mono tracking-widest focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={code.length < 6}
              className="bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 px-5 py-2 rounded-lg text-emerald-100 text-sm font-medium transition"
            >
              Включить 2FA
            </button>
          </form>

          {turnOnMessage && (
            <div className="p-3 border border-emerald-800 rounded-lg text-xs text-emerald-800 font-medium">
              ✓ {turnOnMessage}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
