# Modelos recomendados por tipo de proyecto

Los modelos GGUF se guardan en `models/`. Este mini-agente (y la plantilla)
usan **Ollama** o modelos locales. Recomendaciones por tamaño de equipo:

## Código web / Flask (recomendado)

| Modelo | RAM | Uso |
|---|---|---|
| `qwen2.5-coder:3b` | 4 GB | Proyecto pequeño/mediano |
| `qwen2.5-coder:7b` | 8 GB | Código de calidad, el mejor gratuito |
| `deepseek-coder:6.7b` | 8 GB | Alternativa completa |
| `codellama:7b-code` | 8 GB | Clásico de código |

## Equipos modestos (4 GB RAM o menos)

| Modelo | RAM | Uso |
|---|---|---|
| `qwen2.5-coder:1.5b` | 2 GB | Empezar a programar |
| `llama3.2:3b` | 4 GB | Generalista con razonamiento |
| `phi3:mini` | 4 GB | Razonamiento pequeño |

## Pruebas / CPU muy vieja

| Modelo | RAM | Uso |
|---|---|---|
| `smollm2:1.7b` | 2 GB | Chat ligero |
| `tinyllama:1.1b` | 1.5 GB | Pruebas rápidas |
| `qwen2.5-coder:0.5b` | 1 GB | Solo para verificar instalación |

## Descarga

Todos están en el catálogo del mini-agente (`catalog.py`) con su ruta de
descarga en `https://ollama.com/library/<nombre>`, o directo con:

```bat
ollama pull qwen2.5-coder:3b
```

Para usar un `.gguf` suelto: colócalo en `models/` y regístralo desde el
panel "Subir modelo" del mini-agente, o crea un Modelfile con
`FROM ./models/archivo.gguf`.
