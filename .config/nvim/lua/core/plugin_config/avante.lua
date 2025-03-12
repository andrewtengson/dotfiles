require("avante_lib").load()
require("avante").setup({
  provider = "claude",
  openai = {
    endpoint = "https://api.openai.com/v1",
    api_key_name = "cmd:pass openai/token",
    model = "o3-mini",
    timeout = 30000,
    temperature = 0,
    max_tokens = 8000,
    disable_tools = true,
  },
  claude = {
    endpoint = "https://api.anthropic.com",
    api_key_name = "cmd:pass anthropic/token",
    model = "claude-3-7-sonnet-latest",
    timeout = 30000,
    temperature = 0,
    max_tokens = 8000,
  },
  azure = {
    endpoint = "https://isse-sre-east-us-2.openai.azure.com",
    api_key_name = "cmd:pass azure-ai/isse-sre-east-us-2/token",
    model = "o3-mini",
    deployment = "o3-mini",
    api_version = "2024-12-01-preview",
    timeout = 30000,
    temperature = 0,
    max_tokens = 8000,
  },
  vendors = {
    deepseek = {
      __inherited_from = "openai",
      api_key_name = "cmd:pass deepseek/token",
      endpoint = "https://api.deepseek.com",
      model = "deepseek-reasoner",
    },
  },
  hints = {
    enabled = false,
  },
})
