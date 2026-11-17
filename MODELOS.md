# Catálogo de modelos

Todos los modelos gratuitos del mini-agente, con su **ruta oficial de
descarga** (registro de Ollama) y los que puedes guardar localmente en la
carpeta `models/` de este proyecto.

| Modelo | Tamaño | RAM min. | Descarga |
|---|---|---|---|
| qwen2.5-coder:0.5b | 0.4 GB | 1 GB | https://ollama.com/library/qwen2.5-coder:0.5b |
| smollm2:135m | 0.1 GB | 0.5 GB | https://ollama.com/library/smollm2:135m |
| smollm2:360m | 0.2 GB | 0.5 GB | https://ollama.com/library/smollm2:360m |
| smollm2:1.7b | 1.0 GB | 2 GB | https://ollama.com/library/smollm2:1.7b |
| tinyllama:1.1b | 0.6 GB | 1.5 GB | https://ollama.com/library/tinyllama:1.1b |
| llama3.2:1b | 0.8 GB | 2 GB | https://ollama.com/library/llama3.2:1b |
| llama3.2:3b | 2.0 GB | 4 GB | https://ollama.com/library/llama3.2:3b |
| qwen2.5-coder:1.5b | 1.0 GB | 2 GB | https://ollama.com/library/qwen2.5-coder:1.5b |
| qwen2.5-coder:3b | 1.9 GB | 4 GB | https://ollama.com/library/qwen2.5-coder:3b |
| qwen2.5-coder:7b | 4.7 GB | 8 GB | https://ollama.com/library/qwen2.5-coder:7b |
| deepseek-coder:1.3b | 0.8 GB | 2 GB | https://ollama.com/library/deepseek-coder:1.3b |
| deepseek-coder:6.7b | 3.8 GB | 8 GB | https://ollama.com/library/deepseek-coder:6.7b |
| starcoder2:3b | 1.7 GB | 4 GB | https://ollama.com/library/starcoder2:3b |
| starcoder2:7b | 4.1 GB | 8 GB | https://ollama.com/library/starcoder2:7b |
| codegemma:2b | 1.6 GB | 4 GB | https://ollama.com/library/codegemma:2b |
| gemma2:2b | 1.6 GB | 4 GB | https://ollama.com/library/gemma2:2b |
| phi3:mini | 2.3 GB | 4 GB | https://ollama.com/library/phi3:mini |
| codellama:7b-code | 3.8 GB | 8 GB | https://ollama.com/library/codellama:7b-code |

## Cómo usar

- **Desde el panel** "Catálogo gratuito" del mini-agente: el botón de
  descarga hace `ollama pull <nombre>`.
- **Manual**: `ollama pull qwen2.5-coder:3b`
- **GGUF suelto**: guárdalo en `models/` y súbelo desde "Subir modelo
  (.gguf)", o crea un Modelfile con `FROM ./models/archivo.gguf`.

Recomendación por equipo: con 8 GB de RAM usa `qwen2.5-coder:7b`; con 4 GB,
`qwen2.5-coder:3b` o `llama3.2:3b`; con menos, `qwen2.5-coder:1.5b`.
