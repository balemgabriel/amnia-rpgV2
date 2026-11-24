import { useEffect, useState } from 'react'
import { ClipboardCopy, Loader2 } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Badge, Button, Callout, Card, Field, TextArea } from '@/components/ui'
import type { Character } from '@/rules/character'
import {
  createSheetCode,
  instantiateImportedCharacter,
  readSheetCode,
} from '@/rules/sheetCode'

type CommonProps = {
  open: boolean
  onClose: () => void
}

export type SheetCodeDialogProps = CommonProps &
  (
    | { mode: 'export'; character: Character }
    | {
        mode: 'import'
        /** Recebe a ficha já validada; quem chama decide onde vai salvá-la. */
        onImport: (character: Character) => Promise<void> | void
        title?: string
        description?: string
        actionLabel?: string
      }
  )

/** Janela única para copiar o código de uma ficha ou colar um código recebido. */
export function SheetCodeDialog(props: SheetCodeDialogProps) {
  if (!props.open) return null
  return props.mode === 'export' ? <ExportCode {...props} /> : <ImportCode {...props} />
}

function ExportCode({ character, onClose }: { character: Character; onClose: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true
    createSheetCode(character)
      .then((value) => {
        if (active) setCode(value)
      })
      .catch(() => {
        if (active) setError('Não foi possível gerar o código desta ficha.')
      })
    return () => {
      active = false
    }
  }, [character])

  async function handleCopy() {
    if (!code) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code)
        setCopied(true)
        setError(null)
        return
      }
    } catch {
      // Navegadores sem permissão de clipboard caem no fallback abaixo.
    }

    const textarea = document.getElementById('sheet-export-code') as HTMLTextAreaElement | null
    if (!textarea) return
    textarea.focus()
    textarea.select()
    const ok = document.execCommand('copy')
    if (ok) {
      setCopied(true)
      setError(null)
    } else {
      setError('Não foi possível copiar automaticamente. Selecione o código e copie à mão.')
    }
  }

  return (
    <Modal open onClose={onClose} label="Código da ficha" className="max-w-2xl">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl tracking-wide">Código da ficha</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Copie e envie este código. Quem receber pode colar em <strong>Importar ficha</strong>{' '}
              para ter uma cópia completa em outro dispositivo.
            </p>
          </div>
          <Button variant="quiet" onClick={onClose} className="px-2" aria-label="Fechar">
            ✕
          </Button>
        </div>

        <div className="mt-5">
          <Field
            label="Código para compartilhar"
            htmlFor="sheet-export-code"
            hint="Inclui atributos, perícias, runas, magias, XP, inventário e retrato."
          >
            <TextArea
              id="sheet-export-code"
              readOnly
              rows={8}
              value={code || 'Gerando código…'}
              onFocus={(event) => event.target.select()}
              className="break-all font-mono text-xs"
            />
          </Field>
        </div>

        {error ? (
          <div className="mt-4">
            <Callout tone="warn">{error}</Callout>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-soft">
            {copied
              ? 'Código copiado para a área de transferência.'
              : `${character.name || 'Sem nome'} · ${code.length.toLocaleString('pt-BR')} caracteres`}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Fechar
            </Button>
            <Button onClick={() => void handleCopy()} disabled={!code}>
              <ClipboardCopy className="size-4" aria-hidden />
              {copied ? 'Copiado!' : 'Copiar código'}
            </Button>
          </div>
        </div>
      </Card>
    </Modal>
  )
}

function ImportCode({
  onClose,
  onImport,
  title = 'Importar ficha',
  description = 'Cole o código recebido. A ficha completa será copiada para este dispositivo.',
  actionLabel = 'Importar ficha',
}: {
  onClose: () => void
  onImport: (character: Character) => Promise<void> | void
  title?: string
  description?: string
  actionLabel?: string
}) {
  const [value, setValue] = useState('')
  const [preview, setPreview] = useState<Character | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleRead() {
    setBusy(true)
    setError(null)
    setPreview(null)
    try {
      const payload = await readSheetCode(value)
      setPreview(instantiateImportedCharacter(payload))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível ler o código.')
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    if (!preview) return
    setBusy(true)
    setError(null)
    try {
      await onImport(preview)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível importar a ficha.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} label={title} className="max-w-2xl">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl tracking-wide">{title}</h2>
            <p className="mt-1 text-sm text-ink-soft">{description}</p>
          </div>
          <Button variant="quiet" onClick={onClose} className="px-2" aria-label="Fechar">
            ✕
          </Button>
        </div>

        <div className="mt-5">
          <Field label="Código da ficha" htmlFor="sheet-import-code">
            <TextArea
              id="sheet-import-code"
              rows={7}
              value={value}
              placeholder="AMNIA1-Z..."
              onChange={(event) => {
                setValue(event.target.value)
                setPreview(null)
                setError(null)
              }}
              className="break-all font-mono text-xs"
            />
          </Field>
        </div>

        {error ? (
          <div className="mt-4">
            <Callout tone="warn">{error}</Callout>
          </div>
        ) : null}

        {preview ? (
          <div className="mt-4 rounded-lg border border-gold/40 bg-gold/5 p-4">
            <p className="font-display text-xl leading-tight">{preview.name || 'Sem nome'}</p>
            <p className="mt-0.5 text-sm text-ink-soft">
              {[preview.concept, preview.age ? `${preview.age} anos` : '']
                .filter(Boolean)
                .join(' · ') || 'Sem conceito'}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="gold">{preview.spells.length} magias</Badge>
              <Badge>{preview.knownRunes.length} runas</Badge>
              <Badge>{preview.advantages.length} vantagens/desvantagens</Badge>
              <Badge>{preview.xpPurchases.length} compras de XP</Badge>
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          {preview ? (
            <Button onClick={() => void handleImport()} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {actionLabel}
            </Button>
          ) : (
            <Button onClick={() => void handleRead()} disabled={!value.trim() || busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Ler código
            </Button>
          )}
        </div>
      </Card>
    </Modal>
  )
}
