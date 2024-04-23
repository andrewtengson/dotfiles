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
setopt hist_ignore_space

source $ZDOTDIR/zsh-functions
zsh_add_file zsh-exports
zsh_add_file zsh-aliases
zsh_add_file custom-functions
zsh_add_file agnoster-mod.zsh-theme
zsh_add_plugin zsh-users/zsh-syntax-highlighting

autoload -U compinit
zmodload -i zsh/complist
zstyle ':completion:*' menu select
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
zstyle ':completion:*:*:kill:*:processes' list-colors '=(#b) #([0-9]#) ([0-9a-z-]#)*=01;34=0=01'
zstyle ':completion:*' matcher-list '' 'm:{a-zA-Z}={A-Za-z}' 'r:|[._-]=* r:|=*' 'l:|=* r:|=*'
_comp_options+=(globdots)
compinit

autoload -Uz colors && colors

bindkey -e
bindkey -M menuselect '^[[Z' reverse-menu-complete

autoload edit-command-line
zle -N edit-command-line
bindkey '^x^e' edit-command-line

if which zoxide > /dev/null 2>&1; then
  eval "$(zoxide init --cmd cd zsh)"
fi
