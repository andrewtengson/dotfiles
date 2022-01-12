#!/bin/bash

set -eao pipefail

# dotfiles
create_symlink() {
  file=$1
  src="${PWD}/${file}"
  dst="${HOME}/${file}"

  if ! [[ -f "${dst}" ]]; then
    if ! [[ -d "$(dirname "${dst}")" ]]; then
      mkdir -p "$(dirname "${dst}")"
    fi

    echo "Creating ${dst} symlink..."
    ln -sfn "${src}" "${dst}"
  fi
}

dotfiles=(
  ".zshrc"
  ".tmux.conf"
  ".oh-my-zsh/custom/themes/agnoster-mod.zsh-theme"
  ".config/nvim"
  ".config/aliasrc"
)

for file in "${dotfiles[@]}"; do
  create_symlink "${file}"
done

# zsh-syntax-highlighting
git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
