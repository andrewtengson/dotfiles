#!/bin/bash

set -eao pipefail

# dotfiles
create_symlink() {
  file=$1
  src="$PWD/$file"
  dst="$HOME/$file"

  if ! [[ -f "$dst" ]]; then
    if ! [[ -d "$(dirname "$dst")" ]]; then
      mkdir -p "$(dirname "$dst")"
    fi

    echo "Creating $dst symlink..."
    ln -sfn "$src" "$dst"
  fi
}

dotfiles=(
  ".zshrc"
  ".tmux.conf"
  ".config/nvim"
  ".config/zsh"
  ".zprofile"
)

if ! "$(which brew)"; then
 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" 
fi

for file in "${dotfiles[@]}"; do
  create_symlink "$file"
done
