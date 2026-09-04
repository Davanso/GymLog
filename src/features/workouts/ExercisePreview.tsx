import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Detail = {
  name: string;
  imageUrl: string | null;
  imageUrls: Record<string, string>;
  videoUrl: string | null;
  instructions: string[];
};

export function ExercisePreview({
  externalId,
  name,
  imageUrl,
  videoUrl,
}: {
  externalId: string;
  name: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    if (detail) return;
    const controller = new AbortController();
    fetch(`/api/catalog?resource=exercise&id=${encodeURIComponent(externalId)}`, {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setDetail(body.data);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason.message || 'Não foi possível abrir a mídia.');
      });
    return () => controller.abort();
  }, [detail, externalId, open]);
  const displayVideo = detail?.videoUrl || videoUrl;
  const displayImage =
    detail?.imageUrl || (detail && Object.values(detail.imageUrls)[0]) || imageUrl;
  return (
    <>
      <button type="button" className="text-button preview-button" onClick={() => setOpen(true)}>
        Ver execução
      </button>
      {open &&
        createPortal(
          <dialog ref={dialog} className="exercise-preview" onCancel={() => setOpen(false)}>
            <div className="exercise-preview__heading">
              <div>
                <p className="eyebrow">COMO EXECUTAR</p>
                <h2>{name}</h2>
              </div>
              <button type="button" className="secondary-button" onClick={() => setOpen(false)}>
                Fechar
              </button>
            </div>
            {!detail && !error && !displayVideo && !displayImage && (
              <p role="status">Buscando demonstração…</p>
            )}
            {error && !displayVideo && !displayImage && (
              <p className="message error" role="alert">
                {error}
              </p>
            )}
            {displayVideo ? (
              <figure>
                <video controls playsInline poster={displayImage || undefined} src={displayVideo} />
                <figcaption>Vídeo demonstrativo da execução do exercício.</figcaption>
              </figure>
            ) : displayImage ? (
              <figure>
                <img src={displayImage} alt={`Execução de ${name}`} />
                <figcaption>Imagem demonstrativa da posição e do movimento.</figcaption>
              </figure>
            ) : (
              detail && <p className="muted">Este exercício não possui mídia no catálogo.</p>
            )}
          </dialog>,
          document.body,
        )}
    </>
  );
}
