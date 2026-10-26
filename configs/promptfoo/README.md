# Promptfoo evaluation configuration

Prepare configuration after the exact vLLM served model IDs and protected API endpoint are known. Promptfoo can connect to an OpenAI-compatible API with `openai:chat:<model-id>` and `apiBaseUrl`.

Official provider reference: https://www.promptfoo.dev/docs/providers/openai/

Do not hardcode API tokens or publish endpoints. Baseline and adapter versions must be evaluated against exactly the same frozen dataset.
