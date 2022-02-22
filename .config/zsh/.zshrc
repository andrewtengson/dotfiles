export ZDOTDIR=~/.config/zsh

HISTSIZE=5000
HISTFILE=~/.zsh_history
SAVEHIST=5000
HISTDUP=erase
setopt appendhistory
setopt sharehistory
setopt incappendhistory
setopt hist_ignore_all_dups
setopt hist_save_no_dups
setopt hist_ignore_dups
setopt hist_find_no_dups

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
