/**
 * Fichas prontas vindas de códigos compartilhados.
 *
 * Para adicionar uma ficha: abra a ficha no app, use o botão **Código** →
 * **Copiar código** e cole o resultado aqui. O `id` deve ser curto, estável e
 * em kebab-case — ele vira o `referenceId` da ficha e é o que o botão
 * "Resetar ao padrão" usa para restaurar o conteúdo original do código.
 *
 * Exemplo:
 *
 * ```ts
 * export const readySheetCodes: ReadySheetCode[] = [
 *   { id: 'balatrino-exemplo', code: 'AMNIA1-Z....' },
 * ]
 * ```
 */
export interface ReadySheetCode {
  id: string
  code: string
}

export const readySheetCodes: ReadySheetCode[] = []
