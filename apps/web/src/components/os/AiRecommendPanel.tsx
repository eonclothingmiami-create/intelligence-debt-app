'use client';

import { useEffect, useState } from 'react';
import type { AiFinancialRecommendation } from '@/lib/aiRecommend';
import {
  clearStoredOpenAiKey,
  getStoredOpenAiKey,
  maskOpenAiKey,
  setStoredOpenAiKey,
} from '@/lib/openaiKey';

type Props = {
  recommendation: AiFinancialRecommendation | null;
  pending: boolean;
  connected: boolean;
  onConnectedChange: (connected: boolean) => void;
  onGenerate: () => void;
  disabledGenerate?: boolean;
};

/**
 * Module to connect the user's OpenAI account (API key) and request one CFO recommendation.
 * Not a chat. Key never goes into engines — only to the recommend backend.
 */
export function AiRecommendPanel({
  recommendation,
  pending,
  connected,
  onConnectedChange,
  onGenerate,
  disabledGenerate,
}: Props) {
  const [draftKey, setDraftKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savedMask, setSavedMask] = useState('');

  useEffect(() => {
    const existing = getStoredOpenAiKey();
    if (existing) {
      setSavedMask(maskOpenAiKey(existing));
      onConnectedChange(true);
    } else {
      setSavedMask('');
      onConnectedChange(false);
    }
  }, [onConnectedChange]);

  function saveKey() {
    if (!draftKey.trim().startsWith('sk-')) {
      return;
    }
    setStoredOpenAiKey(draftKey);
    setSavedMask(maskOpenAiKey(draftKey));
    setDraftKey('');
    onConnectedChange(true);
  }

  function disconnect() {
    clearStoredOpenAiKey();
    setSavedMask('');
    setDraftKey('');
    onConnectedChange(false);
  }

  return (
    <section className="space-y-4">
      <div className="panel rounded-2xl p-4 md:p-6">
        <h2 className="brand-mark text-2xl text-forest">CFO AI — OpenAI</h2>
        <p className="mt-1 text-sm text-muted">
          Conecta tu cuenta de OpenAI (API key) y solicita una recomendación. No es un chat: los
          motores del OS calculan; OpenAI solo interpreta.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[var(--line)] bg-white/50 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
              1. Conectar OpenAI
            </h3>
            {connected ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-forest">
                  Conectado · <span className="metric">{savedMask}</span>
                </p>
                <p className="text-xs text-muted">
                  La key se guarda solo en esta sesión del navegador (sessionStorage) y se envía al
                  backend por solicitud. No se guarda en el ERP ni en motores.
                </p>
                <button
                  type="button"
                  className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium"
                  onClick={disconnect}
                >
                  Desconectar
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-muted">
                  Crea una key en{' '}
                  <a
                    className="underline"
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noreferrer"
                  >
                    platform.openai.com/api-keys
                  </a>{' '}
                  y pégala aquí (empieza con sk-).
                </p>
                <label className="block text-sm">
                  API key
                  <input
                    type={showKey ? 'text' : 'password'}
                    className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
                    placeholder="sk-..."
                    value={draftKey}
                    onChange={(e) => setDraftKey(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={showKey}
                    onChange={(e) => setShowKey(e.target.checked)}
                  />
                  Mostrar key
                </label>
                <button
                  type="button"
                  className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist disabled:opacity-50"
                  disabled={!draftKey.trim().startsWith('sk-')}
                  onClick={saveKey}
                >
                  Guardar y conectar
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-white/50 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
              2. Solicitar recomendación
            </h3>
            <p className="mt-2 text-sm text-muted">
              El sistema arma el contexto (ventas, BEP, liquidez, deudas, costos, ads, score) y el
              backend llama a OpenAI.
            </p>
            <button
              type="button"
              disabled={pending || disabledGenerate || !connected}
              onClick={onGenerate}
              className="mt-4 rounded-full bg-moss px-4 py-2 text-sm font-semibold text-mist disabled:opacity-50"
            >
              {pending ? 'Generando…' : 'Generar recomendación'}
            </button>
            {!connected ? (
              <p className="mt-3 text-xs text-danger">Conecta tu API key de OpenAI primero.</p>
            ) : null}
            {disabledGenerate ? (
              <p className="mt-3 text-xs text-muted">
                Carga el tablero (demo / BEP) antes de generar.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {recommendation ? (
        <div className="panel rounded-2xl p-4 md:p-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
            Recomendación CFO
          </h3>
          <p className="mt-2 text-xs text-muted">Confianza: {recommendation.confidenceLevel}</p>
          <div className="mt-4 space-y-4 text-sm">
            <Block title="Resumen ejecutivo" body={recommendation.executiveSummary} />
            <Block title="Situación actual" body={recommendation.currentSituation} />
            <List title="Fortalezas" items={recommendation.strengths} />
            <List title="Riesgos detectados" items={recommendation.risks} />
            <List title="Recomendaciones" items={recommendation.recommendations} />
            <Block title="Justificación" body={recommendation.justification} />
            <Block title="Impacto esperado" body={recommendation.expectedImpact} />
            {recommendation.missingInformation.length ? (
              <List title="Información faltante" items={recommendation.missingInformation} danger />
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="font-semibold text-forest">{title}</p>
      <p className="mt-1 text-ink/90">{body}</p>
    </div>
  );
}

function List({ title, items, danger }: { title: string; items: string[]; danger?: boolean }) {
  return (
    <div>
      <p className={`font-semibold ${danger ? 'text-danger' : 'text-forest'}`}>{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-ink/90">
        {items.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
