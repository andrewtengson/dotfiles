require("avante_lib").load()
require("avante").setup({
  provider = "openai",
  openai = {
    endpoint = "https://api.openai.com/v1",
    api_key_name = "cmd:pass openai/token",
    model = "o1-mini",
    timeout = 30000,
    temperature = 0,
    max_tokens = 8000,
    disable_tools = true,
  },
  claude = {
    endpoint = "https://api.anthropic.com",
    api_key_name = "cmd:pass anthropic/token",
    model = "claude-3-5-sonnet-20241022",
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
