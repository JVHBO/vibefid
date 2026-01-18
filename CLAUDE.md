# VibeFID - Regras do Projeto

## OpenSea Metadata Refresh

Quando precisar forçar atualização de metadata no OpenSea (especialmente para NFTs que mostram imagem errada ou placeholder), usar o **refresh agressivo** com múltiplas requisições paralelas:

```javascript
// Refresh agressivo - 20 requisições paralelas
const tokenId = FID_AQUI;
const contract = "0x60274A138d026E3cB337B40567100FdEC3127565";
const apiKey = "7805aa61f1a04c90ab1e4a274af51617";

const refreshPromises = Array(20).fill(null).map(() =>
  fetch(`https://api.opensea.io/api/v2/chain/base/contract/${contract}/nfts/${tokenId}/refresh`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey }
  })
);

await Promise.all(refreshPromises);
```

**Por que usar refresh agressivo:**
- OpenSea tem cache muito forte
- Uma única requisição frequentemente não é suficiente
- Múltiplas requisições paralelas forçam o cache a invalidar
- Usar 15-30 requisições para NFTs problemáticos

## Reimport de Cards Órfãos

Quando um card é mintado on-chain mas falha em salvar no Convex:

1. Usar o script `reimport-card.js` para coletar dados do Neynar + Alchemy
2. Executar mutation `farcasterCards:reimportCard` no Convex
3. Regenerar imagens em `/admin/regenerate`
4. Usar refresh agressivo do OpenSea (acima)

## Contrato VibeFID

- **Endereço:** `0x60274A138d026E3cB337B40567100FdEC3127565`
- **Rede:** Base Mainnet
- **Token ID = FID** (sempre igual)
