require("avante_lib").load()
require("avante").setup({
  provider = "azure",
  cursor_applying_provider = "groq",
  behaviour = {
    enable_cursor_planning_mode = true,
  },
  openai = {
    endpoint = "https://api.openai.com/v1",
    api_key_name = "cmd:pass openai/token",
    model = "o4-mini",
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
    model = "o4-mini",
    deployment = "o4-mini",
    api_version = "2025-01-01-preview",
    timeout = 30000,
    temperature = 0,
    max_completion_tokens = 20480,
  },
  bedrock = {
    model = "us.anthropic.claude-sonnet-4-20250514-v1:0",
    api_key_name = { "zsh", "-c", "source ~/.config/zsh/zsh-functions; get_bedrock_creds isse-se-prod us-west-2" },
    timeout = 30000,
    temperature = 0,
    max_tokens = 20480,
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
  mappings = {
    diff = {
      theirs = "cu",
      ours = "cr",
    },
  },
})

-- Patch for borked borders https://github.com/yetone/avante.nvim/commit/86b63b2a33b4fa45431a35a541e7f02d4d3d523b#commitcomment-154265945
vim.api.nvim_set_hl(0, "AvanteSidebarWinSeparator", { link = "WinSeparator" })
local normal_bg = string.format("#%06x", vim.api.nvim_get_hl(0, { name = "Normal" }).bg)
vim.api.nvim_set_hl(0, "AvanteSidebarWinHorizontalSeparator", { fg = normal_bg })
