-- JDK 24+ lowered jdk.xml.totalEntitySizeLimit to 100000. ltex-ls 16.0.0's
-- LanguageTool exceeds that while parsing grammar.xml and exits on startup.
-- Scoped here so other Java tools keep their own JAVA_OPTS.
local xml_limits = table.concat({
  "-Djdk.xml.totalEntitySizeLimit=0",
  "-Djdk.xml.maxGeneralEntitySizeLimit=0",
  "-Djdk.xml.entityExpansionLimit=0",
}, " ")

local existing = vim.env.JAVA_OPTS
local java_opts = (existing and existing ~= "") and (existing .. " " .. xml_limits) or xml_limits

---@type vim.lsp.Config
return {
  cmd_env = {
    JAVA_OPTS = java_opts,
  },
}
