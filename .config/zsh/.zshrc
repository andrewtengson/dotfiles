export ZDOTDIR=~/.config/zsh

HISTFILE=~/.zsh_history
setopt appendhistory

source $ZDOTDIR/zsh-functions
zsh_add_file zsh-exports
zsh_add_file zsh-aliases
zsh_add_file custom-functions
zsh_add_file agnoster-mod.zsh-theme
zsh_add_plugin zsh-users/zsh-syntax-highlighting

autoload -U compinit
zmodload -i zsh/complist
zstyle ':completion:*' menu select
_comp_options+=(globdots)
compinit

autoload -Uz colors && colors

bindkey -e
