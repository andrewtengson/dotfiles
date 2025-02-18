require("chatgpt").setup({
  api_key_cmd = "pass openai/token",
  openai_params = {
    model = "o1-mini",
    frequency_penalty = 0,
    presence_penalty = 0,
    max_tokens = 8192,
    temperature = 0,
    top_p = 1,
    n = 1,
  },
  chat = {
    sessions_window = {
      active_sign = " 󰄮 ",
      inactive_sign = " 󰄱 ",
    },
  },
})
