# VibeFID Bot Setup

Bot que responde automaticamente quando mencionado com perguntas sobre Neynar Score.

## 1. Criar conta Farcaster para o bot

Crie uma nova conta Farcaster (ex: @vibefid-bot ou @vibefid)

## 2. Criar Signer no Neynar

1. Vá para https://dev.neynar.com/
2. Faça login e vá para "Signers"
3. Crie um novo signer para a conta do bot
4. Copie o `signer_uuid`

## 3. Adicionar variáveis de ambiente

Adicione no `.env.local` e no Vercel:

```
BOT_SIGNER_UUID=seu_signer_uuid_aqui
```

## 4. Registrar Webhook no Neynar

```bash
curl -X POST "https://api.neynar.com/v2/farcaster/webhook" \
  -H "Content-Type: application/json" \
  -H "api_key: YOUR_NEYNAR_API_KEY" \
  -d '{
    "name": "VibeFID Bot",
    "url": "https://vibefid.xyz/api/bot/webhook",
    "subscription": {
      "cast.created": {
        "mentioned_fids": [BOT_FID_AQUI]
      }
    }
  }'
```

Substitua:
- `YOUR_NEYNAR_API_KEY` pela sua API key
- `BOT_FID_AQUI` pelo FID da conta do bot

## 5. Testar

Mencione o bot em um cast:
```
@vibefid what is my neynar score?
```

O bot deve responder com o GIF do seu score!

## Triggers suportados

- "what is my neynar score"
- "what's my neynar score"
- "my neynar score"
- "check my score"
- "neynar score"
- "my score"
- "score?"

## Endpoint

- **Webhook:** `POST https://vibefid.xyz/api/bot/webhook`
- **Health check:** `GET https://vibefid.xyz/api/bot/webhook`
