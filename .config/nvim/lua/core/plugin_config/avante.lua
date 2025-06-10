require("avante_lib").load()
require("avante").setup({
  provider = "bedrock",
  cursor_applying_provider = "groq",
  behaviour = {
    enable_cursor_planning_mode = true,
  },
  providers = {
    openai = {
      endpoint = "https://api.openai.com/v1",
      api_key_name = "cmd:pass openai/token",
      model = "o4-mini",
      timeout = 30000,
      extra_request_body = {
        temperature = 0,
        max_completion_tokens = 8000,
      },
    },
    claude = {
      endpoint = "https://api.anthropic.com",
      api_key_name = "cmd:pass anthropic/token",
      model = "claude-3-7-sonnet-latest",
      timeout = 30000,
      extra_request_body = {
        temperature = 0,
        max_tokens = 8000,
      },
    },
    azure = {
      endpoint = "https://isse-sre-east-us-2.openai.azure.com",
      api_key_name = "cmd:pass azure-ai/isse-sre-east-us-2/token",
      model = "o4-mini",
      deployment = "o4-mini",
      api_version = "2025-01-01-preview",
      timeout = 30000,
      extra_request_body = {
        temperature = 0,
        max_completion_tokens = 8000,
      },
    },
    bedrock = {
      model = "apac.anthropic.claude-sonnet-4-20250514-v1:0",
      aws_profile = "isse-se-prod",
      aws_region = "ap-southeast-1",
      timeout = 30000,
      extra_request_body = {
        temperature = 0,
        max_tokens = 8000,
      },
    },
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
      extra_request_body = {
        max_tokens = 32768,
      },
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
  web_search_engine = {
    provider = "brave",
    providers = {
      brave = {
        api_key_name = "cmd:pass brave-search/token",
      },
    },
  },
  input = {
    provider = "dressing",
  },
})

-- Patch for borked borders https://github.com/yetone/avante.nvim/commit/86b63b2a33b4fa45431a35a541e7f02d4d3d523b#commitcomment-154265945
vim.api.nvim_set_hl(0, "AvanteSidebarWinSeparator", { link = "WinSeparator" })
local normal_bg = string.format("#%06x", vim.api.nvim_get_hl(0, { name = "Normal" }).bg)
vim.api.nvim_set_hl(0, "AvanteSidebarWinHorizontalSeparator", { fg = normal_bg })
