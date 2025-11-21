vim.filetype.add({
  filename = {
    [".env"] = "env",
  },
  pattern = {
    [".*%.env.*"] = "env",
  },
})
