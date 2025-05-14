local util = require("lspconfig.util")

local opts = {
  root_dir = function(fname)
    return util.root_pattern("biome.json", "biome.jsonc")(fname)
        or util.find_package_json_ancestor(fname)
        or util.find_node_modules_ancestor(fname)
        or util.find_git_ancestor(fname)
  end,
}

return opts
