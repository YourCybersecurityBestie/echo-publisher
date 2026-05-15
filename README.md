# echo-publisher

Azure Functions app (Node.js 20, TypeScript, v4 model) on **Flex Consumption**. Synthesizes SSML to MP3 using Azure AI Speech, publishes to a per-user RSS feed in Blob Storage, and exposes a catalog endpoint for the cross-cloud Bedrock Q&A agent.

Part of the [Echo](https://github.com/YourCybersecurityBestie/echo) project.

## Endpoints

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/synthesize` | function key | SSML → MP3 in user blob, returns URL + duration |
| POST | `/api/episodes` | function key | Append item to user RSS feed + catalog |
| GET | `/api/episodes` | function key | List recent episodes |
| GET | `/api/catalog` | function key | Catalog snapshot (consumed by Bedrock Lambda) |
| GET | `/api/openapi.json` | anonymous | OpenAPI 3.0 spec (consumed by M365 plugin) |
| GET | `/api/docs` | anonymous | Swagger UI |

## Local dev

```pwsh
cp local.settings.json.template local.settings.json
# paste APPLICATIONINSIGHTS_CONNECTION_STRING from `az deployment sub show --name echo-prod-init --query properties.outputs`
npm install
npm start
```

You also need:
- Azurite running locally (`azurite --silent --location azurite-data`) OR a real storage account you can hit with `az login` identity.
- The `speech-key` secret populated in Key Vault `kv-echo-prod-ech01`. From a machine that has been granted `Key Vault Secrets Officer`:
  ```pwsh
  $key = az cognitiveservices account keys list -n spch-echo-prod -g rg-echo-prod --query key1 -o tsv
  az keyvault secret set --vault-name kv-echo-prod-ech01 --name speech-key --value $key
  ```

## Deploy

Infra is deployed from the parent [`echo`](https://github.com/YourCybersecurityBestie/echo) repo (`infra/main.bicep`). This repo just publishes code to the existing Function App.

```pwsh
npm run build
func azure functionapp publish func-echo-publisher --typescript
```

Or via the included GitHub Actions workflow (`.github/workflows/deploy.yml`) on push to `main`. Set repo secret `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`.

## Notes

- All blob and Key Vault access uses `DefaultAzureCredential`. Production uses the Function App's system-assigned managed identity, which is granted `Storage Blob Data Contributor`, `Cognitive Services Speech User`, and `Key Vault Secrets User` by the Bicep.
- `@ffprobe-installer/ffprobe` ships an ffprobe binary for Linux/x64 that runs fine in Flex Consumption. Do not switch to `music-metadata` — it returns 0 duration for some HD voice MP3s.
- App Insights custom event `EchoEpisodePublished` includes `episodeId`, `userSlug`, and `durationMs` dimensions on every publish.
