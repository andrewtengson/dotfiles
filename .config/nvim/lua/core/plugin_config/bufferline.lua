local palette = require("gruvbox").palette
require("bufferline").setup({
  options = {
    modified_icon = "󰧟",
    left_trunc_marker = "",
    right_trunc_marker = "",
    offsets = { { filetype = "NvimTree", text = "", padding = 1 } },
    show_buffer_icons = true,
    show_buffer_close_icons = false,
    show_close_icon = false,
    show_tab_indicators = true,
    persist_buffer_sort = true, -- whether or not custom sorted buffers should persist
    enforce_regular_tabs = true,
    always_show_bufferline = true,
  },
  highlights = {
    background = { bg = palette.dark0_hard },
    buffer_visible = { fg = palette.dark4, bg = palette.dark0_hard },
    buffer_selected = {
      fg = palette.light1,
      bg = palette.dark0_hard,
    },
    duplicate = {
      fg = palette.light1,
      bg = palette.dark0_hard,
    },
    duplicate_visible = {
      fg = palette.light1,
      bg = palette.dark0_hard,
    },
    duplicate_selected = {
      fg = palette.light1,
      bg = palette.dark0_hard,
    },
    tab = { fg = palette.light1, bg = palette.dark0_hard },
    tab_selected = {
      fg = palette.light1,
      bg = palette.dark0_hard,
    },
    tab_close = { fg = palette.bright_red, bg = palette.dark0_hard },
    indicator_visible = {
      bg = palette.dark0_hard,
    },
    indicator_selected = {
      fg = palette.bright_blue,
      bg = palette.dark0_hard,
      bold = true,
    },
    separator = { fg = palette.dark0_hard, bg = palette.dark0_hard },
    separator_selected = {
      fg = palette.dark0_hard,
      bg = palette.dark0_hard,
    },
    separator_visible = { fg = palette.dark0_hard, bg = palette.dark0_hard },
    offset_separator = { fg = palette.dark0_hard, bg = palette.dark0_hard },
    tab_separator = { fg = palette.dark0_hard, bg = palette.dark0_hard },
    tab_separator_selected = {
      fg = palette.dark0_hard,
      bg = palette.dark0_hard,
    },
    close_button = { fg = palette.dark4, bg = palette.dark0_hard },
    close_button_visible = { fg = palette.bright_red, bg = palette.dark0_hard },
    close_button_selected = {
      fg = palette.bright_red,
      bg = palette.dark0_hard,
    },
    fill = { bg = palette.dark0_hard },
    numbers = { fg = palette.dark4, bg = palette.dark0_hard },
    numbers_visible = { fg = palette.dark4, bg = palette.dark0_hard },
    numbers_selected = {
      fg = palette.light1,
      bg = palette.dark0_hard,
    },
    error = { fg = palette.bright_red, bg = palette.dark0_hard },
    error_visible = { fg = palette.bright_red, bg = palette.dark0_hard },
    error_selected = {
      fg = palette.bright_red,
      bg = palette.dark0_hard,
    },
    error_diagnostic = { fg = palette.bright_red, bg = palette.dark0_hard },
    error_diagnostic_visible = { fg = palette.bright_red, bg = palette.dark0_hard },
    error_diagnostic_selected = {
      fg = palette.bright_red,
      bg = palette.dark0_hard,
    },
    warning = { fg = palette.bright_yellow, bg = palette.dark0_hard },
    warning_visible = { fg = palette.bright_yellow, bg = palette.dark0_hard },
    warning_selected = {
      fg = palette.bright_yellow,
      bg = palette.dark0_hard,
    },
    warning_diagnostic = { fg = palette.bright_yellow, bg = palette.dark0_hard },
    warning_diagnostic_visible = { fg = palette.bright_yellow, bg = palette.dark0_hard },
    warning_diagnostic_selected = {
      fg = palette.bright_yellow,
      bg = palette.dark0_hard,
    },
    info = { fg = palette.bright_blue, bg = palette.dark0_hard },
    info_visible = { fg = palette.bright_blue, bg = palette.dark0_hard },
    info_selected = {
      fg = palette.bright_blue,
      bg = palette.dark0_hard,
    },
    info_diagnostic = { fg = palette.bright_blue, bg = palette.dark0_hard },
    info_diagnostic_visible = { fg = palette.bright_blue, bg = palette.dark0_hard },
    info_diagnostic_selected = {
      fg = palette.bright_blue,
      bg = palette.dark0_hard,
    },
    hint = { fg = palette.bright_green, bg = palette.dark0_hard },
    hint_visible = { fg = palette.bright_green, bg = palette.dark0_hard },
    hint_selected = {
      fg = palette.bright_green,
      bg = palette.dark0_hard,
    },
    hint_diagnostic = { fg = palette.bright_green, bg = palette.dark0_hard },
    hint_diagnostic_visible = { fg = palette.bright_green, bg = palette.dark0_hard },
    hint_diagnostic_selected = {
      fg = palette.bright_green,
      bg = palette.dark0_hard,
    },
    diagnostic = { fg = palette.dark4, bg = palette.dark0_hard },
    diagnostic_visible = { fg = palette.dark4, bg = palette.dark0_hard },
    diagnostic_selected = {
      fg = palette.dark4,
      bg = palette.dark0_hard,
    },
    modified = { fg = palette.bright_orange, bg = palette.dark0_hard },
    modified_selected = {
      fg = palette.bright_orange,
      bg = palette.dark0_hard,
    },
  },
})
