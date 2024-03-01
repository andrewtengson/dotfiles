require("gitsigns").setup({
  signs = {
    add = { hl = "GitSignsAdd", text = "▎", numhl = "GitSignsAddNr", linehl = "GitSignsAddLn" },
    change = { hl = "GitSignsChange", text = "▎", numhl = "GitSignsChangeNr", linehl = "GitSignsChangeLn" },
    delete = { hl = "GitSignsDelete", text = "_", numhl = "GitSignsDeleteNr", linehl = "GitSignsDeleteLn" },
    topdelete = { hl = "GitSignsDelete", text = "_", numhl = "GitSignsDeleteNr", linehl = "GitSignsDeleteLn" },
    changedelete = { hl = "GitSignsChange", text = "▎", numhl = "GitSignsChangeNr", linehl = "GitSignsChangeLn" },
  },
  signcolumn = true, -- Toggle with `:Gitsigns toggle_signs`
  numhl = false, -- Toggle with `:Gitsigns toggle_numhl`
  linehl = false, -- Toggle with `:Gitsigns toggle_linehl`
  word_diff = false, -- Toggle with `:Gitsigns toggle_word_diff`
  watch_gitdir = {
    interval = 1000,
    follow_files = true,
  },
  attach_to_untracked = true,
  current_line_blame = false, -- Toggle with `:Gitsigns toggle_current_line_blame`
  current_line_blame_opts = {
    virt_text = true,
    virt_text_pos = "eol", -- 'eol' | 'overlay' | 'right_align'
    delay = 1000,
    ignore_whitespace = false,
  },
  current_line_blame_formatter_opts = {
    relative_time = false,
  },
  sign_priority = 6,
  update_debounce = 100,
  status_formatter = nil, -- Use default
  max_file_length = 40000,
  preview_config = {
    -- Options passed to nvim_open_win
    border = "single",
    style = "minimal",
    relative = "cursor",
    row = 0,
    col = 1,
  },
  yadm = {
    enable = false,
  },

  on_attach = function(bufnr)
    local gs = package.loaded.gitsigns
    local wk = require("which-key")

    -- Navigation
    wk.register({
      ["[c"] = {
        function()
          if vim.wo.diff then
            return "[c"
          end
          vim.schedule(function()
            gs.prev_hunk()
          end)
          return "<Ignore>"
        end,
        "Previous Hunk",
      },
      ["]c"] = {
        function()
          if vim.wo.diff then
            return "]c"
          end
          vim.schedule(function()
            gs.next_hunk()
          end)
          return "<Ignore>"
        end,
        "Next Hunk",
      },
    }, { mode = "n", expr = true, buffer = bufnr })

    -- Actions
    wk.register({
      ["<leader>hs"] = { gs.stage_hunk, "Stage Hunk" },
      ["<leader>hr"] = { gs.reset_hunk, "Reset Hunk" },
      ["<leader>hS"] = { gs.stage_buffer, "Stage Buffer" },
      ["<leader>hu"] = { gs.undo_stage_hunk, "Undo Stage Hunk" },
      ["<leader>hR"] = { gs.reset_buffer, "Reset Buffer" },
      ["<leader>hp"] = { gs.preview_hunk, "Preview Hunk" },
      ["<leader>hb"] = {
        function()
          gs.blame_line({ full = true })
        end,
        "Blame Line",
      },
      ["<leader>tb"] = { gs.toggle_current_line_blame, "Toggle Blame Line" },
      ["<leader>hd"] = { gs.diffthis, "Diff This" },
      ["<leader>hD"] = {
        function()
          gs.diffthis("~")
        end,
        "Diff This ~",
      },
      ["<leader>td"] = { gs.toggle_deleted, "Toggle Deleted" },
    }, { mode = "n", buffer = bufnr })

    wk.register({
      ["<leader>hs"] = { "Stage Hunk" },
      ["<leader>hr"] = { "Reset Hunk" },
    }, { mode = "v", buffer = bufnr })

    -- Text object
    wk.register({
      ["ih"] = { "Select Hunk" },
    }, { mode = { "o", "x" }, buffer = bufnr })
  end,
})
