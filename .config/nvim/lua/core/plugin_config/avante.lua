require("avante_lib").load()
require("avante").setup({
  provider = "claude",
  cursor_applying_provider = "groq",
  behaviour = {
    enable_cursor_planning_mode = true,
  },
  openai = {
    endpoint = "https://api.openai.com/v1",
    api_key_name = "cmd:pass openai/token",
    model = "o3-mini",
    timeout = 30000,
    temperature = 0,
    max_completion_tokens = 20480,
  },
  claude = {
    endpoint = "https://api.anthropic.com",
    api_key_name = "cmd:pass anthropic/token",
    model = "claude-3-7-sonnet-latest",
    timeout = 30000,
    temperature = 0,
    max_tokens = 20480,
  },
  azure = {
    endpoint = "https://isse-sre-east-us-2.openai.azure.com",
    api_key_name = "cmd:pass azure-ai/isse-sre-east-us-2/token",
    model = "o3-mini",
    deployment = "o3-mini",
    api_version = "2024-12-01-preview",
    timeout = 30000,
    temperature = 0,
    max_completion_tokens = 20480,
  },
  vendors = {
    deepseek = {
      __inherited_from = "openai",
      api_key_name = "cmd:pass deepseek/token",
      endpoint = "https://api.deepseek.com",
      model = "deepseek-reasoner",
    },
    groq = {
      __inherited_from = "openai",
      api_key_name = "cmd:pass groq/token",
      endpoint = "https://api.groq.com/openai/v1/",
      model = "llama-3.3-70b-versatile",
      max_tokens = 32768,
    },
  },
  hints = {
    enabled = false,
  },
})
