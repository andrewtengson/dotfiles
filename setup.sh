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

realpath() {
  [[ $1 = /* ]] && echo "$1" || echo "$PWD/${1#./}"
}

script_dir="$(realpath "$(dirname "${0}")")"
cd "$script_dir"

dotfiles=(
  ".zshrc"
  ".tmux.conf"
  ".config/nvim"
  ".config/zsh"
  ".config/kitty"
  ".config/ghostty"
)

if [[ "$(uname -s)" == "Linux" ]]; then
  dotfiles+=( ".config/ghostty-linux" )
fi

if [[ "$(uname -s)" == "Darwin" ]] || [[ $USER == "deck" ]]; then
  if ! "$(which brew)"; then
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  fi
  create_symlink ".zprofile"
fi

for file in "${dotfiles[@]}"; do
  create_symlink "$file"
done
