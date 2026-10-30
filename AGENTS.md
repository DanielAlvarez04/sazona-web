<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Atajos de teclado y tema

- **Registro único**: `lib/keyboard/shortcuts.ts` declara todos los atajos (`SHORTCUTS`: `id`, `label`, `description`, `group`, `combos`). Ningún componente debe comparar `event.key` por su cuenta.
- **Para agregar un atajo**: añadir el `id` a `ShortcutId`, su definición a `SHORTCUTS` y suscribirlo con `useShortcut("<id>", handler)` (`components/keyboard/keyboard-shortcuts-provider.tsx`).
- **Un solo listener**: `KeyboardShortcutsProvider` (montado en `app/layout.tsx`) instala el único `keydown` global; ignora campos de texto salvo que el atajo use Alt/Ctrl/⌘, respeta `defaultPrevented` y no repite con la tecla sostenida.
- **Comparación por `event.code`**: los atajos con Alt se comparan también contra el código físico de la tecla porque en macOS `⌥ L` produce `¬` en `event.key`.
- **Tema**: `next-themes` según la guía de shadcn — provider en `components/theme-provider.tsx` (props tal cual) configurado en `app/layout.tsx` con `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`, y `suppressHydrationWarning` en `<html>`. Las clases `dark:` dependen de `.dark` en `<html>` (definido en `app/globals.css`). El selector es `components/mode-toggle.tsx` (Claro / Oscuro / Sistema) y el atajo `theme.toggle` se conecta en `components/keyboard/theme-shortcut.tsx`. En componentes usar variantes `dark:` en lugar de `resolvedTheme` en el primer render, para evitar desajustes de hidratación.
