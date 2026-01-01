# Bugs Conhecidos - VibeFID

## Bug: Flash Preto no Loop de Vídeos

**Status:** Parcialmente resolvido

**Causa raiz:** 
Vídeos WebM gerados pelo `MediaRecorder` do browser não têm `duration` no metadata. Browsers precisam dessa info pra fazer loop seamless.

**Diagnóstico:**
```bash
ffprobe -v error -show_format VIDEO_URL 2>&1 | grep duration
```
- `duration=N/A` → pisca ❌
- `duration=2.xxx` → ok ✅

**Exemplos verificados:**
- FID 1390489 (iadmitnothing) → SEM duration → pisca
- FID 521180 (bekordi) → COM duration → ok

**Fix implementado (novos vídeos):**
- Arquivo: `lib/generateCardVideo.ts`
- Lib: `fix-webm-duration`
- Novos vídeos terão metadata correto automaticamente

**Pendente:**
- [ ] Rodar scan completo nos ~450 vídeos (scan parcial: ~35 de 100 com problema)
- [ ] Decidir se faz script pra remuxar os antigos ou deixa quieto

**Data:** 2025-12-31
